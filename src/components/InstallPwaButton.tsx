"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectStandalone(): boolean {
  if (typeof window === "undefined") return true; // SSR : on cache le bouton
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS iPhone/iPad : pas d'event beforeinstallprompt, on détecte ainsi
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Bouton « Télécharger l'application » :
 * - si la PWA est déjà installée → le bouton disparaît
 * - Android/Chrome (beforeinstallprompt) → prompt d'installation natif en 1 clic
 * - iPhone/Safari → renvoie vers /help/install (pas de prompt natif possible)
 */
export default function InstallPwaButton() {
  const [installed, setInstalled] = useState(true); // SSR par défaut : caché, évite les flashs
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(detectStandalone());
    setIos(isIos());

    const onInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    // Pas de prompt natif (ex. iPhone) : on guide l'utilisateur
    window.location.href = "/help/install";
  };

  const label = ios && !installPrompt ? "📲 Installer sur l'écran d'accueil" : "⬇️ Télécharger l'application";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/90 active:scale-[0.98]"
    >
      {label}
    </button>
  );
}
