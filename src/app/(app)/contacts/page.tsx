"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/lib/types";
import { appUrl, waLink } from "@/lib/utils";

export default function ContactsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState("Un proche");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
    if (p?.full_name) setMyName(p.full_name);
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    setContacts((data ?? []) as Contact[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    try {
      const res = await fetch("/api/contacts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      if (!res.ok) {
        return setError("Impossible d'ajouter ce proche.");
      }
      setName("");
      setPhone("");
      load();
    } catch {
      setError("Erreur réseau. Réessaie.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce proche ?")) return;
    await supabase.from("contacts").delete().eq("id", id);
    load();
  }

  const inviteUrl = (c: Contact) => `${appUrl()}/invite/${c.confirm_token}`;
  const inviteText = (c: Contact) =>
    `Salut ${c.name}, je t'ajoute comme personne de confiance sur Help_me (application d'alerte SOS). ` +
    `Si j'ai un jour besoin d'aide, tu seras alerté(e) avec ma position. Accepte ici : ${inviteUrl(c)}`;

  async function copy(c: Contact) {
    try {
      await navigator.clipboard.writeText(inviteText(c));
      setCopied(c.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="space-y-5 p-4">
      <h1 className="pt-2 text-2xl font-extrabold">Mes proches</h1>
      <p className="text-sm text-white/60">
        Pour recevoir l’alerte directement dans Help_me, ton proche doit avoir un compte et accepter ton invitation. S’il a déjà un compte avec ce numéro, il sera relié automatiquement. WhatsApp sert seulement à partager l’invitation, et reste facultatif.
      </p>

      <form onSubmit={add} className="card space-y-3">
        <input className="input" placeholder="Nom du proche" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" type="tel" placeholder="Téléphone du proche (facultatif)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="btn-primary w-full">➕ Ajouter</button>
      </form>

      {loading && <p className="text-center text-white/50">Chargement…</p>}

      <ul className="space-y-3">
        {contacts.map((c) => (
          <li key={c.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{c.name}</p>
                {c.phone && <p className="text-sm text-white/60">{c.phone}</p>}
              </div>
              <button onClick={() => remove(c.id)} aria-label="Supprimer" className="text-xl opacity-70">
                🗑️
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className={`badge ${c.confirmed ? "!bg-emerald-600/30 !text-emerald-300" : "!bg-amber-500/20 !text-amber-300"}`}>
                {c.confirmed ? "✅ Confirmé" : "⏳ En attente"}
              </span>
              {c.linked_user_id && <span className="badge">📱 Help_me</span>}
              {c.telegram_chat_id && <span className="badge">✈️ Telegram</span>}
              {c.push_subscription && <span className="badge">🔔 Notif.</span>}
            </div>

            {!c.confirmed && (
              <div className="grid grid-cols-2 gap-2">
                <a
                  className="btn-green !py-2 text-sm"
                  target="_blank"
                  rel="noreferrer"
                  href={c.phone ? waLink(c.phone, inviteText(c)) : `https://wa.me/?text=${encodeURIComponent(inviteText(c))}`}
                >
                  💬 Inviter
                </a>
                <button className="btn-ghost !py-2 text-sm" onClick={() => copy(c)}>
                  {copied === c.id ? "✅ Copié" : "📋 Copier"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {!loading && contacts.length === 0 && (
        <p className="text-center text-white/50">Aucun proche pour le moment.</p>
      )}
      <span className="hidden">{myName}</span>
    </main>
  );
}
