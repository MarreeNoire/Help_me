import type { Metadata } from "next";
import TrackView from "@/components/TrackView";

export const metadata: Metadata = {
  title: "Suivi d'alerte — Help_me",
  robots: { index: false, follow: false },
};

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <TrackView token={token} />
    </main>
  );
}
