"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }
      router.replace(next);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next === "/" ? "/onboarding" : next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      router.replace(next === "/" ? "/onboarding" : next);
      router.refresh();
    } else {
      setInfo("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
      setLoading(false);
    }
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-2xl font-black">
          SOS
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">Help_me</h1>
        <p className="mt-1 text-white/60">Un bouton pour alerter tes proches.</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {!isLogin && (
          <input
            className="input"
            placeholder="Ton nom complet"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className="input"
          type="password"
          placeholder="Mot de passe (6 caractères min.)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={isLogin ? "current-password" : "new-password"}
        />

        {error && <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-300">{error}</p>}
        {info && <p className="rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-300">{info}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Patiente…" : isLogin ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>

      <button onClick={google} className="btn-ghost w-full">
        <span className="font-bold">G</span> Continuer avec Google
      </button>

      <p className="text-center text-sm text-white/60">
        {isLogin ? (
          <>
            Pas de compte ?{" "}
            <Link className="font-semibold text-red-400" href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
              Créer un compte
            </Link>
          </>
        ) : (
          <>
            Déjà un compte ?{" "}
            <Link className="font-semibold text-red-400" href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
              Se connecter
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
