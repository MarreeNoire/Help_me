import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildActivePayload } from "@/lib/alerts";
import type { AlertRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Renvoie l'alerte active de l'utilisateur (pour reprendre après un rechargement). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: alert } = await admin
    .from("alerts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!alert) return NextResponse.json({ alert: null });

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const payload = await buildActivePayload(admin, alert as AlertRow, profile?.full_name || "Un proche");
  return NextResponse.json({ alert: payload });
}
