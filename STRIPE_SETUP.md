# ScanPlay — Stripe + Vercel

Guide pour relier les plans **Plus** et **Pro** à Stripe sur [scanplay.org](https://scanplay.org).

## Architecture

1. L'utilisateur choisit Plus/Pro → **Stripe Checkout** (page hébergée par Stripe).
2. Après paiement, **Stripe webhook** → met à jour `scanplay_profiles.plan` dans Supabase.
3. L'app **pull** le plan au retour (`?stripe=success`) — plus de paiement simulé si `VITE_STRIPE_CHECKOUT=1`.

Fichiers ajoutés :

| Fichier | Rôle |
|---------|------|
| `api/create-checkout-session.ts` | Crée la session Checkout |
| `api/create-portal-session.ts` | Portail client (gérer / annuler) |
| `api/stripe-webhook.ts` | Reçoit les événements Stripe |
| `supabase/stripe-subscription.sql` | Colonnes `stripe_*` en base |

---

## 1. Stripe Dashboard

### Compte & mode test

1. [dashboard.stripe.com](https://dashboard.stripe.com) → activer **Mode test**.
2. **Developers → API keys** : note la clé secrète `sk_test_...`.

### Produits & prix (4 prix)

Crée **2 produits** avec prix **récurrents** en **EUR** :

| Produit | Mensuel | Annuel |
|---------|---------|--------|
| **ScanPlay Plus** | 4,99 € / mois | 49,99 € / an |
| **ScanPlay Pro** | 9,99 € / mois | 99,99 € / an |

**Descriptions à coller dans Stripe (Products → Description)** :

**ScanPlay Plus**  
Scans illimités, fiches jusqu'à 50 mots, historique illimité, révision espacée, export flashcards, stats détaillées, 15 synthèses IA par mois et parcours 15 étapes. Idéal pour réviser chaque jour sans limite.

**ScanPlay Pro**  
Tout ScanPlay Plus, plus : 100 mots par scan, parcours 20 étapes, 40 synthèses IA par mois, mode examen chronométré, partage de decks et rejouer les 2 dernières fiches. Pour viser la mention et les contrôles.

Pour chaque prix, copie l'ID `price_xxxxxxxx` (pas le `prod_`).

### Portail client

**Settings → Billing → Customer portal** : active le portail (annulation, changement de plan si tu veux).

### Compte Stripe partagé (ex. PayPuls + ScanPlay)

Si plusieurs SaaS utilisent le **même compte Stripe**, le Dashboard applique le branding et les moyens de paiement globaux (logo PayPuls, PayPal, etc.).

ScanPlay force dans `api/create-checkout-session.ts` :

- **Carte uniquement** (`payment_method_types: ['card']`) — PayPal reste actif pour tes autres produits
- **Branding ScanPlay** par session : nom **ScanPlay**, icône verte ScanPlay (upload Stripe), couleurs ScanPlay
- **Produits** renommés automatiquement en **ScanPlay Plus** / **ScanPlay Pro** pour les `price_` configurés dans Vercel

Dans Stripe Dashboard, crée des produits **dédiés ScanPlay** (pas les prix PayPuls) et mets les bons `STRIPE_PRICE_*` dans Vercel.

Optionnel : `STRIPE_SCANPLAY_ICON_FILE=file_...` si tu as déjà uploadé l’icône dans Stripe (évite un upload à chaque cold start).

Pour une séparation totale à long terme : un compte Stripe par produit.

### Codes promo

**Products → Coupons** (ou **Billing → Coupons**) : crée ton coupon + code promotionnel.

Sur la page Stripe Checkout, le champ apparaît via **« Ajouter un code promotionnel »** (activé dans ScanPlay avec `allow_promotion_codes`).

Le code doit être **actif**, dans la bonne **devise (EUR)** et applicable aux **abonnements** Plus/Pro.

### Webhook

**Developers → Webhooks → Add endpoint**

- **URL** : `https://scanplay.org/api/stripe-webhook`
- **Événements** :
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copie le **Signing secret** `whsec_...`

En local (optionnel) :

```bash
stripe listen --forward-to localhost:5173/api/stripe-webhook
```

### Colonnes abonnement (Supabase)

Exécute aussi les nouvelles colonnes dans `supabase/stripe-subscription.sql` :

- `subscription_period_end` — date de fin / renouvellement
- `subscription_cancel_at_period_end` — renouvellement annulé ou non

### Synchronisation après paiement

L’app appelle `/api/sync-subscription` au retour de Stripe (avec `session_id`) et à chaque synchronisation cloud. Si le webhook est en retard, le plan est quand même mis à jour.

Variables **obligatoires** côté Vercel :

- `SUPABASE_SERVICE_ROLE_KEY` (sinon le webhook ne peut pas écrire le plan)
- `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL` (doivent correspondre aux prix réellement payés)

---

## 2. Supabase

Exécute une fois dans **SQL Editor** :

```text
supabase/stripe-subscription.sql
```

Récupère la **service_role key** : Project Settings → API → `service_role` (secret, jamais côté client).

---

## 3. Variables Vercel

**Project → Settings → Environment Variables**

### Côté client (déjà présentes + nouvelle)

| Variable | Exemple | Environnements |
|----------|---------|----------------|
| `VITE_SUPABASE_URL` | `https://makskleablwrmzhtbejc.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon) | Production, Preview |
| `VITE_STRIPE_CHECKOUT` | `1` | Production ( `0` en preview si tu veux tester sans payer) |

### Côté serveur uniquement (jamais `VITE_`)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` puis `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` du endpoint production |
| `STRIPE_PRICE_PLUS_MONTHLY` | `price_...` |
| `STRIPE_PRICE_PLUS_ANNUAL` | `price_...` |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_...` |
| `STRIPE_PRICE_PRO_ANNUAL` | `price_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Obligatoire** — Supabase → Settings → API → `service_role` (secret) |
| `SUPABASE_URL` | Optionnel si `VITE_SUPABASE_URL` déjà dans Vercel |
| `APP_URL` | `https://scanplay.org` |

Optionnel (si tu ne dupliques pas les `VITE_*`) :

- `SUPABASE_URL` = même URL que `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` = même que `VITE_SUPABASE_ANON_KEY`

### Récap minimal Production

```env
# Client
VITE_SUPABASE_URL=https://makskleablwrmzhtbejc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_CHECKOUT=1

# Serveur (API /api/*)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS_MONTHLY=price_...
STRIPE_PRICE_PLUS_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
APP_URL=https://scanplay.org
```

Après modification : **Redeploy** le projet Vercel.

---

## 4. Tester

1. `VITE_STRIPE_CHECKOUT=1` + clés **test** Stripe.
2. Carte test : `4242 4242 4242 4242`, date future, CVC quelconque.
3. Vérifie dans Supabase : `scanplay_profiles.plan` = `plus` ou `pro`.
4. Webhook : Stripe Dashboard → Webhooks → voir les deliveries `200`.

---

## 5. Passer en live

1. Stripe → désactiver le mode test.
2. Recréer les 4 prix en live (ou activer les produits).
3. Nouveau webhook sur `https://scanplay.org/api/stripe-webhook` avec `whsec_` live.
4. Remplacer `sk_test_` par `sk_live_` et les `price_` live dans Vercel.
5. Vérifier **Customer portal** et mentions légales / CGV sur le site.

---

## Sécurité

- **Ne jamais** committer `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
- Le plan n’est plus poussé depuis le client quand `VITE_STRIPE_CHECKOUT=1` — seul le webhook modifie `plan`.
- En dev sans API Vercel, le paiement reste **simulé** (`VITE_STRIPE_CHECKOUT=0`).

---

## Dépannage

| Problème | Cause probable |
|----------|----------------|
| « Paiement pas encore activé » | Price IDs manquants ou `STRIPE_SECRET_KEY` absente |
| Plan pas mis à jour | Webhook 4xx/5xx — vérifier `STRIPE_WEBHOOK_SECRET` et SQL exécuté |
| « Erreur serveur au paiement » sur Gérer mon abonnement | Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans Vercel puis redéployer |
| 401 au checkout | Utilisateur non connecté |
| Webhook signature invalid | Mauvais `whsec_` ou body modifié par un proxy |
