# Connexion Google — afficher « ScanPlay » (pas supabase.co)

Quand Google affiche **« Accéder à l'application makskleablwrmzhtbejc.supabase.co »**, c'est normal tant que le **branding OAuth** n'est pas configuré et vérifié.

## Étapes (une seule fois)

### 1. Google Cloud Console

1. Ouvre [Google Cloud Console](https://console.cloud.google.com/) → crée ou sélectionne un projet **ScanPlay**.
2. **APIs & Services → OAuth consent screen (Branding)** :
   - Type : **External**
   - **App name** : `ScanPlay`
   - **User support email** : ton email
   - **App logo** : logo ScanPlay (carré, min. 120×120)
   - **App domain** → Authorized domains : `scanplay.org`
   - **Homepage** : `https://www.scanplay.org`
   - **Privacy policy** : `https://www.scanplay.org/privacy.html`
3. **Data Access (Scopes)** : garde `openid`, `email`, `profile`.
4. **Clients → Create client → Web application** :
   - Name : `ScanPlay Web`
   - **Authorized JavaScript origins** :
     - `https://www.scanplay.org`
     - `https://scanplay.org`
     - `http://localhost:5173` (dev)
   - **Authorized redirect URIs** :
     - `https://makskleablwrmzhtbejc.supabase.co/auth/v1/callback`
     - `http://127.0.0.1:54321/auth/v1/callback` (optionnel, CLI locale)
5. Copie le **Client ID** et le **Client Secret**.

### 2. Vérification du branding Google

Sans validation Google, l'écran de connexion peut afficher uniquement le **domaine** (supabase.co).

1. Dans **Branding**, clique **Submit for verification** / **Verify branding**.
2. Vérifie la propriété de `scanplay.org` dans [Google Search Console](https://search.google.com/search-console).
3. Délai habituel : **2 à 5 jours ouvrés**.

Après approbation, les utilisateurs verront **« Accéder à l'application ScanPlay »**.

### 3. Supabase

[Dashboard → Authentication → Providers → Google](https://supabase.com/dashboard/project/makskleablwrmzhtbejc/auth/providers)

- Enable Google
- Colle **Client ID** et **Client Secret** (pas les laisser vides)
- Save

**Authentication → URL Configuration** :

- Site URL : `https://www.scanplay.org`
- Redirect URLs : `https://www.scanplay.org/**`, `https://scanplay.org/**`, `http://localhost:5173/**`

### 4. Vercel (variables d'environnement)

Ajoute puis **redéploie** :

```
VITE_GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
```

Le Client ID est **public** (côté navigateur). Le secret reste **uniquement** dans Supabase.

L'app utilise ce Client ID pour `signInWithIdToken` : la connexion part de **scanplay.org** au lieu du redirect Supabase.

### 5. (Optionnel) Domaine auth personnalisé Supabase

Sur un plan Supabase payant, tu peux configurer `auth.scanplay.org` pour renforcer la confiance. Voir [Supabase custom domains](https://supabase.com/docs/guides/platform/custom-domains).

## Vérification

1. Redéploie Vercel avec `VITE_GOOGLE_CLIENT_ID`.
2. Ouvre **www.scanplay.org** → Connexion → Google.
3. Tu dois voir le panneau **ScanPlay** puis le compte Google.
4. Après validation Google : le libellé devient **ScanPlay** au lieu de `supabase.co`.

## Dépannage

| Problème | Solution |
|----------|----------|
| Toujours `supabase.co` | Branding non vérifié chez Google, ou mauvais Client ID dans Supabase |
| `redirect_uri_mismatch` | URI callback Supabase manquante dans Google Cloud |
| `origin_mismatch` | Ajoute `https://www.scanplay.org` dans JavaScript origins |
| Bouton Google ne répond pas | Vérifie `VITE_GOOGLE_CLIENT_ID` sur Vercel + redeploy |
