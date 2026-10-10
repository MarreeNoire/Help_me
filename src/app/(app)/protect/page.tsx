import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Personnes qui m'ont ajouté comme proche (et que j'ai accepté)
  const { data: links } = await supabase
    .from("contacts")
    .select("id,user_id,profiles:user_id(full_name,phone)")
    .eq("linked_user_id", user.id)
    .eq("confirmed", true);

  const ownerIds = (links ?? []).map((l) => l.user_id);

  const { data: active } = ownerIds.length
    ? await supabase
        .from("alerts")
        .select("id,user_id,created_at")
        .eq("status", "active")
        .in("user_id", ownerIds)
    : { data: [] as { id: string; user_id: string; created_at: string }[] };

  return (
    <main className="space-y-4 p-4">
      <h1 className="pt-2 text-2xl font-extrabold">Je protège</h1>
      <p className="text-sm text-white/60">
        Les personnes qui t'ont ajouté comme proche de confiance. Leurs alertes s'affichent ici et en plein écran dès
        qu'elles sont déclenchées.
      </p>

      {(links ?? []).length === 0 && (
        <div className="card text-center text-white/60">
          <p className="text-4xl">🛡️</p>
          <p className="mt-2">Personne pour le moment. Quand un proche t'enverra une invitation, ouvre le lien et accepte-la depuis ton compte.</p>
        </div>
      )}

      <ul className="space-y-3">
        {(links ?? []).map((l) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rel = (l as any).profiles;
          const prof = Array.isArray(rel) ? rel[0] : rel;
          const alert = (active ?? []).find((a) => a.user_id === l.user_id);
          return (
            <li key={l.id} className={`card flex items-center justify-between gap-3 ${alert ? "!border-red-500 !bg-red-600/20" : ""}`}>
              <div>
                <p className="text-lg font-bold">{prof?.full_name || "Proche"}</p>
                <p className="text-sm text-white/60">{alert ? "🚨 Alerte en cours !" : "Tout va bien"}</p>
              </div>
              {alert ? (
                <Link href={`/alert/${alert.id}`} className="btn-primary !py-2 text-sm">
                  Voir
                </Link>
              ) : prof?.phone ? (
                <a href={`tel:${prof.phone}`} className="btn-ghost !py-2 text-sm">
                  📞 Appeler
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
