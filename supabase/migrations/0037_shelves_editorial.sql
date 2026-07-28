alter table public.shelves add column if not exists description text;
alter table public.shelves add column if not exists is_public boolean not null default false;
