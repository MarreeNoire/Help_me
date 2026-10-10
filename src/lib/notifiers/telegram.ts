import type { LatLng } from "@/lib/types";
import type { Notifier } from "./types";

const LIVE_PERIOD_SECONDS = 86400; // 24 h (maximum Telegram)

function api(method: string) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(api(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!json?.ok) throw new Error(`Telegram ${method}: ${json?.description ?? res.status}`);
  return json.result;
}

export function telegramEnabled() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function telegramSendText(chatId: number, text: string) {
  if (!telegramEnabled()) return;
  await call("sendMessage", { chat_id: chatId, text });
}

export async function telegramSendLive(chatId: number, loc: LatLng): Promise<number> {
  const msg = await call("sendLocation", {
    chat_id: chatId,
    latitude: loc.lat,
    longitude: loc.lng,
    live_period: LIVE_PERIOD_SECONDS,
  });
  return msg.message_id as number;
}

export async function telegramEditLive(chatId: number, messageId: number, loc: LatLng) {
  await call("editMessageLiveLocation", {
    chat_id: chatId,
    message_id: messageId,
    latitude: loc.lat,
    longitude: loc.lng,
  });
}

export async function telegramStopLive(chatId: number, messageId: number) {
  await call("stopMessageLiveLocation", { chat_id: chatId, message_id: messageId });
}

export const telegramNotifier: Notifier = {
  name: "telegram",

  async sendAlert(contact, ctx) {
    if (!telegramEnabled() || !contact.telegram_chat_id) return null;
    const chatId = contact.telegram_chat_id;

    await telegramSendText(
      chatId,
      `🚨 ${ctx.senderName} a besoin d'aide !\n\nSuivre sa position en direct :\n${ctx.trackUrl}`
    );

    let messageId: number | null = null;
    if (ctx.location) {
      try {
        messageId = await telegramSendLive(chatId, ctx.location);
      } catch (e) {
        console.error("[telegram] sendLocation", e);
      }
    }
    return { telegramMessageId: messageId };
  },

  async sendResolved(contact, ctx) {
    if (!telegramEnabled() || !contact.telegram_chat_id) return;
    await telegramSendText(
      contact.telegram_chat_id,
      `✅ ${ctx.senderName} est en sécurité. L'alerte est terminée.`
    );
  },
};
