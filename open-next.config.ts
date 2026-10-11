// OpenNext Cloudflare — cache par défaut (incremental cache conservé en mémoire)
// cf https://opennext.js.org/cloudflare/cache
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Pas de KV/RDO/D1 ici : le cache ISR en mémoire suffit pour cette app
  // (pages dynamiques authentifiées, pas de contenu statique régénéré).
});
