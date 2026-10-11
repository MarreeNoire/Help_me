import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAlertStart, notifyAuthorities } from "@/lib/notifiers";
import { buildActivePayload } from "@/lib/alerts";
import { appUrl } from "@/lib/utils";
import type { AlertRow, Contact } from "@/lib/types";

export const maxDuration = 30;

const schema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().optional(),
});

const MAX_ALERTS_PER_HOUR = 3;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { lat, lng, accuracy } = parsed.data;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name,phone")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = profile?.full_name || "Un proche";

  // Alerte déjà active : on la renvoie sans renotifier.
  const { data: existing } = await admin
    .from("alerts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(await buildActivePayload(admin, existing as AlertRow, senderName));
  }

  // Limite anti-abus
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_ALERTS_PER_HOUR) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { data: alert, error } = await admin
    .from("alerts")
    .insert({ user_id: user.id })
    .select("*")
    .single();
  if (error || !alert) {
    console.error("[alert/start]", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const location = lat !== undefined && lng !== undefined ? { lat, lng } : null;
  if (location) {
    await admin
      .from("alert_locations")
      .insert({ alert_id: alert.id, lat: location.lat, lng: location.lng, accuracy: accuracy ?? null });
  }

  const { data: rawContacts } = await admin.from("contacts").select("*").eq("user_id", user.id);
  const contacts = (rawContacts ?? []) as Contact[];

  // Auto-lier les contacts au profil correspondant par numéro de téléphone
  const { data: allProfiles } = await admin.from("profiles").select("id,phone");
  for (const c of contacts) {
    if (c.phone && (!c.linked_user_id || !c.confirmed)) {
      const cDigits = c.phone.replace(/[^\d]/g, "");
      if (cDigits.length >= 8) {
        const matched = (allProfiles ?? []).find((p) => {
          if (!p.phone || p.id === user.id) return false;
          const pDigits = p.phone.replace(/[^\d]/g, "");
          return (
            cDigits === pDigits ||
            cDigits.endsWith(pDigits) ||
            pDigits.endsWith(cDigits)
          );
        });
        if (matched) {
          c.linked_user_id = matched.id;
          c.confirmed = true;
          await admin
            .from("contacts")
            .update({ linked_user_id: matched.id, confirmed: true })
            .eq("id", c.id);
        }
      }
    }
  }

  const ctx = {
    admin,
    alert: alert as AlertRow,
    senderName,
    senderPhone: profile?.phone ?? null,
    trackUrl: `${appUrl()}/track/${alert.track_token}`,
    location,
  };

  await Promise.allSettled([
    notifyAlertStart(ctx, contacts),
    notifyAuthorities(ctx),
  ]);

  return NextResponse.json(await buildActivePayload(admin, alert as AlertRow, senderName));
}
