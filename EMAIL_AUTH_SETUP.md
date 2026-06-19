# Authentification par email — ScanPlay (Resend + Supabase)

## 1. Resend — domaine + clé API

1. [resend.com](https://resend.com) → workspace **scanplay**
2. **Domains** → ajouter `scanplay.org` → copier les DNS → attendre **Verified**
3. **API keys** → créer / copier la clé `re_...`

---

## 2. Supabase — où aller (Dashboard)

Projet : [makskleablwrmzhtbejc](https://supabase.com/dashboard/project/makskleablwrmzhtbejc)

### A) SMTP — envoi des emails

**Authentication → SMTP Settings**

| Champ | Valeur |
|-------|--------|
| Enable Custom SMTP | **ON** |
| Sender name | `ScanPlay` |
| Sender email | `support@scanplay.org` |
| Host | `smtp.resend.com` |
| Port | **465** (sinon **587**) |
| Username | `resend` |
| Password | clé API Resend `re_...` |

→ **Save**

### B) Confirmation obligatoire

**Authentication → Providers → Email**

- **Confirm email** : **ON**
- **Secure email change** : ON (recommandé)

### C) URLs de redirection

**Authentication → URL Configuration**

| Champ | Valeur |
|-------|--------|
| Site URL | `https://scanplay.org` |
| Redirect URLs | `https://scanplay.org/**` |

→ **Save**

---

## 3. SQL Supabase

Exécuter **`supabase/enable-resend-email-auth.sql`** dans **SQL Editor → Run**.

Ce script :
- supprime l’**auto-confirmation** (qui bloquait les emails)
- garde la création du profil à l’inscription

Si les tables n’existent pas encore, exécute aussi **`supabase/enable-email-auth.sql`** une fois.

---

## 4. Vercel (app ScanPlay)

Pas de SMTP sur Vercel — seulement :

```
VITE_SUPABASE_URL=https://makskleablwrmzhtbejc.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon public>
```

---

## 5. Tester

1. Inscription sur https://scanplay.org avec une **nouvelle** adresse email
2. Message dans l’app : *« Ouvre le lien dans ton email »*
3. Clic sur le lien → connecté
4. Si rien n’arrive : **Supabase → Logs → Auth Logs** + dossier **spam**

---

## Dépannage

| Problème | Fix |
|----------|-----|
| Inscription sans email, connecté direct | `fix-login-unblock.sql` était actif → exécute `enable-resend-email-auth.sql` + Confirm email **ON** |
| « Error sending confirmation email » | Domaine Resend pas Verified, ou mauvaise clé `re_...` dans SMTP Password |
| Email reçu, lien ne marche pas | Redirect URLs : `https://scanplay.org/**` |
| Compte existe, pas confirmé | Bouton **Renvoyer l'email de confirmation** dans l'app |

---

## Flux

```
Inscription → Supabase → SMTP Resend → Email confirmation → Clic lien → Connecté
```
