-- Run this in the Supabase SQL Editor

-- 1. Tables

create table if not exists nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fecha date not null,
  descripcion_original text,
  alimentos jsonb,
  totales jsonb,
  created_at timestamptz default now()
);

create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fecha date not null,
  descripcion_original text,
  ejercicios jsonb,
  created_at timestamptz default now()
);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fecha date not null,
  peso_kg numeric(5,2) not null,
  created_at timestamptz default now(),
  unique(user_id, fecha)
);

create table if not exists user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  kcal_meta integer default 1720,
  proteina_meta integer default 145,
  carbs_meta integer default 155,
  grasa_meta integer default 58,
  updated_at timestamptz default now()
);

-- 2. Row Level Security

alter table nutrition_logs enable row level security;
alter table workout_logs enable row level security;
alter table weight_logs enable row level security;
alter table user_goals enable row level security;

-- 3. RLS Policies (users can only access their own data)

create policy "nutrition_logs: own rows only"
  on nutrition_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "workout_logs: own rows only"
  on workout_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "weight_logs: own rows only"
  on weight_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_goals: own rows only"
  on user_goals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 5. AI Plan & Chat tables

create table if not exists user_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  nutricion jsonb,
  entrenamiento jsonb,
  updated_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table user_plan enable row level security;
alter table chat_messages enable row level security;

create policy "user_plan: own rows only"
  on user_plan for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "chat_messages: own rows only"
  on chat_messages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 6. Chat sessions (multi-conversation support)
-- Migration for existing DBs: run the block below in Supabase SQL Editor

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

alter table chat_sessions enable row level security;

create policy "chat_sessions: own rows only"
  on chat_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Add chat_id FK to chat_messages (nullable so old rows aren't broken)
alter table chat_messages
  add column if not exists chat_id uuid references chat_sessions(id) on delete cascade;

-- 7. User profile (personal info + goal pills)
-- Migration for existing DBs: run this block in Supabase SQL Editor

create table if not exists user_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  nombre text,
  edad integer,
  peso_kg numeric(5,2),
  estatura_cm integer,
  genero text,
  nivel_actividad text,
  metas text[],
  updated_at timestamptz default now()
);

alter table user_profile enable row level security;

create policy "user_profile: own rows only"
  on user_profile for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 8. Meal type on nutrition logs (migration for existing DBs)
alter table nutrition_logs
  add column if not exists tipo_comida text
    check (tipo_comida in ('desayuno','almuerzo','merienda','post_entreno','cena','suplementos'));
