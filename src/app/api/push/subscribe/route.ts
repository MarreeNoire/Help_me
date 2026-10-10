import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  token: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }).passthrough(),
});

/** PUBLIC : un proche SANS compte active le push depuis /invite/[token]. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contacts")
    .update({ push_subscription: parsed.data.subscription, confirmed: true })
    .eq("confirm_token", parsed.data.token)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
