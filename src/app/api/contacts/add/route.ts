import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { name, phone } = parsed.data;
  const admin = createAdminClient();

  const trimmedPhone = phone?.trim() || null;
  let linkedUserId: string | null = null;
  let confirmed = false;

  // Si un numéro est fourni, chercher automatiquement si un utilisateur est déjà inscrit avec ce numéro
  if (trimmedPhone) {
    const cleanDigits = trimmedPhone.replace(/[^\d]/g, "");
    if (cleanDigits.length >= 8) {
      const { data: profiles } = await admin.from("profiles").select("id,phone");
      const matched = (profiles ?? []).find((p) => {
        if (!p.phone || p.id === user.id) return false;
        const pDigits = p.phone.replace(/[^\d]/g, "");
        return (
          cleanDigits === pDigits ||
          cleanDigits.endsWith(pDigits) ||
          pDigits.endsWith(cleanDigits)
        );
      });
      if (matched) {
        linkedUserId = matched.id;
        confirmed = true;
      }
    }
  }

  // Calcul de la priorité
  const { count } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: contact, error } = await admin
    .from("contacts")
    .insert({
      user_id: user.id,
      name: name.trim(),
      phone: trimmedPhone,
      priority: (count ?? 0) + 1,
      linked_user_id: linkedUserId,
      confirmed,
    })
    .select("*")
    .single();

  if (error || !contact) {
    console.error("[contacts/add]", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ contact });
}
