-- ============================================================
-- ScanPlay : autoriser la sauvegarde client des tours coach
-- (message user + réponse assistant) pour ne plus perdre l'historique
-- au changement d'onglet.
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

drop policy if exists "scanplay_coach_chat_messages_insert_own_user" on public.scanplay_coach_chat_messages;
drop policy if exists "scanplay_coach_chat_messages_insert_own" on public.scanplay_coach_chat_messages;
create policy "scanplay_coach_chat_messages_insert_own"
  on public.scanplay_coach_chat_messages for insert
  with check (
    auth.uid() = user_id
    and role in ('user', 'assistant')
  );
