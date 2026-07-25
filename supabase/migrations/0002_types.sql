-- 0002_types.sql — Enums (miroirs des unions TS de src/models/) + stop words

create type public.ownership_type as enum ('have', 'want', 'had', 'sample', 'decant');
create type public.scent_status    as enum ('to_try', 'tried');
create type public.scent_verdict   as enum ('love', 'like', 'meh', 'dislike');
create type public.scan_status     as enum ('success', 'no-result', 'error');
create type public.parfum_source   as enum ('seed', 'manual');

-- Stop words de recherche — seed EXACT de STOP_WORDS (src/utils/normalize.ts, 38 mots)
create table if not exists public.search_stop_words (
  word text primary key
);

insert into public.search_stop_words (word) values
  ('de'), ('la'), ('le'), ('eau'), ('pour'), ('l'), ('d'), ('du'), ('des'), ('et'),
  ('a'), ('un'), ('une'), ('en'), ('sur'), ('par'), ('au'), ('aux'), ('les'),
  ('dans'), ('avec'), ('sans'), ('sous'), ('ou'), ('est'), ('ce'), ('son'), ('sa'),
  ('the'), ('of'), ('and'), ('for'), ('by'), ('to'), ('in'), ('is'), ('it'), ('on')
on conflict (word) do nothing;

-- Lecture seule publique (utilisée par search_parfums, sécurité definer non requise)
alter table public.search_stop_words enable row level security;
drop policy if exists "stop_words_read_all" on public.search_stop_words;
create policy "stop_words_read_all" on public.search_stop_words
  for select using (true);
