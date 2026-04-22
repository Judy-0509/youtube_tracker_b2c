-- ============================================================
-- 0001 — 마스터 테이블
-- brands / products / product_sources / product_search_keywords / ad_keywords
-- ============================================================

-- ── 브랜드 ────────────────────────────────────────────────
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_en text,
  aliases text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_brands_name on public.brands(name);

-- ── 제품 마스터 (vendor-neutral) ──────────────────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  variant text not null default '',
  category text not null check (category in ('skincare', 'makeup', 'haircare', 'bodycare', 'mens', 'innerbeauty')),
  subcategory text,
  image_url text,
  first_seen_at timestamptz default now(),
  unique (brand_id, normalized_name, variant)
);

create index if not exists idx_products_brand on public.products(brand_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_normalized on public.products(normalized_name);

-- ── 제품 ↔ 외부 소스 매핑 (1:N) ────────────────────────────
create table if not exists public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source text not null check (source in ('oliveyoung', 'musinsa', 'kurly', 'coupang', 'naver_shopping')),
  external_id text not null,
  url text,
  first_seen_at timestamptz default now(),
  unique (source, external_id)
);

create index if not exists idx_product_sources_product on public.product_sources(product_id);
create index if not exists idx_product_sources_source on public.product_sources(source);

-- ── 제품별 검색어 사전 (사람이 관리) ─────────────────────
create table if not exists public.product_search_keywords (
  product_id uuid primary key references public.products(id) on delete cascade,
  primary_keyword text not null,
  alias_keywords text[] default '{}',
  exclude_keywords text[] default '{}',
  status text not null default 'pending_review' check (status in ('active', 'ambiguous', 'failed', 'pending_review')),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists idx_psk_status on public.product_search_keywords(status);

-- ── 광고 키워드 사전 ────────────────────────────────────
create table if not exists public.ad_keywords (
  id serial primary key,
  category text not null check (category in ('direct', 'hashtag', 'market', 'regex')),
  pattern text not null unique,
  weight float not null default 1.0,
  active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_ad_keywords_active on public.ad_keywords(active, category);
