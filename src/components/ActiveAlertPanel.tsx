"use client";

import { useState } from "react";
import type { ActiveAlertPayload } from "@/lib/types";
import { EMERGENCY, waShareLink } from "@/lib/utils";

export default function ActiveAlertPanel({
  alert,
  onResolve,
}: {
  alert: ActiveAlertPayload;
  onResolve: () => Promise<void> | void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const manual = alert.contacts.filter((c) => c.phone);
  const hasAuto = alert.contacts.some((c) => c.telegram || c.push);

  async function copy() {
    try {
      await navigator.clipboard.writeText(alert.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function resolve() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 5000);
      return;
    }
    setBusy(true);
    await onResolve();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-red-700 pb-8">
      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="pt-4 text-center">
          <p className="text-5xl">🚨</p>
          <h1 className="mt-2 text-3xl font-extrabold">Alerte envoyée</h1>
          <p className="mt-1 text-white/85">
            Garde l'application ouverte et l'écran allumé : ta position est partagée en direct.
          </p>
        </div>

        <div className="rounded-3xl bg-black/25 p-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">Tes proches</p>
          {alert.contacts.length === 0 && (
            <p className="text-white/80">Aucun proche enregistré. Appelle les secours ci-dessous.</p>
          )}
          <ul className="space-y-2">
            {alert.contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-black/20 p-3">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-white/70">
                    {c.telegram || c.push
                      ? [c.telegram && "Telegram ✅", c.push && "Notification ✅"].filter(Boolean).join(" · ")
                      : c.confirmed
                      ? "Aucun canal automatique joignable"
                      : "Invitation non confirmée"}
                  </p>
                </div>
                {c.waLink && (
                  <a
                    href={c.waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white"
                  >
                    WhatsApp
                  </a>
                )}
                {c.smsLink && (
                  <a href={c.smsLink} className="rounded-xl bg-white/20 px-3 py-2 text-sm font-bold">
                    SMS
                  </a>
                )}
              </li>
            ))}
          </ul>
          {!hasAuto && manual.length > 0 && (
            <p className="mt-3 text-sm text-white/80">
              Aucun proche n'a Telegram ou les notifications : envoie-leur le message avec WhatsApp ou SMS.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <a href={waShareLink(alert.message)} target="_blank" rel="noreferrer" className="btn-green">
            💬 Partager à un groupe WhatsApp
          </a>
          <button onClick={copy} className="btn-ghost">
            {copied ? "✅ Message copié" : "📋 Copier le message + lien de suivi"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <a href={`tel:${EMERGENCY.police}`} className="btn-light flex-col !gap-0 text-sm">
            <span className="text-xl">👮</span>
            Police
            <span className="text-xs font-normal">{EMERGENCY.police}</span>
          </a>
          <a href={`tel:${EMERGENCY.pompiers}`} className="btn-light flex-col !gap-0 text-sm">
            <span className="text-xl">🚒</span>
            Pompiers
            <span className="text-xs font-normal">{EMERGENCY.pompiers}</span>
          </a>
          <a href={`tel:${EMERGENCY.samu}`} className="btn-light flex-col !gap-0 text-sm">
            <span className="text-xl">🚑</span>
            SAMU
            <span className="text-xs font-normal">{EMERGENCY.samu}</span>
          </a>
        </div>

        <button
          onClick={resolve}
          disabled={busy}
          className={`btn w-full ${confirming ? "bg-white text-emerald-700" : "bg-emerald-600 text-white"}`}
        >
          {confirming ? "Appuie encore pour confirmer : je suis en sécurité" : "✅ Je suis en sécurité"}
        </button>
      </div>
    </div>
  );
}
