"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { unlockAudio } from "@/lib/alarm";
import GuardianAlertView from "./GuardianAlertView";

const KEY = "helpme_dismissed_alerts";

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

/** Écoute en temps réel les alertes des protégés et ouvre un écran rouge plein écran. */
export default function AlertListener({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [alertId, setAlertId] = useState<string | null>(null);
  const dismissed = useRef<Set<string>>(new Set());

  const show = useCallback((id: string) => {
    if (!dismissed.current.has(id)) setAlertId(id);
  }, []);

  // Débloque l'audio dès la première interaction
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Écoute les messages du Service Worker en cas de push
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SOS_ALERT_TRIGGERED" && event.data.alertId) {
        show(event.data.alertId);
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [show]);

  // Interroge l'API gardien toutes les 3 secondes pour détecter immédiatement toute alerte
  useEffect(() => {
    let stop = false;
    async function checkGuardianAlert() {
      try {
        const res = await fetch("/api/guardian/active-alert", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.alertId && !stop) {
            show(data.alertId);
          }
        }
      } catch {
        /* ignore */
      }
    }

    checkGuardianAlert();
    const interval = setInterval(checkGuardianAlert, 3000);

    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [show]);

  useEffect(() => {
    dismissed.current = new Set(readDismissed());

    // Alertes déjà actives au chargement (ex. ouverture depuis une notification)
    supabase
      .from("alerts")
      .select("id")
      .eq("status", "active")
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) show(data[0].id);
      });

    const channel = supabase
      .channel("guardian-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = payload.new as any;
        if (!row || row.user_id === userId) return;
        if (row.status === "active") show(row.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, show]);

  const close = () => {
    if (alertId) {
      dismissed.current.add(alertId);
      try {
        sessionStorage.setItem(KEY, JSON.stringify([...dismissed.current]));
      } catch {
        /* ignore */
      }
    }
    setAlertId(null);
  };

  if (!alertId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-red-800">
      <div className="mx-auto max-w-md">
        <GuardianAlertView alertId={alertId} onClose={close} alarm />
      </div>
    </div>
  );
}
