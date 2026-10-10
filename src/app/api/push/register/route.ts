import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }).passthrough(),
});

/** Enregistre l'appareil push de l'utilisateur connecté (pour recevoir les alertes en tant que gardien). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const admin = createAdminClient();
  const { subscription } = parsed.data;

  // Un appareil = un compte : on supprime l'ancienne association éventuelle puis on réinsère.
  await admin.from("push_devices").delete().eq("endpoint", subscription.endpoint);
  const { error } = await admin
    .from("push_devices")
    .insert({ user_id: user.id, subscription });

  if (error) {
    console.error("[push/register]", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
