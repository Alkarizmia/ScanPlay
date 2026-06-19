# Supabase setup — ScanPlay

## 1. SQL (sync cloud)

Run `supabase/sync-cloud-complete.sql` in the SQL Editor:
https://supabase.com/dashboard/project/makskleablwrmzhtbejc/sql

## 2. Auth par email (production)

See **`EMAIL_AUTH_SETUP.md`** for the full guide (Resend SMTP + Confirm email).

Run `supabase/enable-email-auth.sql` after SMTP is configured.

## 3. Environment variables

Copy `.env.example` to `.env` and set:

```
VITE_SUPABASE_URL=https://makskleablwrmzhtbejc.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon public key>
```

Find the anon key: **Project Settings → API → anon public**

## 4. Vercel

Add the same variables in Vercel → Project → Settings → Environment Variables, then redeploy.

## 5. Behaviour

- **Not logged in**: no local progress (must sign in to play/scan)
- **Logged in**: full sync to Supabase (profile, history, mistakes, stats)
- **Signup**: confirmation email → click link → auto login + sync
