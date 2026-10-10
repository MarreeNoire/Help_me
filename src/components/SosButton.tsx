"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveAlertPayload, FallbackContact, LatLng } from "@/lib/types";
import { EMERGENCY, buildAlertMessage, smsLink, waLink, waShareLink } from "@/lib/utils";
import ActiveAlertPanel from "./ActiveAlertPanel";

type Phase = "idle" | "holding" | "countdown" | "sending" | "active" | "offline";

const HOLD_MS = 2000;
const COUNTDOWN_S = 5;
const SEND_INTERVAL_MS = 7000;
const RING_R = 130;
const RING_C = 2 * Math.PI * RING_R;

function getPosition(timeoutMs: number): Promise<(LatLng & { accuracy: number }) | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10000 }
    );
  });
}

export default function SosButton({
  userName,
  hasContacts,
  fallbackContacts,
}: {
  userName: string;
  hasContacts: boolean;
  fallbackContacts: FallbackContact[];
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [count, setCount] = useState(COUNTDOWN_S);
  const [alert, setAlert] = useState<ActiveAlertPayload | null>(null);
  const [offlineInfo, setOfflineInfo] = useState<{ pos: LatLng | null; reason: string } | null>(null);

  const holdStart = useRef(0);
  const raf = useRef(0);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wake = useRef<any>(null);

  /* ---------- Suivi GPS pendant l'alerte ---------- */
  const startTracking = useCallback((alertId: string) => {
    if ("geolocation" in navigator && watchId.current === null) {
      watchId.current = navigator.geolocation.watchPosition(
        (p) => {
          const now = Date.now();
          if (now - lastSent.current < SEND_INTERVAL_MS) return;
          lastSent.current = now;
          fetch("/api/alert/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              alertId,
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracy: p.coords.accuracy,
            }),
            keepalive: true,
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
      );
    }
    // Garde l'écran allumé (sinon le GPS s'arrête)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    nav.wakeLock?.request("screen").then((w: unknown) => (wake.current = w)).catch(() => {});
  }, []);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    try {
      wake.current?.release?.();
    } catch {
      /* ignore */
    }
    wake.current = null;
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  /* ---------- Reprise d'une alerte active après rechargement ---------- */
  useEffect(() => {
    fetch("/api/alert/active", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.alert) {
          setAlert(d.alert);
          setPhase("active");
          startTracking(d.alert.alertId);
        }
      })
      .catch(() => {});
  }, [startTracking]);

  /* ---------- Déclenchement ---------- */
  async function trigger() {
    setPhase("sending");
    const pos = await getPosition(6000);
    try {
      const res = await fetch("/api/alert/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : {}),
      });
      if (res.status === 429) {
        setOfflineInfo({
          pos,
          reason: "Limite d'alertes atteinte (3 par heure). Utilise les boutons ci-dessous.",
        });
        setPhase("offline");
        return;
      }
      if (!res.ok) throw new Error("server");
      const data: ActiveAlertPayload = await res.json();
      setAlert(data);
      setPhase("active");
      startTracking(data.alertId);
    } catch {
      setOfflineInfo({
        pos,
        reason: "Impossible de joindre le serveur. Envoie l'alerte manuellement :",
      });
      setPhase("offline");
    }
  }

  async function resolve() {
    if (alert) {
      await fetch("/api/alert/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.alertId }),
      }).catch(() => {});
    }
    stopTracking();
    setAlert(null);
    setPhase("idle");
  }

  /* ---------- Appui long ---------- */
  function cancelHold(reset = true) {
    cancelAnimationFrame(raf.current);
    if (reset) {
      setPhase("idle");
      setProgress(0);
    }
  }

  function startHold() {
    if (phase !== "idle") return;
    setPhase("holding");
    holdStart.current = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        cancelHold(false);
        if (navigator.vibrate) navigator.vibrate(200);
        setCount(COUNTDOWN_S);
        setPhase("countdown");
      } else {
        raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);
  }

  /* ---------- Compte à rebours ---------- */
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      void trigger();
      return;
    }
    const t = setTimeout(() => {
      setCount((c) => c - 1);
      if (navigator.vibrate) navigator.vibrate(80);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count]);

  /* ---------- Rendus ---------- */
  if (phase === "active" && alert) return <ActiveAlertPanel alert={alert} onResolve={resolve} />;

  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-700 p-6 text-center">
        <p className="text-lg font-semibold">Envoi de l'alerte dans</p>
        <p className="my-6 text-[9rem] font-black leading-none">{Math.max(count, 0)}</p>
        <button
          onClick={() => {
            setPhase("idle");
            setProgress(0);
          }}
          className="w-full max-w-xs rounded-3xl bg-white py-6 text-2xl font-extrabold text-red-700"
        >
          ANNULER
        </button>
      </div>
    );
  }

  if (phase === "sending") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-700 p-6 text-center">
        <p className="text-5xl">📡</p>
        <p className="mt-4 text-2xl font-bold">Envoi de l'alerte…</p>
        <p className="mt-1 text-white/80">Récupération de ta position et notification de tes proches.</p>
      </div>
    );
  }

  if (phase === "offline" && offlineInfo) {
    const msg = buildAlertMessage(userName, null, offlineInfo.pos);
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-red-700">
        <div className="mx-auto max-w-md space-y-4 p-4">
          <div className="pt-4 text-center">
            <p className="text-5xl">⚠️</p>
            <h1 className="mt-2 text-2xl font-extrabold">Mode secours</h1>
            <p className="mt-1 text-white/85">{offlineInfo.reason}</p>
          </div>

          <div className="rounded-3xl bg-black/25 p-4">
            <ul className="space-y-2">
              {fallbackContacts.length === 0 && <li className="text-white/80">Aucun proche enregistré.</li>}
              {fallbackContacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-black/20 p-3">
                  <span className="font-semibold">{c.name}</span>
                  {c.phone && (
                    <span className="flex gap-2">
                      <a
                        href={waLink(c.phone, msg)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold"
                      >
                        WhatsApp
                      </a>
                      <a href={smsLink(c.phone, msg)} className="rounded-xl bg-white/20 px-3 py-2 text-sm font-bold">
                        SMS
                      </a>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <a href={waShareLink(msg)} target="_blank" rel="noreferrer" className="btn-green w-full">
            💬 Partager à un groupe WhatsApp
          </a>

          <div className="grid grid-cols-3 gap-2">
            <a href={`tel:${EMERGENCY.police}`} className="btn-light">👮 Police</a>
            <a href={`tel:${EMERGENCY.pompiers}`} className="btn-light">🚒 Pompiers</a>
            <a href={`tel:${EMERGENCY.samu}`} className="btn-light">🚑 SAMU</a>
          </div>

          <div className="grid gap-2">
            <button className="btn-ghost" onClick={() => void trigger()}>
              🔄 Réessayer l'envoi
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setOfflineInfo(null);
                setPhase("idle");
                setProgress(0);
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // idle / holding
  const holding = phase === "holding";
  return (
    <div className="flex flex-col items-center gap-6 px-4">
      {!hasContacts && (
        <a
          href="/contacts"
          className="w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-sm"
        >
          👥 Ajoute au moins un proche pour qu'il soit alerté →
        </a>
      )}

      <div className="relative flex h-72 w-72 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 288 288">
          <circle cx="144" cy="144" r={RING_R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
          <circle
            cx="144"
            cy="144"
            r={RING_R}
            fill="none"
            stroke="#fff"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
          />
        </svg>
        <button
          aria-label="Bouton SOS : maintiens appuyé 2 secondes"
          onPointerDown={startHold}
          onPointerUp={() => holding && cancelHold()}
          onPointerLeave={() => holding && cancelHold()}
          onPointerCancel={() => holding && cancelHold()}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}
          className={`flex h-56 w-56 items-center justify-center rounded-full bg-red-600 text-6xl font-black tracking-tight shadow-2xl transition-transform ${
            holding ? "scale-95 bg-red-500" : "sos-idle"
          }`}
        >
          SOS
        </button>
      </div>

      <p className="text-center text-white/70">
        {holding ? "Continue d'appuyer…" : "Maintiens le bouton appuyé 2 secondes"}
      </p>

      <div className="grid w-full grid-cols-3 gap-2">
        <a href={`tel:${EMERGENCY.police}`} className="btn-ghost flex-col !gap-0 text-sm">
          <span className="text-xl">👮</span>Police
        </a>
        <a href={`tel:${EMERGENCY.pompiers}`} className="btn-ghost flex-col !gap-0 text-sm">
          <span className="text-xl">🚒</span>Pompiers
        </a>
        <a href={`tel:${EMERGENCY.samu}`} className="btn-ghost flex-col !gap-0 text-sm">
          <span className="text-xl">🚑</span>SAMU
        </a>
      </div>
    </div>
  );
}
