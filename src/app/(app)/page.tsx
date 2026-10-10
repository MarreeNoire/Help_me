import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SosButton from "@/components/SosButton";
import InstallPwaButton from "@/components/InstallPwaButton";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.full_name) redirect("/onboarding");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id,name,phone")
    .eq("user_id", user.id)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <main className="space-y-6 py-6">
      <header className="px-4">
        <p className="text-white/60">Bonjour,</p>
        <h1 className="text-2xl font-extrabold">{profile.full_name}</h1>
      </header>
      <SosButton
        userName={profile.full_name}
        hasContacts={(contacts ?? []).length > 0}
        fallbackContacts={contacts ?? []}
      />
      <div className="px-4">
        <InstallPwaButton />
      </div>
    </main>
  );
}
