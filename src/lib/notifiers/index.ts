import type { AdminClient } from "@/lib/supabase/admin";
import type { Contact, LatLng } from "@/lib/types";
import type { Notifier, NotifyContext } from "./types";
import { pushNotifier } from "./push";
import {
  telegramEditLive,
  telegramNotifier,
  telegramSendLive,
  telegramStopLive,
} from "./telegram";

export { notifyAuthorities } from "./authorities";
export type { NotifyContext } from "./types";

/** Canaux automatiques actifs. Ajouter ici un nouveau canal. */
const notifiers: Notifier[] = [telegramNotifier, pushNotifier];

/** Envoie l'alerte à tous les contacts confirmés et trace les envois dans alert_messages. */
export async function notifyAlertStart(ctx: NotifyContext, contacts: Contact[]) {
  const rows: {
    alert_id: string;
    contact_id: string;
    channel: string;
    telegram_message_id: number | null;
  }[] = [];

  await Promise.all(
    contacts
      .filter((c) => c.confirmed || Boolean(c.linked_user_id) || Boolean(c.phone) || Boolean(c.push_subscription))
      .map(async (contact) => {
        const results = await Promise.all(
          notifiers.map(async (n) => {
            try {
              return await n.sendAlert(contact, ctx);
            } catch (e) {
              console.error(`[notify:${n.name}]`, e);
              return null;
            }
          })
        );
        results.forEach((r, i) => {
          if (r) {
            rows.push({
              alert_id: ctx.alert.id,
              contact_id: contact.id,
              channel: notifiers[i].name,
              telegram_message_id: r.telegramMessageId ?? null,
            });
          }
        });
      })
  );

  if (rows.length) await ctx.admin.from("alert_messages").insert(rows);
}

/** Met à jour la position en direct dans Telegram. */
export async function notifyLocation(admin: AdminClient, alertId: string, loc: LatLng) {
  const { data } = await admin
    .from("alert_messages")
    .select("id,telegram_message_id,contacts(telegram_chat_id)")
    .eq("alert_id", alertId)
    .eq("channel", "telegram");

  await Promise.all(
    (data ?? []).map(async (row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contactRel = (row as any).contacts;
      const chatId: number | null | undefined = Array.isArray(contactRel)
        ? contactRel[0]?.telegram_chat_id
        : contactRel?.telegram_chat_id;
      if (!chatId) return;
      try {
        if (row.telegram_message_id) {
          await telegramEditLive(chatId, row.telegram_message_id, loc);
        } else {
          const id = await telegramSendLive(chatId, loc);
          await admin.from("alert_messages").update({ telegram_message_id: id }).eq("id", row.id);
        }
      } catch {
        // "message is not modified" ou live location expirée : on ignore
      }
    })
  );
}

/** Arrête les positions live et prévient les proches que tout va bien. */
export async function notifyResolved(ctx: NotifyContext, contacts: Contact[]) {
  const { data } = await ctx.admin
    .from("alert_messages")
    .select("telegram_message_id,contacts(telegram_chat_id)")
    .eq("alert_id", ctx.alert.id)
    .eq("channel", "telegram");

  await Promise.all(
    (data ?? []).map(async (row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contactRel = (row as any).contacts;
      const chatId: number | null | undefined = Array.isArray(contactRel)
        ? contactRel[0]?.telegram_chat_id
        : contactRel?.telegram_chat_id;
      if (!chatId || !row.telegram_message_id) return;
      try {
        await telegramStopLive(chatId, row.telegram_message_id);
      } catch {
        /* ignore */
      }
    })
  );

  await Promise.all(
    contacts
      .filter((c) => c.confirmed)
      .flatMap((c) =>
        notifiers.map(async (n) => {
          try {
            await n.sendResolved(c, ctx);
          } catch (e) {
            console.error(`[resolve:${n.name}]`, e);
          }
        })
      )
  );
}
