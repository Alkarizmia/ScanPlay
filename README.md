# ScanPlay

**Snap your sheet. Play to learn.**

ScanPlay transforme une photo de fiche en parcours de mini-jeux (flashcards, quiz, écoute, oral, etc.) — style ludique type Duolingo.

## Lancer l'app

```bash
cd ScanPlay
npm install
npm run dev
```

## Fonctionnalités

- **Navigation** : Accueil · Boutique · Amis · Historique · Profil · Plus
- **Import** : caméra, fichier, multi-photos (selon plan)
- **8 types de jeux** + parcours par étapes + mode **Examen** (Pro)
- **Plans** Free / Plus / Pro avec **Stripe** (checkout + portail abonnement)
- **Sync cloud** Supabase (historique, stats, amis, multijoueur)
- **1 scan invité** sans compte (OCR local) — connexion pour sauvegarder
- **Synthèse IA** (OpenAI via Edge Functions)
- PWA installable · i18n FR / EN / NL / ES

## Plans

| | Free | Plus | Pro |
|---|:---:|:---:|:---:|
| Scans/jour | 3 | ∞ | ∞ |
| Mots/scan | 15 | 50 | 100 |
| Historique rejouable | 1 | 2 | 3 |
| Synthèses/mois | 2 | 15 | 40 |
| Mode Examen | — | — | ✓ |

## Configuration

- **Supabase** : `SUPABASE_SETUP.md`
- **Stripe** : `STRIPE_SETUP.md`
- **Google OAuth** : `GOOGLE_OAUTH_SETUP.md`
- **Emails auth** : `EMAIL_AUTH_SETUP.md`

Variables front (`.env`) :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AI_SCAN=1
VITE_STRIPE_CHECKOUT=1
VITE_GOOGLE_CLIENT_ID=...   # branding Google « ScanPlay »
VITE_SPEECH_SERVER=1        # oral serveur Groq (optionnel)
```

## Tests & CI

```bash
npm test
npm run lint
npm run build
```

GitHub Actions : `.github/workflows/ci.yml`

## Déploiement

- **Vercel** : `vercel.json` — variables d'environnement + `SUPABASE_SERVICE_ROLE_KEY` pour webhooks et suppression de compte
- **Edge Functions** : `supabase functions deploy analyze-sheet` et `generate-synthesis` (quotas serveur)
