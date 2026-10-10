import { createClient } from "@supabase/supabase-js";

/**
 * Client SERVICE ROLE : contourne la RLS.
 * À utiliser UNIQUEMENT côté serveur (routes API, Server Components).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export type AdminClient = ReturnType<typeof createAdminClient>;
