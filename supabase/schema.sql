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

-- ── Comunidade: decks públicos, avaliações e downloads ──────────────────────
-- Modelo SNAPSHOT: publicar um deck cria uma CÓPIA congelada aqui, separada do
-- deck de trabalho privado. Assim as tabelas privadas (playlists/flashcards)
-- continuam 100% trancadas — nada de abrir leitura nelas. As avaliações grudam
-- no id estável do deck publicado; republicar atualiza o snapshot sem perder
-- notas/downloads. Autor e avaliador têm nome/avatar DENORMALIZADOS (snapshot),
-- então nem a tabela `profiles` precisa ser exposta.

create table if not exists community_decks (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  -- Deck de trabalho que originou o snapshot (para o autor republicar/despublicar).
  source_playlist_id uuid references playlists(id) on delete set null,
  title text not null,
  description text,
  cover_url text,
  tags text[] not null default '{}',
  card_count integer not null default 0,
  downloads_count integer not null default 0,
  rating_avg real not null default 0,
  rating_count integer not null default 0,
  -- Identidade do autor no momento da publicação (snapshot).
  author_name text,
  author_avatar_url text,
  published_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Cards do snapshot: SEM estado SM-2 (são um molde; o download nasce zerado).
create table if not exists community_cards (
  id uuid default gen_random_uuid() primary key,
  community_deck_id uuid references community_decks(id) on delete cascade not null,
  front text not null,
  back text not null,
  images text[] not null default '{}',
  quiz_options text[] not null default '{}',
  position integer not null default 0
);

-- Uma avaliação por usuário por deck (editável). Nome/avatar denormalizados
-- para a lista de avaliações não precisar tocar em `profiles`.
create table if not exists deck_ratings (
  id uuid default gen_random_uuid() primary key,
  community_deck_id uuid references community_decks(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  stars integer not null check (stars between 1 and 5),
  comment text,
  reviewer_name text,
  reviewer_avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (community_deck_id, user_id)
);

-- Quem baixou o quê: conta downloads e libera quem pode avaliar.
create table if not exists deck_downloads (
  community_deck_id uuid references community_decks(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (community_deck_id, user_id)
);

create index if not exists idx_community_decks_author on community_decks(author_id);
create index if not exists idx_community_decks_source on community_decks(source_playlist_id);
create index if not exists idx_community_decks_rank on community_decks(rating_avg desc, downloads_count desc);
create index if not exists idx_community_cards_deck on community_cards(community_deck_id, position);
create index if not exists idx_deck_ratings_deck on deck_ratings(community_deck_id, created_at desc);

alter table community_decks enable row level security;
alter table community_cards enable row level security;
alter table deck_ratings enable row level security;
alter table deck_downloads enable row level security;

-- Catálogo é público para QUALQUER logado ler; só o autor escreve.
drop policy if exists "Community decks are readable" on community_decks;
create policy "Community decks are readable" on community_decks
  for select to authenticated using (true);

drop policy if exists "Authors manage own community decks" on community_decks;
create policy "Authors manage own community decks" on community_decks
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "Community cards are readable" on community_cards;
create policy "Community cards are readable" on community_cards
  for select to authenticated using (true);

drop policy if exists "Authors manage own community cards" on community_cards;
create policy "Authors manage own community cards" on community_cards
  for all to authenticated
  using (
    exists (
      select 1 from community_decks cd
      where cd.id = community_deck_id and cd.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from community_decks cd
      where cd.id = community_deck_id and cd.author_id = auth.uid()
    )
  );

-- Avaliações: qualquer logado lê; o usuário só escreve a SUA, e apenas se já
-- baixou o deck (avaliar exige ter baixado).
drop policy if exists "Ratings are readable" on deck_ratings;
create policy "Ratings are readable" on deck_ratings
  for select to authenticated using (true);

drop policy if exists "Users insert own rating after download" on deck_ratings;
create policy "Users insert own rating after download" on deck_ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from deck_downloads dl
      where dl.community_deck_id = deck_ratings.community_deck_id
        and dl.user_id = auth.uid()
    )
  );

drop policy if exists "Users update own rating" on deck_ratings;
create policy "Users update own rating" on deck_ratings
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "Users delete own rating" on deck_ratings;
create policy "Users delete own rating" on deck_ratings
  for delete to authenticated using (user_id = auth.uid());

-- Downloads: cada um vê/insere os próprios (a contagem pública vive no counter).
drop policy if exists "Users read own downloads" on deck_downloads;
create policy "Users read own downloads" on deck_downloads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users insert own downloads" on deck_downloads;
create policy "Users insert own downloads" on deck_downloads
  for insert to authenticated with check (user_id = auth.uid());

-- Mantém rating_avg/rating_count no deck publicado a cada mudança de nota.
create or replace function public.refresh_deck_rating()
returns trigger as $$
declare
  target uuid := coalesce(new.community_deck_id, old.community_deck_id);
begin
  update community_decks cd set
    rating_count = (select count(*) from deck_ratings r where r.community_deck_id = target),
    rating_avg = coalesce(
      (select avg(r.stars)::real from deck_ratings r where r.community_deck_id = target),
      0
    )
  where cd.id = target;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_refresh_deck_rating on deck_ratings;
create trigger trg_refresh_deck_rating
  after insert or update or delete on deck_ratings
  for each row execute procedure public.refresh_deck_rating();

-- Registrar download: insere o vínculo (idempotente) e incrementa o counter.
-- SECURITY DEFINER porque o counter vive em community_decks, que o usuário
-- comum não pode dar UPDATE (só o autor) — a função faz isso com segurança.
create or replace function public.register_download(p_deck uuid)
returns void as $$
begin
  insert into deck_downloads (community_deck_id, user_id)
  values (p_deck, auth.uid())
  on conflict do nothing;

  if found then
    update community_decks set downloads_count = downloads_count + 1
    where id = p_deck;
  end if;
end;
$$ language plpgsql security definer;

-- ── Proteção anti-plágio: proveniência + licença ────────────────────────────
-- Uma cópia baixada precisa saber DE ONDE veio e O QUE pode fazer, senão vira
-- indistinguível de um deck autoral (plágio de um toque). Republicação é
-- bloqueável no banco (trigger); exportação de arquivo só na UI (o usuário já
-- tem os dados) — o schema reflete os dois níveis.

-- Proveniência + CACHE das permissões no momento do download. Deck autoral =
-- tudo NULL. Decks baixados ANTES desta migração ficam NULL → tratados como
-- autorais/sem restrição (sem retro-bloqueio surpresa).
alter table playlists add column if not exists origin_community_deck_id uuid;
alter table playlists add column if not exists origin_author_id uuid;
alter table playlists add column if not exists origin_author_name text;
alter table playlists add column if not exists origin_allow_export boolean;
alter table playlists add column if not exists origin_allow_redistribute boolean;

-- Licença do deck publicado (o `default 'protected'` faz o backfill dos decks
-- já publicados para o modo mais fechado; o autor reabre republicando).
alter table community_decks add column if not exists license text not null default 'protected';
alter table community_decks add column if not exists allow_export boolean not null default false;
alter table community_decks add column if not exists allow_redistribute boolean not null default false;
-- Crédito imutável ao autor da RAIZ da cadeia (derivados republicados o herdam).
alter table community_decks add column if not exists original_author_id uuid;
alter table community_decks add column if not exists original_author_name text;

alter table community_decks drop constraint if exists community_decks_license_check;
alter table community_decks add constraint community_decks_license_check
  check (license in ('protected', 'shareable', 'open'));

-- Enforcement HARD: bloqueia republicação de cópia baixada protegida e força o
-- crédito ao autor original em derivados permitidos. BEFORE para poder MUTAR a
-- linha (a RLS só sabe permitir/negar, não conseguiria forçar o crédito).
create or replace function public.enforce_deck_provenance()
returns trigger as $$
declare
  src record;
begin
  if new.source_playlist_id is null then
    return new; -- sem deck de trabalho vinculado: nada a herdar/checar.
  end if;

  select origin_community_deck_id, origin_author_id, origin_author_name,
         origin_allow_redistribute
    into src
    from playlists
    where id = new.source_playlist_id;

  -- Playlist autoral (sem origem): publica normal.
  if not found or src.origin_community_deck_id is null then
    return new;
  end if;

  -- Cópia baixada cujo autor NÃO permite redistribuição: proibido republicar.
  if coalesce(src.origin_allow_redistribute, false) = false then
    raise exception 'REPUBLISH_FORBIDDEN: deck baixado cujo autor não permite redistribuição'
      using errcode = 'check_violation';
  end if;

  -- Derivado permitido: crédito ao autor original é obrigatório e não-removível
  -- (reaplicado a cada republish, sobrescrevendo qualquer tentativa de burla).
  new.original_author_id := coalesce(src.origin_author_id, new.original_author_id);
  new.original_author_name := coalesce(src.origin_author_name, new.original_author_name);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_deck_provenance on community_decks;
create trigger trg_enforce_deck_provenance
  before insert or update on community_decks
  for each row execute procedure public.enforce_deck_provenance();

-- ── Denúncias (moderação) ────────────────────────────────────────────────────
create table if not exists deck_reports (
  id uuid default gen_random_uuid() primary key,
  community_deck_id uuid references community_decks(id) on delete cascade not null,
  reporter_id uuid references profiles(id) on delete cascade not null,
  reason text not null check (reason in ('plagiarism', 'inappropriate', 'spam', 'other')),
  detail text,
  created_at timestamp with time zone default now(),
  unique (community_deck_id, reporter_id)
);

alter table deck_reports enable row level security;

drop policy if exists "Users insert own reports" on deck_reports;
create policy "Users insert own reports" on deck_reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "Users read own reports" on deck_reports;
create policy "Users read own reports" on deck_reports
  for select to authenticated using (reporter_id = auth.uid());

notify pgrst, 'reload schema';

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
