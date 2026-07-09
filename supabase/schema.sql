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
  description text,
  emoji text default '📚',
  color text default '#7c3aed',
  cover_url text,
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
  images text[] not null default '{}',
  -- Alternativas ERRADAS autoradas do quiz (a correta é o `back`). Card com
  -- 2+ alternativas vira pergunta de quiz; vazio = só flashcard.
  quiz_options text[] not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Sessões de estudo. `playlist_id` usa ON DELETE SET NULL de propósito: o
-- histórico (e o XP/streak derivados dele) sobrevive à exclusão do deck.
create table if not exists study_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  playlist_id uuid references playlists(id) on delete set null,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  cards_reviewed integer default 0,
  correct_count integer default 0,
  hard_count integer default 0,
  again_count integer not null default 0
);

-- Log de revisões individuais (uma linha por avaliação De novo/Difícil/Bom/
-- Fácil). Aditiva: alimenta retenção ao longo do tempo e detecção de leeches
-- (Fase 4) sem alterar em nada o agendamento SM-2, que continua vivendo nos
-- campos de `flashcards`.
create table if not exists card_reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  card_id uuid references flashcards(id) on delete cascade not null,
  playlist_id uuid references playlists(id) on delete cascade not null,
  grade text not null check (grade in ('again', 'hard', 'good', 'easy')),
  interval_before integer not null,
  interval_after integer not null,
  reviewed_at timestamp with time zone default now()
);

-- Índices úteis para as consultas do app
create index if not exists idx_playlists_user on playlists(user_id);
create index if not exists idx_flashcards_user on flashcards(user_id);
create index if not exists idx_flashcards_playlist on flashcards(playlist_id);
create index if not exists idx_flashcards_due on flashcards(user_id, next_review_date);
create index if not exists idx_sessions_user on study_sessions(user_id, started_at desc);
create index if not exists idx_reviews_user on card_reviews(user_id, reviewed_at desc);
create index if not exists idx_reviews_card on card_reviews(card_id, reviewed_at desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table playlists enable row level security;
alter table flashcards enable row level security;
alter table study_sessions enable row level security;
alter table card_reviews enable row level security;

drop policy if exists "Users can manage own profile" on profiles;
drop policy if exists "Users can manage own playlists" on playlists;
drop policy if exists "Users can manage own flashcards" on flashcards;
drop policy if exists "Users can manage own sessions" on study_sessions;
drop policy if exists "Users can manage own reviews" on card_reviews;

create policy "Users can manage own profile" on profiles for all using (auth.uid() = id);
create policy "Users can manage own playlists" on playlists for all using (auth.uid() = user_id);
create policy "Users can manage own flashcards" on flashcards for all using (auth.uid() = user_id);
create policy "Users can manage own sessions" on study_sessions for all using (auth.uid() = user_id);
create policy "Users can manage own reviews" on card_reviews for all using (auth.uid() = user_id);

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

-- Colunas para bancos criados ANTES delas existirem (o `create table if not
-- exists` acima não altera tabelas já criadas).
alter table playlists add column if not exists tags text[] not null default '{}';
alter table playlists add column if not exists cover_url text;
alter table playlists add column if not exists description text;
alter table flashcards add column if not exists quiz_options text[] not null default '{}';

-- Excluir um deck NÃO pode apagar o histórico de sessões (o XP e a sequência
-- são derivados dele). Migra o vínculo de CASCADE para SET NULL.
alter table study_sessions alter column playlist_id drop not null;
alter table study_sessions drop constraint if exists study_sessions_playlist_id_fkey;
alter table study_sessions add constraint study_sessions_playlist_id_fkey
  foreign key (playlist_id) references playlists(id) on delete set null;

-- Força o PostgREST a recarregar o cache do schema (às vezes ele demora a ver
-- colunas novas e continua respondendo "column not found").
notify pgrst, 'reload schema';

-- ── Dados por conta: configurações, onboarding e conquistas ─────────────────
-- Tudo que era salvo apenas no aparelho (AsyncStorage) passa a viver na conta
-- do usuário: preferências (tema, cor, fonte, estudo…), a flag de onboarding
-- e as conquistas desbloqueadas.

alter table profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists onboarding_done boolean not null default false;

create table if not exists user_achievements (
  user_id uuid references profiles(id) on delete cascade not null,
  achievement_id text not null,
  unlocked_at timestamp with time zone default now(),
  primary key (user_id, achievement_id)
);

alter table user_achievements enable row level security;

drop policy if exists "Users can manage own achievements" on user_achievements;
create policy "Users can manage own achievements" on user_achievements for all using (auth.uid() = user_id);

-- ── Storage: imagens dos flashcards ──
-- Bucket público para leitura (URLs permanentes nos cards, inclusive em decks
-- compartilhados); escrita/atualização apenas na pasta do próprio usuário.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Card images are publicly readable" on storage.objects;
create policy "Card images are publicly readable" on storage.objects
  for select using (bucket_id = 'card-images');

drop policy if exists "Users upload own card images" on storage.objects;
create policy "Users upload own card images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own card images" on storage.objects;
create policy "Users update own card images" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own card images" on storage.objects;
create policy "Users delete own card images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
