import type { AdminClient } from "@/lib/supabase/admin";
import type { ActiveAlertPayload, AlertRow, Contact } from "@/lib/types";
import { appUrl, buildAlertMessage, smsLink, waLink } from "@/lib/utils";

/** Construit la réponse « alerte active » : message, lien de suivi, et état d'envoi par proche. */
export async function buildActivePayload(
  admin: AdminClient,
  alert: AlertRow,
  senderName: string
): Promise<ActiveAlertPayload> {
  const trackUrl = `${appUrl()}/track/${alert.track_token}`;
  const message = buildAlertMessage(senderName, trackUrl);

  const [{ data: contacts }, { data: msgs }] = await Promise.all([
    admin
      .from("contacts")
      .select("*")
      .eq("user_id", alert.user_id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
    admin.from("alert_messages").select("contact_id,channel").eq("alert_id", alert.id),
  ]);

  const sent = msgs ?? [];

  return {
    alertId: alert.id,
    trackToken: alert.track_token,
    trackUrl,
    message,
    createdAt: alert.created_at,
    contacts: ((contacts ?? []) as Contact[]).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      confirmed: c.confirmed ?? false,
      telegram: sent.some((m) => m.contact_id === c.id && m.channel === "telegram"),
      push: sent.some((m) => m.contact_id === c.id && m.channel === "push"),
      waLink: c.phone ? waLink(c.phone, message) : null,
      smsLink: c.phone ? smsLink(c.phone, message) : null,
    })),
  };
}
