import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Ping pour éviter la mise en pause du projet Supabase gratuit (appelé par cron-job.org toutes les 12 h). */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
