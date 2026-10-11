"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startAlarm } from "@/lib/alarm";
import { EMERGENCY, directionsLink, timeAgo } from "@/lib/utils";
import LiveMap from "./LiveMap";

type AlertInfo = {
  status: "active" | "resolved" | "cancelled";
  created_at: string;
  name: string;
  phone: string | null;
};

type Pt = { lat: number; lng: number; created_at: string };

/** Vue « gardien » : alerte d'un protégé, position live, sirène optionnelle. */
export default function GuardianAlertView({
  alertId,
  onClose,
  alarm = false,
}: {
  alertId: string;
  onClose?: () => void;
  alarm?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [info, setInfo] = useState<AlertInfo | null>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const [missing, setMissing] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data: a } = await supabase
      .from("alerts")
      .select("status,created_at,profiles(full_name,phone)")
      .eq("id", alertId)
      .maybeSingle();

    if (!a) {
      setMissing(true);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rel = (a as any).profiles;
    const prof = Array.isArray(rel) ? rel[0] : rel;
    setInfo({
      status: a.status as AlertInfo["status"],
      created_at: a.created_at,
      name: prof?.full_name || "Un proche",
      phone: prof?.phone ?? null,
    });

    if (a.status === "active") {
      const { data: locs } = await supabase
        .from("alert_locations")
        .select("lat,lng,created_at")
        .eq("alert_id", alertId)
        .order("created_at", { ascending: false })
        .limit(100);
      setPoints((locs ?? []).reverse());
    } else {
      setPoints([]);
    }
  }, [supabase, alertId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setTick((t) => t + 1), 1000);
    const channel = supabase
      .channel(`guardian-${alertId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alert_locations", filter: `alert_id=eq.${alertId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts", filter: `id=eq.${alertId}` },
        () => load()
      )
      .subscribe();

    return () => {
      clearInterval(poll);
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [supabase, alertId, load]);

  const active = info?.status === "active";

  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!alarm || !active || muted) return;
    return startAlarm();
  }, [alarm, active, muted]);

  if (missing) {
    return (
      <div className="p-6 text-center">
        <p className="text-white/70">Alerte introuvable ou accès non autorisé.</p>
        {onClose && (
          <button className="btn-ghost mt-4" onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
    );
  }

  if (!info) return <p className="p-6 text-center text-white/60">Chargement…</p>;

  if (!active) {
    return (
      <div className="p-6 text-center">
        <p className="text-5xl">✅</p>
        <h1 className="mt-3 text-xl font-bold">{info.name} est en sécurité</h1>
        <p className="mt-1 text-white/60">L'alerte est terminée.</p>
        {onClose && (
          <button className="btn-light mt-6" onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
    );
  }

  const last = points[points.length - 1];

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-3xl bg-red-700 p-4 ring-2 ring-white/40">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/80">🚨 Alerte SOS</p>
        <h1 className="text-2xl font-extrabold">{info.name} a besoin d'aide</h1>
        <p className="mt-1 text-sm text-white/80">
          Lancée {timeAgo(info.created_at)}
          {last ? ` · dernière position ${timeAgo(last.created_at)}` : " · position en attente…"}
        </p>
      </div>

      {points.length > 0 ? (
        <LiveMap points={points} />
      ) : (
        <div className="card text-center text-white/70">En attente de la position GPS…</div>
      )}

      <div className="grid gap-2">
        {alarm && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className={`w-full rounded-2xl py-3 px-4 font-bold text-base transition flex items-center justify-center gap-2 ${
              muted
                ? "bg-white/20 text-white hover:bg-white/30"
                : "bg-white text-red-700 hover:bg-neutral-100 animate-pulse"
            }`}
          >
            {muted ? "🔊 Réactiver la sirène SOS" : "🔇 Couper la sirène SOS"}
          </button>
        )}
        {info.phone && (
          <a className="btn-light" href={`tel:${info.phone}`}>
            📞 Appeler {info.name}
          </a>
        )}
        {last && (
          <a className="btn-ghost" href={directionsLink(last)} target="_blank" rel="noreferrer">
            🧭 Itinéraire
          </a>
        )}
        <a className="btn-ghost" href={`tel:${EMERGENCY.police}`}>
          👮 Appeler la police ({EMERGENCY.police})
        </a>
        {onClose && (
          <button className="btn-ghost" onClick={onClose}>
            Fermer (l'alerte reste active)
          </button>
        )}
      </div>
    </div>
  );
}
