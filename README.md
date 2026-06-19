# ScanPlay

**Snap your sheet. Play to learn.**

ScanPlay transforme une photo de fiche en mini-jeux (Flashcards, Quiz, Match) — style ludique type Duolingo.

## Lancer l'app

```bash
npm install
npm run dev
```

Ou double-clique `start-scanplay.bat` (Windows).

## Tester sur téléphone

1. **Lance le serveur sur le PC** avec accès réseau :
   ```bash
   npm run dev
   ```
   (ou `start-scanplay.bat` — affiche les URLs automatiquement)

2. **Même Wi‑Fi** : PC et téléphone sur le même réseau (pas la 4G seule).

3. **Ouvre l’URL Network** sur le téléphone, par ex. `http://192.168.1.42:5173`
   (l’IP exacte s’affiche dans le terminal sous `Network:`).

**Plan B** (version build) :
```bash
npm run build
npm run preview:mobile
```
Puis ouvre l’URL affichée (port **4173**).

## Fonctionnalités

- Navigation : **Accueil** · **Historique** · **Paramètres**
- Import : **Caméra** ou **Fichier**
- Gamification : XP, niveaux, streak 🔥, mascotte
- OCR client (Tesseract.js) + **analyse IA** (OpenAI via Supabase Edge Function, fallback OCR)
- 3 modes de jeu + Mode Express (60s)
- Plans Free / Plus / Pro (limites + upgrade UI)

## Plans

| | Free | Plus | Pro |
|---|:---:|:---:|:---:|
| Scans/jour | 3 | ∞ | ∞ |
| Mots/scan | 15 | 50 | 100 |
| Historique | 7 | ∞ | ∞ |
| Révision espacée | — | ✓ | ✓ |
| Export flashcards | — | ✓ | ✓ |
| Mode Examen / Partage | — | — | ✓ |
| Prix (UI) | 0 € | 4,99 €/mois | 9,99 €/mois |

Paiement **simulé** au MVP (pas de Stripe).

## Analyse IA des fiches (OpenAI)

1. Installe la [Supabase CLI](https://supabase.com/docs/guides/cli)
2. Lie le projet : `supabase link --project-ref TON_REF`
3. Déploie la fonction :
   ```bash
   supabase functions deploy analyze-sheet
   ```
4. Configure les secrets :
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   # Optionnel : supabase secrets set OPENAI_MODEL=gpt-4o
   ```
5. Dans `.env` du front :
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   VITE_AI_SCAN=1
   ```

**Flux** : l'app appelle d'abord l'IA (si Supabase + utilisateur connecté). Si échec ou fiche illisible → fallback Tesseract local.

Pour désactiver l'IA : `VITE_AI_SCAN=0`

## Tester les plans (mode dev)

1. Ouvre **Paramètres**
2. Section **Plan (test dev)** en bas
3. Choisis **Free**, **Plus** ou **Pro**
4. Free : après 3 scans le même jour → modal upgrade

## Build

```bash
npm run build
npm run preview
```

## Logo

Mascotte feuille + yeux + play — fichiers fixes dans `public/logo.svg` et `src/components/Logo.tsx`.
