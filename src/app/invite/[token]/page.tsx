import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import InviteActions from "@/components/InviteActions";

export const metadata: Metadata = {
  title: "Invitation — Help_me",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUuid(token)) notFound();

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("contacts")
    .select("id,name,user_id,confirmed")
    .eq("confirm_token", token)
    .maybeSingle();
  if (!contact) notFound();

  const { data: owner } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", contact.user_id)
    .maybeSingle();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ownerName = owner?.full_name || "Une personne";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-2xl font-black">
          SOS
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">{ownerName} te fait confiance</h1>
        <p className="mt-2 text-white/70">
          Bonjour {contact.name}, <strong>{ownerName}</strong> souhaite t'ajouter comme personne de confiance. Si elle
          a un jour besoin d'aide, tu seras alerté(e) immédiatement avec sa position en direct.
        </p>
        {contact.confirmed && (
          <p className="mt-3 rounded-2xl bg-emerald-600/20 p-2 text-sm text-emerald-300">
            ✅ Tu as déjà accepté. Tu peux ajouter d'autres canaux ci-dessous.
          </p>
        )}
      </div>

      <InviteActions
        token={token}
        loggedIn={Boolean(user)}
        botUsername={process.env.TELEGRAM_BOT_USERNAME || null}
      />

      <Link href="/help/install" className="text-center text-sm text-white/50 underline">
        Comment installer l'application ?
      </Link>
    </main>
  );
}
