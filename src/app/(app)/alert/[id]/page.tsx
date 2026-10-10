import GuardianAlertView from "@/components/GuardianAlertView";

export default async function AlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GuardianAlertView alertId={id} />;
}
