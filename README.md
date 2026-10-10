# Help_me 🆘

Application web (PWA) d'alerte SOS : un bouton, et tes proches sont alertés avec ta position en direct.
100 % gratuit : Next.js + Supabase Free + Telegram Bot + Web Push + OpenStreetMap.

> Contexte complet du projet, décisions et règles : voir **CLAUDE.md**.

## Démarrage rapide

```bash
npm install
copy .env.example .env.local      # (macOS/Linux : cp .env.example .env.local)
npx web-push generate-vapid-keys  # copie les 2 clés dans .env.local
npm run dev                       # http://localhost:3000
```

## Configuration (une seule fois)

1. **Supabase** (supabase.com, plan gratuit) : crée un projet, ouvre *SQL Editor*, colle et exécute `supabase/schema.sql`.
   - *Authentication > Providers > Email* : désactive « Confirm email » pour le MVP.
   - *Project Settings > API* : copie l'URL, la clé `anon` et la clé `service_role` dans `.env.local`.
   - (Optionnel) Active Google dans *Authentication > Providers*.
2. **Telegram** : dans Telegram, ouvre `@BotFather`, envoie `/newbot`, copie le token et le nom d'utilisateur du bot dans `.env.local`.
3. **Clés push** : `npx web-push generate-vapid-keys` puis `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`.
4. **URL** : `NEXT_PUBLIC_APP_URL` = l'adresse publique de l'app (sans slash final).

## Déploiement (Vercel, gratuit)

1. Pousse le dossier sur GitHub, importe le dépôt dans Vercel.
2. Ajoute toutes les variables de `.env.example` dans *Settings > Environment Variables*.
3. Enregistre le webhook Telegram (remplace les valeurs) :
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://TON-DOMAINE/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`
4. Sur cron-job.org (gratuit), crée une tâche toutes les 12 h sur `https://TON-DOMAINE/api/health` pour éviter la pause de Supabase.

Le HTTPS est obligatoire pour la géolocalisation et les notifications sur téléphone.

## Tester

1. Crée deux comptes (deux téléphones ou un téléphone + un PC).
2. Compte A : ajoute le compte B comme proche, copie le lien d'invitation, ouvre-le avec le compte B connecté et accepte.
3. Compte A : maintiens le bouton SOS 2 secondes. Le compte B doit voir l'écran rouge avec la carte.
4. Teste aussi avec un proche sans compte via Telegram.
