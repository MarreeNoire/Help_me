import type { NotifyContext } from "./types";

/**
 * Prévient les autorités partenaires via webhook (table `authorities`, actives uniquement).
 * Désactivé par défaut : aucune ligne active tant qu'un partenariat officiel n'existe.
 */
export async function notifyAuthorities(ctx: NotifyContext, event: "sos_alert" | "sos_resolved" = "sos_alert") {
  const { data } = await ctx.admin
    .from("authorities")
    .select("id,name,webhook_url")
    .eq("active", true)
    .not("webhook_url", "is", null);

  await Promise.allSettled(
    (data ?? []).map(async (a) => {
      try {
        await fetch(a.webhook_url as string, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            alertId: ctx.alert.id,
            person: { name: ctx.senderName, phone: ctx.senderPhone ?? null },
            trackUrl: ctx.trackUrl,
            location: ctx.location,
            at: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (e) {
        console.error("[authorities]", a.name, e);
      }
    })
  );
}
