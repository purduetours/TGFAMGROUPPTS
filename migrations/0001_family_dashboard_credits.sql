begin;

create table if not exists public.tgis_family_dashboard_credits (
  id uuid primary key,
  semester text not null check (char_length(semester) between 1 and 40),
  "guideId" text not null check ("guideId" ~ '^[0-9a-f]{64}$'),
  name text not null,
  family text not null,
  date date not null,
  units integer not null check (units between 1 and 20),
  note text not null check (char_length(note) <= 200),
  "createdAt" timestamptz not null default now()
);

create index if not exists tgis_family_dashboard_credits_semester_id
  on public.tgis_family_dashboard_credits (semester, id);

alter table public.tgis_family_dashboard_credits enable row level security;
revoke all on table public.tgis_family_dashboard_credits from public, anon, authenticated, service_role;
grant select, insert on table public.tgis_family_dashboard_credits to service_role;

commit;
