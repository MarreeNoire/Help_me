"use client";

import { useCallback, useEffect, useState } from "react";
import { enablePush, getPushSubscription, pushSupported } from "@/lib/push-client";

async function register(sub: PushSubscription) {
  await fetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  }).catch(() => {});
}

/** Enregistre l'appareil pour les alertes push, ou affiche un bandeau pour demander la permission. */
export default function PushRegistrar() {
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === "granted") {
      getPushSubscription(true).then((sub) => sub && register(sub));
    } else if (Notification.permission === "default") {
      setNeedsPermission(true);
    }
  }, []);

  const activate = useCallback(async () => {
    const sub = await enablePush();
    if (sub) {
      await register(sub);
      setNeedsPermission(false);
    } else if (Notification.permission === "denied") {
      setNeedsPermission(false);
    }
  }, []);

  if (!needsPermission) return null;

  return (
    <div className="m-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <span className="flex-1">🔔 Active les notifications pour recevoir les alertes de tes proches.</span>
      <button onClick={activate} className="rounded-xl bg-amber-500 px-3 py-2 font-semibold text-black">
        Activer
      </button>
    </div>
  );
}
