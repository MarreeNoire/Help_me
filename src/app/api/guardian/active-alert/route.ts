import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Vérifie si un protégé de l'utilisateur connecté a déclenché une alerte active.
 * Recherche soit par linked_user_id, soit par correspondance de numéro de téléphone.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ alertId: null }, { status: 401 });

  const admin = createAdminClient();

  // 1. Récupérer le numéro de téléphone de l'utilisateur actuel
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  const userPhoneDigits = profile?.phone ? profile.phone.replace(/[^\d]/g, "") : null;

  // 2. Trouver tous les utilisateurs (protégés) qui ont ajouté l'utilisateur actuel comme proche
  const { data: contactsLinked } = await admin
    .from("contacts")
    .select("id,user_id")
    .eq("linked_user_id", user.id);

  const ownerIds = new Set<string>((contactsLinked ?? []).map((c) => c.user_id));

  // Correspondance par numéro de téléphone si renseigné
  if (userPhoneDigits && userPhoneDigits.length >= 8) {
    const { data: allContacts } = await admin.from("contacts").select("id,user_id,phone");
    for (const c of allContacts ?? []) {
      if (c.phone && c.user_id !== user.id) {
        const cDigits = c.phone.replace(/[^\d]/g, "");
        if (
          cDigits === userPhoneDigits ||
          cDigits.endsWith(userPhoneDigits) ||
          userPhoneDigits.endsWith(cDigits)
        ) {
          ownerIds.add(c.user_id);
          // Lier automatiquement le contact au passage
          await admin
            .from("contacts")
            .update({ linked_user_id: user.id, confirmed: true })
            .eq("id", c.id);
        }
      }
    }
  }

  if (ownerIds.size === 0) {
    return NextResponse.json({ alertId: null });
  }

  // 3. Chercher si l'un de ces protégés a une alerte active
  const { data: activeAlert } = await admin
    .from("alerts")
    .select("id,user_id,created_at,profiles:user_id(full_name)")
    .eq("status", "active")
    .in("user_id", Array.from(ownerIds))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeAlert) {
    return NextResponse.json({ alertId: null });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rel = (activeAlert as any).profiles;
  const prof = Array.isArray(rel) ? rel[0] : rel;

  return NextResponse.json({
    alertId: activeAlert.id,
    senderName: prof?.full_name || "Un proche",
  });
}
