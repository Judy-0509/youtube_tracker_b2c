-- ============================================================
-- 0002 — 수집 데이터 테이블
-- 외부 API/크롤로 수집한 원천. service_role 외 쓰기 금지.
-- ============================================================

-- ── 일별 랭킹 스냅샷 (올영/무신사/컬리 통합) ────────────
create table if not exists public.source_rankings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  product_source_id uuid not null references public.product_sources(id) on delete cascade,
  category text not null,
  rank int not null check (rank > 0),
  price int,
  review_count int,
  scrape_date date not null,
  scraped_at timestamptz default now(),
  unique (product_source_id, scrape_date)
);

create index if not exists idx_rankings_date on public.source_rankings(scrape_date desc);
create index if not exists idx_rankings_source_cat_date on public.source_rankings(source, category, scrape_date desc);

-- ── YouTube 영상 마스터 ──────────────────────────────────
create table if not exists public.youtube_videos (
  video_id text primary key,
  channel_id text not null,
  channel_title text,
  title text not null,
  description text,
  hashtags text[] default '{}',
  duration_sec int,
  is_short boolean,
  published_at timestamptz,
  view_count bigint,
  fetched_at timestamptz default now()
);

create index if not exists idx_yt_videos_channel on public.youtube_videos(channel_id);
create index if not exists idx_yt_videos_published on public.youtube_videos(published_at desc);
create index if not exists idx_yt_videos_short on public.youtube_videos(is_short);

-- ── 작성자 본인 댓글 (광고 탐지 Tier 2) ───────────────────
create table if not exists public.youtube_owner_comments (
  comment_id text primary key,
  video_id text not null references public.youtube_videos(video_id) on delete cascade,
  text text not null,
  published_at timestamptz,
  fetched_at timestamptz default now()
);

create index if not exists idx_yt_owner_comments_video on public.youtube_owner_comments(video_id);

-- ── 영상 광고 분류 결과 (룰 기반) ─────────────────────────
create table if not exists public.youtube_video_ad_status (
  video_id text primary key references public.youtube_videos(video_id) on delete cascade,
  status text not null check (status in ('sponsored', 'organic')),
  confidence float not null check (confidence >= 0 and confidence <= 1),
  signals jsonb default '{}',
  classified_at timestamptz default now()
);

create index if not exists idx_yt_ad_status on public.youtube_video_ad_status(status);

-- ── 영상 ↔ 제품 매칭 ─────────────────────────────────────
create table if not exists public.youtube_mentions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  video_id text not null references public.youtube_videos(video_id) on delete cascade,
  matched_text text,
  matched_at timestamptz default now(),
  unique (product_id, video_id)
);

create index if not exists idx_yt_mentions_product on public.youtube_mentions(product_id);
create index if not exists idx_yt_mentions_video on public.youtube_mentions(video_id);

-- ── 네이버 데이터랩 검색어 트렌드 ──────────────────────
create table if not exists public.search_trends (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  keyword text not null,
  date date not null,
  ratio float not null,
  fetched_at timestamptz default now(),
  unique (product_id, keyword, date)
);

create index if not exists idx_search_trends_product_date on public.search_trends(product_id, date desc);

-- ── 네이버 쇼핑 검증 (참고 지표) ──────────────────────────
create table if not exists public.shopping_validations (
  product_id uuid not null references public.products(id) on delete cascade,
  date date not null,
  avg_price int,
  review_count int,
  fetched_at timestamptz default now(),
  primary key (product_id, date)
);
