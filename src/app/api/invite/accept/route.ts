import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ token: z.string().uuid() });

/** Un utilisateur connecté accepte une invitation : son compte devient « gardien » du protégé. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("contacts")
    .select("id,user_id")
    .eq("confirm_token", parsed.data.token)
    .maybeSingle();

  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contact.user_id === user.id) {
    return NextResponse.json({ error: "self_invite" }, { status: 400 });
  }

  const { error } = await admin
    .from("contacts")
    .update({ linked_user_id: user.id, confirmed: true })
    .eq("id", contact.id);

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
