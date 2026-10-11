"use client";

import { useCallback, useEffect, useState } from "react";
import { enablePush, getPushSubscription, pushSupported } from "@/lib/push-client";

async function register(sub: PushSubscription) {
  const res = await fetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Enregistre l'appareil pour les alertes push, ou affiche un bandeau pour demander la permission. */
export default function PushRegistrar() {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === "granted") {
      getPushSubscription(true)
        .then(async (sub) => {
          if (!sub || !(await register(sub))) {
            setStatus("Notifications autorisées, mais cet appareil n’a pas pu être enregistré pour les alertes Help_me.");
          }
        })
        .catch(() => setStatus("Impossible de préparer les notifications Help_me sur cet appareil."));
    } else if (Notification.permission === "default") {
      setNeedsPermission(true);
    } else {
      setStatus("Les notifications Help_me sont bloquées dans les réglages du navigateur.");
    }
  }, []);

  const activate = useCallback(async () => {
    const sub = await enablePush();
    if (sub) {
      if (await register(sub)) {
        setNeedsPermission(false);
        setStatus("✅ Notifications Help_me activées sur cet appareil.");
      } else {
        setStatus("Autorisation accordée, mais l’appareil n’a pas pu être enregistré. Réessaie.");
      }
    } else if (Notification.permission === "denied") {
      setNeedsPermission(false);
      setStatus("Les notifications Help_me sont bloquées dans les réglages du navigateur.");
    } else {
      setStatus("Impossible d’activer les notifications sur cet appareil.");
    }
  }, []);

  if (!needsPermission && !status) return null;

  return (
    <div className="m-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <span className="flex-1">
        {status ?? "🔔 Autorise les notifications Help_me pour être averti(e) même quand l’application n’est pas ouverte."}
      </span>
      {needsPermission && (
        <button onClick={activate} className="rounded-xl bg-amber-500 px-3 py-2 font-semibold text-black">
          Activer
        </button>
      )}
    </div>
  );
}
