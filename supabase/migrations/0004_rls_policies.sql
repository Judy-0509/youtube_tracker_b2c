-- ============================================================
-- 0004 — RLS 정책 (보수적)
-- 공개: brands / products / product_sources / trending_scores
-- 본인만: profiles
-- INSERT만: beta_signups
-- 그 외: service_role only
-- ============================================================

-- ── RLS 활성화 ───────────────────────────────────────────
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_sources enable row level security;
alter table public.product_search_keywords enable row level security;
alter table public.ad_keywords enable row level security;
alter table public.source_rankings enable row level security;
alter table public.youtube_videos enable row level security;
alter table public.youtube_owner_comments enable row level security;
alter table public.youtube_video_ad_status enable row level security;
alter table public.youtube_mentions enable row level security;
alter table public.search_trends enable row level security;
alter table public.shopping_validations enable row level security;
alter table public.trending_scores enable row level security;
alter table public.discovery_candidates enable row level security;
alter table public.profiles enable row level security;
alter table public.beta_signups enable row level security;

-- ── 공개 SELECT (anon + authenticated) ─────────────────────
drop policy if exists "public select brands" on public.brands;
create policy "public select brands" on public.brands
  for select to anon, authenticated using (true);

drop policy if exists "public select products" on public.products;
create policy "public select products" on public.products
  for select to anon, authenticated using (true);

drop policy if exists "public select product_sources" on public.product_sources;
create policy "public select product_sources" on public.product_sources
  for select to anon, authenticated using (true);

drop policy if exists "public select trending_scores" on public.trending_scores;
create policy "public select trending_scores" on public.trending_scores
  for select to anon, authenticated using (true);

-- ── Profiles: 본인 SELECT/UPDATE 만 ────────────────────────
drop policy if exists "user select own profile" on public.profiles;
create policy "user select own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "user update own profile" on public.profiles;
create policy "user update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ── Beta signups: anon INSERT 만 (honeypot) ───────────────
drop policy if exists "anon insert beta_signups" on public.beta_signups;
create policy "anon insert beta_signups" on public.beta_signups
  for insert to anon with check (true);

-- ============================================================
-- 명시적 정책 없는 테이블은 RLS가 모든 anon 접근을 거부함:
--   product_search_keywords, ad_keywords, source_rankings,
--   youtube_videos, youtube_owner_comments, youtube_video_ad_status,
--   youtube_mentions, search_trends, shopping_validations,
--   discovery_candidates
-- service_role은 RLS를 자동 우회 (별도 정책 불필요)
-- ============================================================
