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
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setAccepted(true);
        setTimeout(() => router.push("/protect"), 800);
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
      {accepted && <p className="rounded-2xl bg-emerald-600/20 p-3 text-center">✅ Compte lié ! Redirection…</p>}
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
          📱 Recevoir aussi dans l'application (mon compte)
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
