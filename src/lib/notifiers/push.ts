import webpush from "web-push";
import type { Notifier, NotifyContext } from "./types";
import type { Contact } from "@/lib/types";

let configured = false;

function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@example.com", pub, priv);
  configured = true;
  return true;
}

type Sub = webpush.PushSubscription;

type Target = { sub: Sub; source: "device" | "contact" };

async function targetsFor(contact: Contact, ctx: NotifyContext): Promise<Target[]> {
  const targets: Target[] = [];
  const seen = new Set<string>();
  const add = (sub: Sub, source: Target["source"]) => {
    if (!sub?.endpoint || seen.has(sub.endpoint)) return;
    seen.add(sub.endpoint);
    targets.push({ sub, source });
  };

  if (contact.linked_user_id) {
    const { data } = await ctx.admin
      .from("push_devices")
      .select("subscription")
      .eq("user_id", contact.linked_user_id);
    (data ?? []).forEach((d) => add(d.subscription as Sub, "device"));
  }
  if (contact.push_subscription) add(contact.push_subscription as Sub, "contact");
  return targets;
}

async function deliver(
  contact: Contact,
  ctx: NotifyContext,
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!configure()) return false;
  const targets = await targetsFor(contact, ctx);
  let ok = false;

  await Promise.all(
    targets.map(async ({ sub, source }) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload), {
          TTL: 3600,
          urgency: "high",
        });
        ok = true;
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Abonnement expiré : on le supprime
          if (source === "device") {
            await ctx.admin.from("push_devices").delete().eq("endpoint", sub.endpoint);
          } else {
            await ctx.admin.from("contacts").update({ push_subscription: null }).eq("id", contact.id);
          }
        } else {
          console.error("[push]", status ?? e);
        }
      }
    })
  );
  return ok;
}

export const pushNotifier: Notifier = {
  name: "push",

  async sendAlert(contact, ctx) {
    const url = contact.linked_user_id ? `/alert/${ctx.alert.id}` : `/track/${ctx.alert.track_token}`;
    const ok = await deliver(contact, ctx, {
      title: `🚨 ${ctx.senderName} a besoin d'aide`,
      body: "Appuie pour voir sa position en direct.",
      url,
      tag: `alert-${ctx.alert.id}`,
    });
    return ok ? {} : null;
  },

  async sendResolved(contact, ctx) {
    await deliver(contact, ctx, {
      title: `✅ ${ctx.senderName} est en sécurité`,
      body: "L'alerte est terminée.",
      url: contact.linked_user_id ? "/protect" : `/track/${ctx.alert.track_token}`,
      tag: `alert-${ctx.alert.id}`,
    });
  },
};
