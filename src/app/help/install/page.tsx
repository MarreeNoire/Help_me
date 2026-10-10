import type { Metadata } from "next";
import Link from "next/link";
import InstallPwaButton from "@/components/InstallPwaButton";

export const metadata: Metadata = { title: "Installer Help_me" };

export default function InstallHelpPage() {
  return (
    <main className="mx-auto max-w-md space-y-5 p-6">
      <h1 className="text-2xl font-extrabold">Installer Help_me</h1>
      <p className="text-white/70">
        Help_me s'installe comme une application, sans passer par un store. C'est nécessaire sur iPhone pour recevoir
        les notifications.
      </p>

      <p className="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-200">
        👆 Sur Android/Chrome, le bouton ci-dessous lance l'installation directement. Sur iPhone, il t'explique comment
        faire (Safari n'autorise pas l'installation automatique).
      </p>
      <InstallPwaButton />

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">🤖 Android (Chrome)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>Ouvre le site dans Chrome.</li>
          <li>Touche le menu ⋮ en haut à droite.</li>
          <li>Choisis « Installer l'application » ou « Ajouter à l'écran d'accueil ».</li>
          <li>Ouvre Help_me depuis l'icône SOS rouge, puis autorise les notifications.</li>
        </ol>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">🍎 iPhone (Safari, iOS 16.4 minimum)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>Ouvre le site dans Safari.</li>
          <li>Touche le bouton Partager (carré avec une flèche).</li>
          <li>Choisis « Sur l'écran d'accueil », puis « Ajouter ».</li>
          <li>Ouvre Help_me depuis l'icône créée, puis autorise les notifications.</li>
        </ol>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">✈️ Sans installer : Telegram</h2>
        <p className="text-white/80">
          Si tu as Telegram, ouvre le lien d'invitation reçu et touche « Recevoir les alertes sur Telegram ». C'est le
          moyen le plus simple d'être alerté sans rien installer d'autre.
        </p>
      </section>

      <p className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-200">
        Les notifications ne contournent pas le mode silencieux ou « Ne pas déranger » : pense à autoriser les alertes
        importantes pour Help_me.
      </p>

      <Link href="/" className="btn-primary w-full">
        Retour à l'application
      </Link>
    </main>
  );
}
