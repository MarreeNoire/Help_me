# CLAUDE.md — Contexte du projet Help_me

> Ce fichier est la MÉMOIRE du projet. Tout agent IA (Claude ou autre) qui reprend ce projet doit le lire en entier AVANT de modifier quoi que ce soit, et le METTRE À JOUR après chaque modification importante (section « Journal des modifications » en bas).

## 1. But de l'application

**Help_me** est une application web (PWA) d'alerte SOS. Une personne en danger appuie sur un gros bouton : ses proches sont alertés immédiatement avec sa **position GPS en direct**. Les autorités (police) peuvent être prévenues : par appel en un appui (`tel:`) et, plus tard, par webhook (table `authorities`, désactivée par défaut).

Principe produit : **ultra simple et intuitive**. Un utilisateur paniqué doit comprendre en 2 secondes. Pas de fioritures.

Utilisateur / propriétaire du projet : **LS**, développeur web junior à Abidjan (Côte d'Ivoire). Il préfère : réponses en **français**, guidage pas à pas, solutions complètes et prêtes à exécuter en une seule passe.

## 2. Contrainte majeure : 100 % GRATUIT

Le projet démarre sans budget. **N'introduis AUCUN service payant** (pas de Twilio, Africa's Talking, Firebase payant, Google Maps API, etc.) sans accord explicite de LS.

| Besoin | Solution retenue (gratuite) |
|---|---|
| Framework / hébergement | Next.js 15 (App Router) + Vercel Hobby ou Cloudflare Workers (OpenNext) |
| BDD / Auth / Realtime | Supabase Free |
| Alerte automatique n°1 | Telegram Bot API (avec position en direct) |
| Alerte automatique n°2 | Web Push (lib `web-push`, clés VAPID) |
| Alerte in-app | Supabase Realtime + écran plein écran rouge (proches ayant un compte) |
| Alerte semi-manuelle | Liens `wa.me` (WhatsApp) et `sms:` pré-remplis (l'utilisateur appuie sur « envoyer ») |
| Carte | Leaflet + tuiles OpenStreetMap |
| Auth | Email + mot de passe, Google OAuth (l'OTP SMS de Supabase est payant) |
| Police / pompiers / SAMU | Boutons `tel:` (110 / 180 / 185 — **à vérifier avant mise en production**) |

Évolution prévue : brancher un fournisseur SMS plus tard via `src/lib/notifiers/sms.ts` (stub déjà prévu) sans refonte.

## 3. Stack technique

- Next.js 15 (App Router, route handlers), React 19, TypeScript, Tailwind CSS 3
- Supabase : `@supabase/ssr` (cookies) + `@supabase/supabase-js`
- `web-push` (Web Push / VAPID), `zod` (validation), `leaflet` (carte)
- Pas de lib d'icônes : emojis uniquement.

## 4. Architecture et rôles utilisateur

Chaque compte peut être à la fois :
- **Protégé** : déclenche des alertes, gère ses proches (`/contacts`).
- **Gardien** : proche d'autres personnes. Reçoit les alertes dans l'app (`/protect`, overlay plein écran, `/alert/[id]`).

Un proche SANS compte est alerté par Telegram et/ou Web Push (via `/invite/[token]`) ou par lien WhatsApp/SMS manuel, et suit la position via `/track/[token]` (publique).

### Flux d'alerte
1. `SosButton` : appui long 2 s → compte à rebours 5 s (annulable) → `POST /api/alert/start` avec la position.
2. Serveur : limite 3 alertes/heure, crée `alerts`, enregistre la 1re position, notifie chaque contact **confirmé** (Telegram + Push), appelle les webhooks `authorities` actifs, renvoie la liste des contacts avec liens `wa.me`/`sms:`.
3. Pendant l'alerte : `watchPosition` → `POST /api/alert/location` (≥ 7 s d'intervalle) → insertion + mise à jour Telegram live location. Écran gardé allumé (Wake Lock).
4. Gardiens avec compte : `AlertListener` (Realtime) ouvre l'overlay rouge + sirène + vibration.
5. « Je suis en sécurité » → `POST /api/alert/resolve` → statut `resolved`, arrêt des live locations, message « en sécurité ».
6. Hors ligne / erreur serveur / limite atteinte : mode secours avec liens `wa.me` / `sms:` pré-remplis incluant les coordonnées.

## 5. Arborescence (fichiers clés)

```
supabase/schema.sql            -> SCHÉMA COMPLET à exécuter dans le SQL Editor Supabase (tables, RLS, trigger, Realtime)
public/sw.js                   -> service worker (push + clic notification)
middleware.ts (src/)           -> rafraîchit la session Supabase, protège les pages
src/lib/supabase/{client,server,admin,middleware}.ts
src/lib/notifiers/{index,telegram,push,sms,authorities}.ts   -> envoi des alertes
src/lib/alerts.ts              -> construit la réponse « alerte active » (contacts + liens manuels)
src/lib/{utils,types,alarm,push-client}.ts
src/components/                -> SosButton, ActiveAlertPanel, AlertListener, GuardianAlertView, LiveMap, TrackView, InviteActions, BottomNav, PushRegistrar, ServiceWorkerRegister
src/app/(auth)/login|register  -> connexion / inscription
src/app/onboarding             -> nom, téléphone, 1er proche, permissions
src/app/(app)/                 -> accueil SOS, contacts, history, protect, alert/[id] (avec barre de navigation)
src/app/track/[token]          -> suivi PUBLIC (sans compte)
src/app/invite/[token]         -> invitation PUBLIQUE d'un proche (Telegram, push, compte)
src/app/help/install           -> aide d'installation de la PWA
src/app/api/...                -> alert/{start,location,resolve,active}, track/[token], push/{register,subscribe}, invite/accept, telegram/webhook, health
src/app/icons/[size]           -> icônes PNG générées dynamiquement (next/og)
src/app/manifest.ts            -> manifeste PWA
```

## 6. Modèle de données (résumé, détail dans supabase/schema.sql)

- `profiles` (id = auth.users.id, full_name, phone) — créé par trigger à l'inscription
- `contacts` (user_id = le protégé ; name, phone, priority, confirm_token UUID, confirmed, telegram_chat_id, push_subscription, linked_user_id = compte du gardien)
- `alerts` (user_id, status active|resolved|cancelled, track_token UUID, created_at, resolved_at)
- `alert_locations` (alert_id, lat, lng, accuracy, created_at)
- `alert_messages` (alert_id, contact_id, channel telegram|push, telegram_message_id) — trace des envois
- `push_devices` (user_id, subscription, endpoint unique) — appareils push des comptes
- `authorities` (name, phone, webhook_url, active) — pour intégration police future

RLS activée partout. Les gardiens lisent `alerts`, `alert_locations` et `profiles` des protégés qui les ont confirmés (policies « guardians »). Les pages/API **publiques** (track, invite, telegram webhook, push/subscribe) passent par le client **service_role** côté serveur uniquement.

## 7. Variables d'environnement (voir `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_APP_URL`.
Ne JAMAIS exposer `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `VAPID_PRIVATE_KEY` côté client.

## 8. Lancer le projet

```bash
npm install
cp .env.example .env.local   # puis remplir (Windows: copy .env.example .env.local)
npx web-push generate-vapid-keys   # colle les 2 clés dans .env.local
# Supabase : exécuter supabase/schema.sql ; Auth > Providers > Email : désactiver « Confirm email » pour le MVP
npm run dev   # http://localhost:3000
```
Pour tester le push et la géolocalisation sur téléphone, il faut du HTTPS (déployer sur Vercel ou utiliser un tunnel). `localhost` est accepté sur le PC.

Déploiement Cloudflare Workers (gratuit, alternative à Vercel) :

```bash
npm run cf-deploy        # build OpenNext + déploiement
# Secrets : npx wrangler secret put <NAME> (une fois par variable)
# Vars publiques client (NEXT_PUBLIC_*) : séc de wrangler.jsonc (vars) ou dashboard
```
Le premier déploiement doit être fait PAR LS après `wrangler login` (OAuth navigateur). Config : wrangler.jsonc + open-next.config.ts.

Webhook Telegram (après déploiement) :
`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://TON-DOMAINE/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`

Anti-pause Supabase (gratuit) : tâche cron-job.org sur `https://TON-DOMAINE/api/health` toutes les 12 h (un projet gratuit est mis en pause après 7 jours d'inactivité).

## 9. Règles pour les agents qui modifient le code

- Conserver l'UI **simple** : gros boutons, texte court, contraste fort, mobile-first, en **français**.
- Toute nouvelle table : activer RLS + ajouter la migration dans `supabase/schema.sql`.
- Les tokens (`track_token`, `confirm_token`) restent des UUID non devinables. La position n'est exposée publiquement que tant que l'alerte est `active`.
- Valider les entrées API avec `zod`. Les routes protégées vérifient `supabase.auth.getUser()` et renvoient 401 sinon.
- Les nouveaux canaux de notification s'ajoutent dans `src/lib/notifiers/` en implémentant l'interface `Notifier`.
- Ne pas casser le mode secours (liens `wa.me` / `sms:`).
- Ne pas ajouter de dépendance payante ; privilégier le gratuit.

## 10. Limites connues

- PWA : pas de déclenchement écran verrouillé ni par bouton physique ; la géolocalisation en continu s'arrête si l'app passe en arrière-plan / écran éteint (d'où le Wake Lock). Solution v2 : app native Expo + FCM (gratuit).
- Web Push ne contourne pas le mode silencieux / « Ne pas déranger ». Sur iPhone : iOS 16.4+ et PWA ajoutée à l'écran d'accueil.
- WhatsApp automatique impossible gratuitement : liens `wa.me` à envoyer manuellement.
- Tuiles OpenStreetMap : usage léger uniquement (changer de fournisseur si forte charge).
- Numéros d'urgence (110 / 180 / 185) à vérifier avant production.

## 11. Feuille de route / TODO

- [ ] Priorité des proches modifiable (colonne `priority` existe, pas d'UI)
- [ ] Purge automatique des anciennes `alert_locations` après résolution
- [ ] Minuteur de sécurité (« dead man's switch ») : nécessite un cron gratuit (cron-job.org / GitHub Actions)
- [ ] Intégration réelle d'un webhook d'autorités (table `authorities`)
- [ ] Module SMS optionnel (`notifiers/sms.ts`) quand il y aura un budget
- [ ] App native (Expo) pour déclenchement verrouillé / alertes critiques
- [ ] Tests (e2e du flux d'alerte)

## 12. Journal des modifications

- 2026-10-10 : Ajout du support de déploiement Cloudflare Workers via @opennextjs/cloudflare (wrangler.jsonc, open-next.config.ts, scripts npm cf-preview/cf-deploy). Déploiement effectif à faire par LS (wrangler login).

- 2026-10-09 : Création initiale du projet (structure complète : auth, onboarding, bouton SOS, contacts, notifiers Telegram + Push, suivi live, invitations, réception in-app, PWA, schéma SQL). Code écrit sans exécution locale : lancer `npm install` puis `npm run dev` et corriger d'éventuelles erreurs de build.
