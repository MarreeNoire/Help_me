import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import AlertListener from "@/components/AlertListener";
import PushRegistrar from "@/components/PushRegistrar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <PushRegistrar />
      {children}
      <BottomNav />
      <AlertListener userId={user.id} />
    </div>
  );
}
