export type Contact = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  priority: number;
  confirm_token: string;
  confirmed: boolean;
  telegram_chat_id: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  push_subscription: any | null;
  linked_user_id: string | null;
  created_at: string;
};

export type AlertRow = {
  id: string;
  user_id: string;
  status: "active" | "resolved" | "cancelled";
  track_token: string;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type LatLng = { lat: number; lng: number };

export type LocationPoint = LatLng & {
  accuracy?: number | null;
  created_at?: string;
};

/** Ce que l'écran « alerte envoyée » affiche pour chaque proche. */
export type ContactDelivery = {
  id: string;
  name: string;
  phone: string | null;
  confirmed: boolean;
  telegram: boolean;
  push: boolean;
  waLink: string | null;
  smsLink: string | null;
};

export type ActiveAlertPayload = {
  alertId: string;
  trackToken: string;
  trackUrl: string;
  message: string;
  createdAt: string;
  contacts: ContactDelivery[];
};

export type FallbackContact = { id: string; name: string; phone: string | null };
