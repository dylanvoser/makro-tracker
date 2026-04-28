-- NutriTrack Supabase Schema
-- Im Supabase SQL Editor ausführen.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age int,
  gender text,
  height_cm int,
  weight_kg numeric(6,1),
  activity_level text default 'mittel',
  goal text default 'halten',
  water_goal_ml int default 2500,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.rezepte (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  zutaten text,
  portionen numeric(10,2) default 1,
  einheit text default 'portion',
  kalorien numeric(8,1) default 0,
  protein numeric(8,1) default 0,
  carbs numeric(8,1) default 0,
  fett numeric(8,1) default 0,
  sat_fat numeric(8,1) default 0,
  unsat_fat numeric(8,1) default 0,
  created_at timestamptz default now()
);

create table if not exists public.mahlzeiten (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null default current_date,
  mahlzeit_typ text default 'mittagessen',
  beschreibung text,
  kalorien numeric(8,1) default 0,
  protein numeric(8,1) default 0,
  carbs numeric(8,1) default 0,
  fett numeric(8,1) default 0,
  sat_fat numeric(8,1) default 0,
  unsat_fat numeric(8,1) default 0,
  rezept_id bigint references public.rezepte(id) on delete set null,
  rezept_menge numeric(10,2),
  rezept_einheit text,
  created_at timestamptz default now()
);

create table if not exists public.wasser_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null default current_date,
  menge_ml int not null,
  created_at timestamptz default now()
);

create table if not exists public.monats_zusammenfassung (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  jahr int not null,
  monat int not null,
  durchschnitt_kalorien numeric(8,1),
  durchschnitt_protein numeric(8,1),
  durchschnitt_carbs numeric(8,1),
  durchschnitt_fett numeric(8,1),
  durchschnitt_sat_fat numeric(8,1),
  durchschnitt_unsat_fat numeric(8,1),
  durchschnitt_wasser_ml numeric(8,1),
  durchschnitt_bilanz_kcal numeric(8,1),
  ziel_erreicht_tage int,
  gesamt_tage int,
  highlights text,
  created_at timestamptz default now(),
  unique(user_id,jahr,monat)
);

alter table public.rezepte add column if not exists einheit text default 'portion';
alter table public.rezepte add column if not exists sat_fat numeric(8,1) default 0;
alter table public.rezepte add column if not exists unsat_fat numeric(8,1) default 0;
alter table public.mahlzeiten add column if not exists sat_fat numeric(8,1) default 0;
alter table public.mahlzeiten add column if not exists unsat_fat numeric(8,1) default 0;
alter table public.mahlzeiten add column if not exists rezept_id bigint references public.rezepte(id) on delete set null;
alter table public.mahlzeiten add column if not exists rezept_menge numeric(10,2);
alter table public.mahlzeiten add column if not exists rezept_einheit text;
alter table public.monats_zusammenfassung add column if not exists durchschnitt_sat_fat numeric(8,1);
alter table public.monats_zusammenfassung add column if not exists durchschnitt_unsat_fat numeric(8,1);
alter table public.monats_zusammenfassung add column if not exists durchschnitt_bilanz_kcal numeric(8,1);

alter table public.profiles enable row level security;
alter table public.rezepte enable row level security;
alter table public.mahlzeiten enable row level security;
alter table public.wasser_log enable row level security;
alter table public.monats_zusammenfassung enable row level security;

drop policy if exists "profiles_owner" on public.profiles;
create policy "profiles_owner" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "rezepte_owner" on public.rezepte;
create policy "rezepte_owner" on public.rezepte for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mahlzeiten_owner" on public.mahlzeiten;
create policy "mahlzeiten_owner" on public.mahlzeiten for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wasser_owner" on public.wasser_log;
create policy "wasser_owner" on public.wasser_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "summary_owner" on public.monats_zusammenfassung;
create policy "summary_owner" on public.monats_zusammenfassung for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
