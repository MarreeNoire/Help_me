import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils";
import { telegramSendText } from "@/lib/notifiers/telegram";

export const dynamic = "force-dynamic";

/**
 * Webhook Telegram. Enregistrement (après déploiement) :
 * https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://DOMAINE/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = await req.json().catch(() => null);
  const msg = update?.message;
  const chatId: number | undefined = msg?.chat?.id;
  const text: string = (msg?.text ?? "").trim();
  if (!chatId || !text) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  try {
    if (text.startsWith("/start")) {
      const token = text.split(/\s+/)[1];

      if (!token || !isUuid(token)) {
        await telegramSendText(
          chatId,
          "👋 Bienvenue sur Help_me. Pour recevoir les alertes d'un proche, ouvre le lien d'invitation qu'il t'a envoyé."
        );
        return NextResponse.json({ ok: true });
      }

      const { data: contact } = await admin
        .from("contacts")
        .update({ telegram_chat_id: chatId, confirmed: true })
        .eq("confirm_token", token)
        .select("user_id")
        .maybeSingle();

      if (!contact) {
        await telegramSendText(chatId, "❌ Invitation introuvable ou expirée. Demande un nouveau lien.");
        return NextResponse.json({ ok: true });
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", contact.user_id)
        .maybeSingle();

      await telegramSendText(
        chatId,
        `✅ C'est fait ! Tu recevras ici les alertes de ${profile?.full_name || "ton proche"}, avec sa position en direct.\n\nPour arrêter, envoie /stop.`
      );
    } else if (text.startsWith("/stop")) {
      await admin.from("contacts").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
      await telegramSendText(chatId, "🔕 Tu ne recevras plus d'alertes Help_me sur Telegram.");
    }
  } catch (e) {
    console.error("[telegram/webhook]", e);
  }

  return NextResponse.json({ ok: true });
}
