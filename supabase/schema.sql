-- ============================================================================
-- Recall — Schema do banco de dados (execute no Supabase SQL Editor)
-- ============================================================================

-- Perfis de usuário
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  avatar_url text,
  daily_goal integer default 20,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_study_date date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Playlists/Decks
create table if not exists playlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  emoji text default '📚',
  color text default '#7c3aed',
  source_type text default 'manual',
  tags text[] not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  last_studied_at timestamp with time zone
);

-- Flashcards
create table if not exists flashcards (
  id uuid default gen_random_uuid() primary key,
  playlist_id uuid references playlists(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  front text not null,
  back text not null,
  type text default 'concept',
  interval integer default 1,
  ease_factor float default 2.5,
  repetitions integer default 0,
  next_review_date timestamp with time zone default now(),
  last_review_date timestamp with time zone,
  mastered boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Sessões de estudo
create table if not exists study_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  playlist_id uuid references playlists(id) on delete cascade not null,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  cards_reviewed integer default 0,
  correct_count integer default 0,
  hard_count integer default 0
);

-- Índices úteis para as consultas do app
create index if not exists idx_playlists_user on playlists(user_id);
create index if not exists idx_flashcards_user on flashcards(user_id);
create index if not exists idx_flashcards_playlist on flashcards(playlist_id);
create index if not exists idx_flashcards_due on flashcards(user_id, next_review_date);
create index if not exists idx_sessions_user on study_sessions(user_id, started_at desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table playlists enable row level security;
alter table flashcards enable row level security;
alter table study_sessions enable row level security;

drop policy if exists "Users can manage own profile" on profiles;
drop policy if exists "Users can manage own playlists" on playlists;
drop policy if exists "Users can manage own flashcards" on flashcards;
drop policy if exists "Users can manage own sessions" on study_sessions;

create policy "Users can manage own profile" on profiles for all using (auth.uid() = id);
create policy "Users can manage own playlists" on playlists for all using (auth.uid() = user_id);
create policy "Users can manage own flashcards" on flashcards for all using (auth.uid() = user_id);
create policy "Users can manage own sessions" on study_sessions for all using (auth.uid() = user_id);

-- ── Trigger: cria o perfil automaticamente ao registrar ─────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
