import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Suivi PUBLIC : accessible avec le track_token uniquement. Position visible seulement si l'alerte est active. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUuid(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: alert } = await admin
    .from("alerts")
    .select("id,status,created_at,resolved_at,user_id")
    .eq("track_token", token)
    .maybeSingle();

  if (!alert) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name,phone")
    .eq("id", alert.user_id)
    .maybeSingle();

  const active = alert.status === "active";
  let locations: { lat: number; lng: number; accuracy: number | null; created_at: string }[] = [];

  if (active) {
    const { data } = await admin
      .from("alert_locations")
      .select("lat,lng,accuracy,created_at")
      .eq("alert_id", alert.id)
      .order("created_at", { ascending: false })
      .limit(60);
    locations = (data ?? []).reverse();
  }

  return NextResponse.json(
    {
      status: alert.status,
      name: profile?.full_name || "Un proche",
      phone: active ? profile?.phone ?? null : null,
      createdAt: alert.created_at,
      resolvedAt: alert.resolved_at,
      locations,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
