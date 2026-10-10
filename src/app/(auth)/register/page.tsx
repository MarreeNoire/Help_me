import AuthForm from "@/components/AuthForm";
import { safeNext } from "@/lib/utils";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="register" next={safeNext(next)} />;
}
