-- Testimonials (landing social proof). Run in Supabase SQL Editor.
create table if not exists public.scanplay_testimonials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_name text not null,
  role text not null default 'élève',
  rating smallint not null check (rating between 1 and 5),
  quote text not null,
  email text,
  locale text default 'fr',
  approved boolean not null default false,
  source text not null default 'avis_form'
);

create index if not exists scanplay_testimonials_approved_idx
  on public.scanplay_testimonials (approved, created_at desc);

alter table public.scanplay_testimonials enable row level security;

-- Public read of approved only (landing later).
drop policy if exists "scanplay_testimonials_select_approved" on public.scanplay_testimonials;
create policy "scanplay_testimonials_select_approved"
  on public.scanplay_testimonials for select
  using (approved = true);

-- Inserts go through service role (api/testimonial) — no anon insert policy.
grant select on public.scanplay_testimonials to anon, authenticated;
grant all on public.scanplay_testimonials to service_role;
