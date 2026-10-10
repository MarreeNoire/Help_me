import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyResolved } from "@/lib/notifiers";
import { notifyAuthorities } from "@/lib/notifiers/authorities";
import { appUrl } from "@/lib/utils";
import type { AlertRow, Contact } from "@/lib/types";

export const maxDuration = 30;

const schema = z.object({ alertId: z.string().uuid() });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const admin = createAdminClient();

  const { data: alert } = await admin
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", parsed.data.alertId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (!alert) return NextResponse.json({ ok: true, alreadyResolved: true });

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name,phone")
    .eq("id", user.id)
    .maybeSingle();
  const { data: contacts } = await admin.from("contacts").select("*").eq("user_id", user.id);

  const ctx = {
    admin,
    alert: alert as AlertRow,
    senderName: profile?.full_name || "Un proche",
    senderPhone: profile?.phone ?? null,
    trackUrl: `${appUrl()}/track/${alert.track_token}`,
    location: null,
  };

  await Promise.allSettled([
    notifyResolved(ctx, (contacts ?? []) as Contact[]),
    notifyAuthorities(ctx, "sos_resolved"),
  ]);

  return NextResponse.json({ ok: true });
}
