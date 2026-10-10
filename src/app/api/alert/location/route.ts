import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyLocation } from "@/lib/notifiers";

const schema = z.object({
  alertId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { alertId, lat, lng, accuracy } = parsed.data;

  const admin = createAdminClient();
  const { data: alert } = await admin
    .from("alerts")
    .select("id,status")
    .eq("id", alertId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!alert) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (alert.status !== "active") return NextResponse.json({ error: "not_active" }, { status: 409 });

  await admin
    .from("alert_locations")
    .insert({ alert_id: alertId, lat, lng, accuracy: accuracy ?? null });

  await notifyLocation(admin, alertId, { lat, lng });

  return NextResponse.json({ ok: true });
}
