import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "🔴 En cours", cls: "bg-red-600/30 text-red-300" },
  resolved: { label: "✅ Terminée", cls: "bg-emerald-600/30 text-emerald-300" },
  cancelled: { label: "Annulée", cls: "bg-white/10 text-white/70" },
};

function duration(start: string, end: string | null) {
  if (!end) return null;
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: alerts } = await supabase
    .from("alerts")
    .select("id,status,created_at,resolved_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="space-y-4 p-4">
      <h1 className="pt-2 text-2xl font-extrabold">Historique</h1>

      {(alerts ?? []).length === 0 && <p className="text-center text-white/50">Aucune alerte déclenchée.</p>}

      <ul className="space-y-2">
        {(alerts ?? []).map((a) => {
          const st = STATUS[a.status] ?? STATUS.cancelled;
          const d = duration(a.created_at, a.resolved_at);
          return (
            <li key={a.id} className="card flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {d && <p className="text-sm text-white/60">Durée : {d}</p>}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
