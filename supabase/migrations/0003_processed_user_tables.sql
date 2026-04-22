-- ============================================================
-- 0003 — 가공/사용자 테이블
-- trending_scores (공개) / discovery_candidates / profiles / beta_signups
-- ============================================================

-- ── 일일 합성 트렌딩 점수 ─────────────────────────────────
create table if not exists public.trending_scores (
  product_id uuid not null references public.products(id) on delete cascade,
  date date not null,
  rank_change_7d int,
  youtube_buzz_score float,
  search_growth_score float,
  composite_score float not null,
  organic_buzz_ratio float,
  sponsored_ratio float,
  tier text not null check (tier in ('confirmed', 'detecting', 'buzz_only', 'newly_discovered')),
  is_provisional boolean not null default false,
  computed_at timestamptz default now(),
  primary key (product_id, date)
);

create index if not exists idx_trending_date on public.trending_scores(date desc);
create index if not exists idx_trending_tier_date on public.trending_scores(tier, date desc);
create index if not exists idx_trending_composite on public.trending_scores(composite_score desc);

-- ── 역방향 발굴 큐 ───────────────────────────────────────
create table if not exists public.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_type text not null check (candidate_type in ('product', 'channel')),
  source_signal text not null,
  external_data jsonb default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz default now()
);

create index if not exists idx_discovery_status on public.discovery_candidates(status, created_at desc);

-- ── 사용자 프로필 (Supabase Auth 연동) ─────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz default now()
);

-- 회원가입 시 자동으로 profile 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 베타 사전 등록 ───────────────────────────────────────
create table if not exists public.beta_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'landing',
  created_at timestamptz default now()
);
