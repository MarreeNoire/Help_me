"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enablePush, pushSupported } from "@/lib/push-client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [geoOk, setGeoOk] = useState(false);
  const [pushOk, setPushOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.replace("/login");
      setUserId(data.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name,phone")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p?.full_name) setFullName(p.full_name);
      else if (data.user.user_metadata?.full_name) setFullName(data.user.user_metadata.full_name);
      if (p?.phone) setPhone(p.phone);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: fullName.trim(), phone: phone.trim() || null });
    setLoading(false);
    if (error) return setError("Impossible d'enregistrer. Réessaie.");
    setStep(2);
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contacts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cName.trim(), phone: cPhone.trim() || null }),
      });
      setLoading(false);
      if (!res.ok) return setError("Impossible d'ajouter ce proche. Réessaie.");
      setStep(3);
    } catch {
      setLoading(false);
      setError("Erreur réseau. Réessaie.");
    }
  }

  function askGeo() {
    navigator.geolocation.getCurrentPosition(
      () => setGeoOk(true),
      () => setError("Localisation refusée. Active-la dans les réglages du navigateur."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function askPush() {
    const sub = await enablePush();
    if (sub) {
      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      }).catch(() => {});
      setPushOk(true);
    } else {
      setError("Notifications non autorisées ou non supportées.");
    }
  }

  function finish() {
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-semibold text-red-400">Étape {step} sur 3</p>
        <div className="mt-2 h-2 rounded-full bg-white/10">
          <div className="h-2 rounded-full bg-red-600 transition-all" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <form onSubmit={saveProfile} className="space-y-3">
          <h1 className="text-2xl font-extrabold">Qui es-tu ?</h1>
          <p className="text-white/60">Ton nom sera affiché dans les alertes envoyées à tes proches.</p>
          <input className="input" placeholder="Ton nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input className="input" type="tel" placeholder="Ton téléphone (ex. 0707070707)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>Continuer</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={saveContact} className="space-y-3">
          <h1 className="text-2xl font-extrabold">Ton premier proche</h1>
          <p className="text-white/60">La personne de confiance qui sera alertée en premier.</p>
          <input className="input" placeholder="Nom du proche" value={cName} onChange={(e) => setCName(e.target.value)} required />
          <input className="input" type="tel" placeholder="Son téléphone (WhatsApp)" value={cPhone} onChange={(e) => setCPhone(e.target.value)} required />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>Ajouter et continuer</button>
          <button type="button" className="w-full py-2 text-sm text-white/50" onClick={() => setStep(3)}>
            Passer cette étape
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold">Autorisations</h1>
          <p className="text-white/60">Indispensables pour envoyer ta position et recevoir les alertes de tes proches.</p>
          <button className="btn-ghost w-full" onClick={askGeo} disabled={geoOk}>
            {geoOk ? "✅ Localisation autorisée" : "📍 Autoriser la localisation"}
          </button>
          {pushSupported() && (
            <button className="btn-ghost w-full" onClick={askPush} disabled={pushOk}>
              {pushOk ? "✅ Notifications activées" : "🔔 Activer les notifications"}
            </button>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className="btn-primary w-full" onClick={finish}>Terminer</button>
          <p className="text-center text-xs text-white/50">
            Ensuite, invite ton proche depuis l'onglet « Proches » pour qu'il reçoive les alertes (Telegram ou notification).
          </p>
        </div>
      )}
    </div>
  );
}
