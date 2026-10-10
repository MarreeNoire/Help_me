import type { AdminClient } from "@/lib/supabase/admin";
import type { AlertRow, Contact, LatLng } from "@/lib/types";

export type NotifyContext = {
  admin: AdminClient;
  alert: AlertRow;
  senderName: string;
  senderPhone?: string | null;
  trackUrl: string;
  location: LatLng | null;
};

export type SendResult = { telegramMessageId?: number | null };

/**
 * Un canal de notification. Pour en ajouter un (ex. SMS payant plus tard) :
 * créer un fichier dans ce dossier, implémenter cette interface, l'ajouter dans index.ts.
 */
export interface Notifier {
  name: "telegram" | "push";
  /** Retourne null si le contact n'est pas joignable par ce canal ou si l'envoi échoue. */
  sendAlert(contact: Contact, ctx: NotifyContext): Promise<SendResult | null>;
  sendResolved(contact: Contact, ctx: NotifyContext): Promise<void>;
}
