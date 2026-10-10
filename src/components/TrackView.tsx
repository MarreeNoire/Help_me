"use client";

import { useEffect, useState } from "react";
import LiveMap from "./LiveMap";
import { EMERGENCY, directionsLink, timeAgo } from "@/lib/utils";

type TrackData = {
  status: "active" | "resolved" | "cancelled";
  name: string;
  phone: string | null;
  createdAt: string;
  resolvedAt: string | null;
  locations: { lat: number; lng: number; created_at: string }[];
};

export default function TrackView({ token }: { token: string }) {
  const [data, setData] = useState<TrackData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`/api/track/${token}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!stop) setNotFound(true);
          return;
        }
        if (res.ok && !stop) setData(await res.json());
      } catch {
        /* réseau instable : on réessaie au prochain tour */
      }
    }
    load();
    const id = setInterval(load, 5000);
    const tick = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      stop = true;
      clearInterval(id);
      clearInterval(tick);
    };
  }, [token]);

  if (notFound) {
    return (
      <div className="p-6 text-center">
        <p className="text-5xl">🔍</p>
        <h1 className="mt-3 text-xl font-bold">Lien de suivi introuvable</h1>
        <p className="mt-1 text-white/60">Ce lien n'existe pas ou n'est plus valide.</p>
      </div>
    );
  }

  if (!data) return <p className="p-6 text-center text-white/60">Chargement…</p>;

  const active = data.status === "active";
  const last = data.locations[data.locations.length - 1];

  if (!active) {
    return (
      <div className="p-6 text-center">
        <p className="text-5xl">✅</p>
        <h1 className="mt-3 text-xl font-bold">{data.name} est en sécurité</h1>
        <p className="mt-1 text-white/60">L'alerte est terminée. La position n'est plus partagée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-3xl bg-red-600 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/80">🚨 Alerte en cours</p>
        <h1 className="text-2xl font-extrabold">{data.name} a besoin d'aide</h1>
        <p className="mt-1 text-sm text-white/80">
          Alerte lancée {timeAgo(data.createdAt)}
          {last?.created_at ? ` · dernière position ${timeAgo(last.created_at)}` : " · position en attente…"}
        </p>
      </div>

      {data.locations.length > 0 ? (
        <LiveMap points={data.locations} />
      ) : (
        <div className="card text-center text-white/60">En attente de la position GPS…</div>
      )}

      <div className="grid gap-2">
        {data.phone && (
          <a className="btn-primary" href={`tel:${data.phone}`}>
            📞 Appeler {data.name}
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
      </div>
    </div>
  );
}
