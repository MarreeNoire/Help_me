"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enablePush, pushSupported } from "@/lib/push-client";

export default function InviteActions({
  token,
  loggedIn,
  botUsername,
}: {
  token: string;
  loggedIn: boolean;
  botUsername: string | null;
}) {
  const router = useRouter();
  const [pushDone, setPushDone] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function activatePush() {
    setMsg(null);
    setBusy(true);
    try {
      const sub = await enablePush();
      if (!sub) {
        setMsg("Notifications non autorisées ou non supportées par ce navigateur.");
        return;
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subscription: sub.toJSON() }),
      });
      if (res.ok) setPushDone(true);
      else setMsg("Impossible d'enregistrer les notifications. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setMsg(null);
    setBusy(true);
    try {
      // L'acceptation est un geste utilisateur : on en profite pour demander
      // l'autorisation push et enregistrer l'appareil pour les alertes en arrière-plan.
      let pushReady = false;
      if (pushSupported() && Notification.permission !== "denied") {
        try {
          const sub = await enablePush();
          if (sub) {
            const pushRes = await fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription: sub.toJSON() }),
            });
            pushReady = pushRes.ok;
          }
        } catch {
          // L'acceptation du lien doit rester possible même si le push échoue.
        }
      }

      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setAccepted(true);
        setPushStatus(
          pushReady
            ? "Notifications activées sur cet appareil."
            : !pushSupported()
              ? "Ce navigateur ne prend pas en charge les notifications push ; garde Help_me ouvert pour voir l’alerte."
              : Notification.permission === "denied"
                ? "Les notifications sont bloquées dans les réglages du navigateur ; garde Help_me ouvert pour voir l’alerte."
                : "Autorise les notifications Help_me pour recevoir une alerte quand l’application est fermée."
        );
        setTimeout(() => router.push("/protect"), 1800);
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error === "self_invite" ? "Tu ne peux pas être ton propre proche 😉" : "Échec. Réessaie.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {accepted && (
        <p className="rounded-2xl bg-emerald-600/20 p-3 text-center">
          ✅ Compte lié ! {pushStatus} Redirection…
        </p>
      )}
      {pushDone && (
        <p className="rounded-2xl bg-emerald-600/20 p-3 text-center">
          ✅ Notifications activées. Tu seras alerté(e) sur cet appareil.
        </p>
      )}

      {botUsername && (
        <a
          href={`https://t.me/${botUsername}?start=${token}`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full"
        >
          ✈️ Recevoir les alertes sur Telegram (recommandé)
        </a>
      )}

      {pushSupported() && !pushDone && (
        <button onClick={activatePush} disabled={busy} className="btn-ghost w-full">
          🔔 Activer les notifications sur cet appareil
        </button>
      )}

      {loggedIn ? (
        <button onClick={accept} disabled={busy || accepted} className="btn-ghost w-full">
          {busy ? "Activation en cours…" : "📱 Accepter et activer les alertes Help_me"}
        </button>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn-ghost w-full">
          📱 Me connecter / créer un compte Help_me
        </Link>
      )}

      {msg && <p className="text-center text-sm text-amber-400">{msg}</p>}

      <p className="pt-2 text-center text-xs text-white/50">
        Sur iPhone, les notifications nécessitent iOS 16.4+ et l'ajout de l'application à l'écran d'accueil.
      </p>
    </div>
  );
}
