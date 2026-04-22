# 클리키 (Clickyy B2C) — 빌드 플랜 v2

> 마지막 업데이트: 2026-04-22
> 상태: v2 확정 (Codex 리뷰 9개 + 광고 탐지 정책 6개 반영), Step 1.1 착수 대기
> 변경 이력: v1 (2026-04-22) → v2 (2026-04-22, 본 문서)

---

## 1. 제품 개요

뷰티 크리에이터를 위한 **트렌드 디스커버리 SaaS**.
"지금 어떤 제품이 뜨고 있나" + **"광고로 띄운 건지 진짜 인기인지"**를 한 화면에서 답해서, 다음 영상 소재를 30분 안에 찾을 수 있게 한다.

- **타겟**: 모든 뷰티 크리에이터 (초보 ~ 메가)
- **가격**: Free / Pro ₩29,900 (결제는 MVP 이후 — 사업자등록 시점에 토스/Lemon Squeezy 결정)
- **언어**: 한국어 우선
- **브랜드명**: 클리키 (Clickyy)
- **차별화**: 단일 신호(올리브영 랭킹/유튜브)가 아닌 **3축 합성 + 광고 탐지** → "🔥 확정 트렌딩 vs ⚠️ 버즈만 있음"을 명확히 구분

---

## 2. v1 → v2 핵심 변경 (15건)

| # | 항목 | v1 | v2 |
|---|---|---|---|
| 1 | YouTube 수집 방식 | `search.list` × 200제품 (20K units 초과) | 채널 기반 `playlistItems.list` + `videos.list` (~25 units) |
| 2 | 콜드 스타트 | 정의 없음 | Day 1~7 provisional, Day 8+ stable |
| 3 | Validation 시그널 | 4축 정의했으나 점수식 누락 | **3축 점수 + 참고 지표로 격하** |
| 4 | 검색어 매핑 | 제품명 직접 사용 | **`product_search_keywords` 사전** + 폴백 룰 |
| 5 | 스키마 | 올리브영 컬럼이 products에 박힘 | **`product_sources` 분리** + variant 컬럼 |
| 6 | 키 회전 | "개발 종료 시" | 사용자 결정으로 **미실행** (위험 인지 후 진행) |
| 7 | RLS | 모든 raw 데이터 public read | **`trending_scores`만 public**, 원천은 service_role |
| 8 | 사용자 검증 | 1명 데모 | **3~5명 인터뷰 + 행동 지표** |
| 9 | 광고 탐지 | LLM 분류기 (Tier 3) 포함 | **GLM 0, 룰 기반 2-tier로 단순화** |
| 10 | 광고 키워드 사전 | 직접 광고 마커만 | **마켓·판매 키워드 추가** (공구/단독/라방 등) |
| 11 | 댓글 수집 | "MVP1 제외" (14번 정책) | **`commentThreads.list` 사용 + `authorChannelId` 필터** |
| 12 | 트렌딩 라벨 | 3-tier (🔥/📡/⚠️) | **4-tier 추가** (🌱 신규 발굴) |
| 13 | 신규 채널/제품 발굴 | 없음 | **`discovery_candidates` 큐** (역방향 시그널) |
| 14 | 롱폼/숏폼 처리 | 동일 처리 | **분리 — Shorts는 해시태그 가중치↑, 자막 무시** |
| 15 | 채널 누락 보완 | 없음 | 4가지 보완책 (역방향 발굴 + 월간 재발굴 cron 등) |

---

## 3. 데이터 전략 — 3축 합성 신호

### 신호 정의

| 신호 | 의미 | 데이터 소스 | 갱신 |
|---|---|---|---|
| **Sales Rank** | 실판매 랭킹 변화 | 올리브영 일일 베스트 (크롤) | 매일 03:00 KST |
| **Content Buzz** | 신뢰 채널의 콘텐츠 노출량 | YouTube Data API v3 (303 활성 채널 시드 — 14번에서 inactive pruned) | 매일 03:30 KST |
| **Search Demand** | 검색량 변화율 | 네이버 데이터랩 검색어 트렌드 | 매일 04:00 KST |
| (참고) Validation | 가격/리뷰 변화 | 네이버 쇼핑 검색 API | 매일 04:30 KST |

### 합성 점수 (Day 8+ 안정 모드)

```
trending_score = 0.30 × normalize(rank_change_7d)
               + 0.40 × normalize(youtube_buzz_7d)
               + 0.30 × normalize(search_growth_7d)
```

**normalize**: 카테고리별 z-score 또는 percentile rank (가중치는 1차 가설, Week 2 Day 5에 데이터 보고 튜닝).

### 콜드 스타트 (Day 1~7)

- Day 1~2: 1-day delta로 점수 산출, UI에 "🔬 베타 (수집 1~2일째)" 표시
- Day 3~6: 3-day delta로 점수 산출, "🔬 베타" 표시
- Day 7+: 7-day delta로 정식 산출

### 4-Tier 라벨 (광고 비율 통합)

| 라벨 | 조건 | 의미 |
|---|---|---|
| 🔥 **확정 트렌딩** | (rank↑ OR search↑) AND `organic_buzz_ratio ≥ 50%` | 실판매·검색·오가닉 콘텐츠 모두 강함 |
| 📡 **신호 감지중** | 1~2개 신호만 강함 | 떠오르는 중, 추가 관찰 필요 |
| ⚠️ **버즈만 있음** | youtube_buzz↑ AND `sponsored_ratio ≥ 70%` AND search↑ 약함 | 유튜버 광고 캠페인 가능성 |
| 🌱 **신규 발굴** | search↑ OR rank↑인데 우리 채널 시드에 영상 0 | 인디 브랜드/신생 제품 추정 |

---

## 4. 광고 탐지 — 룰 기반 (GLM 0)

### Tier 1: 텍스트 키워드 스캔 (영상당 0 추가 비용)

스캔 대상: 제목 + 설명 전문 + 해시태그.

**키워드 사전 (DB `ad_keywords` 테이블에 시드)**:

```
[direct]   광고, 유료광고, 협찬, PPL, AD, sponsored, 'Includes paid promotion',
           [광고], (광고), [Ad], [PR], [유료광고], 소정의 원고료, 협찬받음,
           본 영상은 ㅇㅇ로부터 제공받았습니다, 본 콘텐츠는 광고를 포함

[hashtag]  #광고, #협찬, #유료광고, #AD, #sponsored, #PR, #ad

[market]   마켓, 라방, 라이브, 라이브방송, 라이브쇼핑, 라이브커머스,
           공구, 공동구매, 공동 구매,
           단독, 단독판매, 단독상품, 단독구성, 한정, 한정판매, 한정수량, 한정판,
           사은품, 증정, 추가증정, 추가구성,
           구매링크, 사러가기, 할인코드, 쿠폰코드, 프로모션코드,
           첫구매 할인, 신규가입 혜택, 구매처

[regex]    /(\d+)% ?(할인|세일|DC)/, /구매링크.{0,20}(↓|⬇|아래)/,
           /(쿠팡|네이버|올영|올리브영|무신사) (단독|특가)/
```

### Tier 2: 작성자 댓글 스캔 (영상당 1 unit)

```
commentThreads.list?part=snippet&videoId=X&maxResults=50&order=time
→ filter where topLevelComment.snippet.authorChannelId.value === video.channelId
→ 자기가 단 댓글에서만 키워드 매칭
→ comments disabled (403) → graceful skip
```

### 결정 로직

```typescript
function classifyAd(title, description, hashtags, ownerComments): AdResult {
  const text = [title, description, ...ownerComments].join(' ')
  const tags = hashtags
  
  if (matchAny(text, DIRECT_AD_KEYWORDS)) return { status: 'sponsored', confidence: 0.95 }
  if (matchAny(tags, AD_HASHTAGS))         return { status: 'sponsored', confidence: 0.90 }
  if (matchAny(text, MARKET_KEYWORDS))     return { status: 'sponsored', confidence: 0.80 }
  return { status: 'organic', confidence: 0.70 }
}
```

`unclear` 상태 없음. confidence 점수만 다르게.

### 한계 인정 (False Negative)
- 키워드 0 + 단일 제품 영상 → organic으로 오분류 가능
- 채널 자체 PPL → 표기 누락 흔함
- → 4-tier 임계(50%, 70%)가 노이즈에 robust하므로 MVP 수용

---

## 5. 데이터 흐름 (제품 1개 처리 예시)

올리브영 스킨케어 12위 = "메디큐브 제로 모공 패드 2.0":

| 단계 | 처리 | 결과 |
|---|---|---|
| 1 | 올리브영 일일 스냅샷 | 7일 전 47위 → 오늘 12위 = +35칸 상승 |
| 2 | `product_search_keywords`에서 검색어 조회 → 네이버 데이터랩 호출 | 검색량 7일 전 대비 +312% |
| 3 | 채널 신규 영상에서 제품명 텍스트 매칭 | 7일간 12개 영상, 7개 채널, 합계 280만뷰 |
| 4 | 각 영상 광고 분류 | 12개 중 4개 sponsored, 8개 organic → organic_ratio 67% |
| 5 | 합성 점수 + 라벨링 | trending_score 87.4 → "🔥 확정 트렌딩" |

---

## 6. 범위 (Scope)

### MVP (Week 1~2)
- **카테고리**: 스킨케어 + 메이크업
- **데이터 양** (Phase 3 검증 결과 정정): 올영 전체 베스트 100개 → **스킨64 + 메이크업22 = 86개/일**
  - 카테고리별 Top 100 URL이 별도로 노출되지 않음 (`?dispCatNo=...`은 카테고리 랜딩으로 redirect)
  - 전체 베스트 100개 + 카테고리 breadcrumb 필터로 운용
- **크롤 방식**: Playwright (Chromium) — Cloudflare 회피
- **소스**: 올리브영 + YouTube + 네이버 데이터랩 + 네이버 쇼핑(보조)
- **광고 탐지**: 룰 기반 2-tier (LLM 0)

### v1.1 (Week 3+)
- 헤어, 바디, 맨즈 카테고리 추가
- 무신사뷰티 / 컬리뷰티 랭킹 추가
- LLM 광고 분류 도입 검토 (false negative 줄이기)
- Pro 기능 (CSV/API/이메일 알림)

### 명시적 제외
- ❌ 쿠팡파트너스 (사용자 의사 없음)
- ❌ Instagram / TikTok (API 제약)
- ❌ The 화해 / 파우더룸 (정밀 크롤 부담)
- ❌ 결제 시스템 (사업자 등록 후)

---

## 7. DB 스키마 (vendor-neutral)

새 Supabase 프로젝트: `nbluhyzyeidnywnafszm` (clickyy-b2c, ap-northeast-2 서울)

### 마스터

```sql
brands (
  id uuid pk,
  name text unique,
  name_en text,
  aliases text[],
  created_at timestamptz default now()
);

products (                                         -- vendor-neutral
  id uuid pk,
  brand_id uuid fk,
  name text,
  normalized_name text,                            -- 검색용 정규화
  variant text default '',                         -- "30ml" | "100ml" | ""
  category text,                                   -- 'skincare' | 'makeup'
  subcategory text,                                -- 'pad' | 'serum' | 'cushion' ...
  image_url text,
  first_seen_at timestamptz default now(),
  unique (brand_id, normalized_name, variant)
);

product_sources (                                  -- 1:N 매핑
  id uuid pk,
  product_id uuid fk,
  source text,                                     -- 'oliveyoung' | 'musinsa' | 'kurly'
  external_id text,
  url text,
  first_seen_at timestamptz default now(),
  unique (source, external_id)
);

product_search_keywords (                          -- 검색어 사전 (사람이 관리)
  product_id uuid fk,
  primary_keyword text,                            -- "메디큐브 모공패드"
  alias_keywords text[],                           -- ["메디큐브 모공 패드"]
  exclude_keywords text[],                         -- ["다이소 모공패드"]
  status text default 'active',                    -- 'active' | 'ambiguous' | 'failed'
  reviewed_at timestamptz,
  primary key (product_id)
);

ad_keywords (                                      -- 광고 키워드 사전
  id serial pk,
  category text,                                   -- 'direct' | 'hashtag' | 'market' | 'regex'
  pattern text,
  weight float default 1.0,
  active boolean default true
);
```

### 수집 데이터 (service_role only — 재배포 책임 표면적 ↓)

```sql
source_rankings (                                  -- 통합 일별 랭킹
  id uuid pk,
  source text,
  product_source_id uuid fk,
  category text,
  rank int,
  price int,
  review_count int,
  scrape_date date,
  unique (product_source_id, scrape_date)
);

youtube_videos (                                   -- 채널 신규 영상 마스터
  video_id text pk,
  channel_id text,
  channel_title text,
  title text,
  description text,
  hashtags text[],
  duration_sec int,
  is_short boolean,                                -- duration_sec ≤ 180
  published_at timestamptz,
  view_count bigint,
  fetched_at timestamptz default now()
);

youtube_owner_comments (                           -- 작성자 본인 댓글
  comment_id text pk,
  video_id text fk,
  text text,
  published_at timestamptz,
  fetched_at timestamptz default now()
);

youtube_video_ad_status (                          -- 광고 분류 결과
  video_id text pk,
  status text,                                     -- 'sponsored' | 'organic'
  confidence float,
  signals jsonb,                                   -- {tier1: [...], tier2_owner_comment: bool}
  classified_at timestamptz default now()
);

youtube_mentions (                                 -- 영상 ↔ 제품 매칭
  id uuid pk,
  product_id uuid fk,
  video_id text fk,
  matched_text text,                               -- 어디서 매칭됐는지
  matched_at timestamptz default now(),
  unique (product_id, video_id)
);

search_trends (                                    -- 네이버 데이터랩 결과
  id uuid pk,
  product_id uuid fk,
  keyword text,
  date date,
  ratio float,
  fetched_at timestamptz default now(),
  unique (product_id, keyword, date)
);

shopping_validations (                             -- 네이버 쇼핑 검색 (참고 지표)
  product_id uuid fk,
  date date,
  avg_price int,
  review_count int,
  primary key (product_id, date)
);
```

### 가공/공개 데이터

```sql
trending_scores (                                  -- 일일 합성 점수
  product_id uuid fk,
  date date,
  rank_change_7d int,
  youtube_buzz_score float,
  search_growth_score float,
  composite_score float,
  organic_buzz_ratio float,
  sponsored_ratio float,
  tier text,                                       -- 'confirmed' | 'detecting' | 'buzz_only' | 'newly_discovered'
  is_provisional boolean,                          -- Day 1~7 true
  computed_at timestamptz default now(),
  primary key (product_id, date)
);

discovery_candidates (                             -- 역방향 발굴 큐
  id uuid pk,
  candidate_type text,                             -- 'product' | 'channel'
  source_signal text,                              -- 'oliveyoung_rank_jump' | 'naver_search_spike'
  external_data jsonb,
  status text default 'pending',                   -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz default now()
);

profiles (                                         -- 사용자
  id uuid pk,                                      -- = auth.users.id
  email text,
  display_name text,
  plan text default 'free',
  created_at timestamptz default now()
);

beta_signups (                                     -- 사전 등록
  id uuid pk,
  email text unique,
  source text,
  created_at timestamptz default now()
);
```

### RLS 정책 (보수적)

| 테이블 | anon | authenticated | service_role |
|---|---|---|---|
| `brands`, `products`, `product_sources` | SELECT | SELECT | ALL |
| `trending_scores` | SELECT | SELECT | ALL |
| `discovery_candidates` | — | — | ALL |
| `source_rankings`, `youtube_*`, `search_trends`, `shopping_validations` | — | — | ALL |
| `product_search_keywords`, `ad_keywords` | — | — | ALL |
| `profiles` | — | SELECT/UPDATE 본인 | ALL |
| `beta_signups` | INSERT 만 (honeypot) | — | SELECT/ALL |

---

## 8. 채널 누락 보완 (4가지)

| # | 보완책 | 비용 | 시점 |
|---|---|---|---|
| 1 | 역방향 발굴 — 올리브영/네이버에서 급상승했는데 시드에 영상 0 → `discovery_candidates`에 자동 적재 | 0 | Week 1 Day 5 |
| 2 | 월간 재발굴 cron — `search.list` × 신규 키워드 5개 ("올영 2026", "신상 발견" 등) | 500 units/월 | Week 2 |
| 3 | 사용자 제보 폼 (Pro) | 0 | Week 3+ |
| 4 | 시드 채널 콜라보 영상에서 멘션된 다른 채널 자동 추출 | 적음 | Week 3+ |

→ MVP는 #1만으로 충분. 시그널 자체가 "신규 발굴" UI 카드 가치.

---

## 9. 일일 비용 (안정 운영)

| 호출 | 빈도 | 단가 | 일일 |
|---|---|---|---|
| `playlistItems.list` × 7 (303 채널 / 50) | 매일 | 1 | 7 |
| `videos.list` × 5~10 | 매일 | 1 | 10 |
| `commentThreads.list` × 200 | 매일 | 1 | 200 |
| `search.list` (월간 재발굴) | 5회/월 | 100 | ~17/일 평균 |
| `channels.list` (월간 통계) | 7회/월 | 1 | <1 |
| **YouTube 합계** | | | **~234 units/day (한도 2.3%)** |
| 네이버 데이터랩 | 200회/일 | — | 한도 1,000회 (20%) |
| 네이버 쇼핑 검색 | 200회/일 | — | 한도 25,000회/일 |
| **GLM** | 0 | 0 | **$0** |
| 올리브영 크롤 | 200 페이지/일 | — | 차단 리스크 관리 필요 |

---

## 10. Step-by-Step 실행 계획 ⭐

> 각 Step은 독립적 산출물 + 검증 기준 포함. Step ID는 `Sx.y` 형식.
> 🤖 = Claude 작업, 👤 = 사용자 작업, 🔗 = 둘 다 (사용자 컨펌 포함)

### Phase 0 — 사전 준비 (10분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S0.1 | 🤖 | 14번 `data/creator-discovery.json` 복사 → 15번 `data/seed-channels.json` | `data/seed-channels.json` (303 활성 채널, 14번에서 inactive pruned) | jq로 채널 수 확인 |
| S0.2 | 🤖 | `.gitignore` 작성 (`.env*` 우선 차단, `node_modules`, `.next`, `data/raw-*` 등) | `.gitignore` | 파일 존재 |

### Phase 1 — 인프라 + 스캐폴딩 (예상 60분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S1.1 | 🤖 | `npx create-next-app@latest` (Next.js 15 + TS + Tailwind + App Router + src dir 없이) | `package.json`, `app/`, `tsconfig.json` | `npm run dev` → :3000 200 |
| S1.2 | 🤖 | Pretendard 폰트 적용 (`app/layout.tsx`에 link 또는 self-host) | `app/layout.tsx`, `app/globals.css` | DevTools에서 한글 폰트 확인 |
| S1.3 | 🤖 | shadcn/ui 초기화 (`npx shadcn@latest init`) + base 컴포넌트 (button/card/badge) 설치 | `components/ui/`, `components.json` | `<Button>` import OK |
| S1.4 | 🤖 | Tailwind config에 클린 민트 토큰 추가 (`emerald` palette 확장 + 카드/보더 표준) | `tailwind.config.ts` | 임시 페이지에 색상 검증 |
| S1.5 | 🤖 | `.env.local` + `.env.local.example` 작성 (Supabase URL/anon/service, YouTube, Naver, GLM 비활성) | 두 파일 | 누락 키 0 |
| S1.6 | 🤖 | 환경변수 검증 (`lib/env.ts`) — zod로 require된 키 부재 시 빌드 실패 | `lib/env.ts` | 의도적으로 키 빼서 에러 발생 확인 |
| S1.7 | 🤖 | Supabase 클라이언트 (`lib/supabase/client.ts` browser용, `lib/supabase/server.ts` server용) | 두 파일 | 임시 ping 라우트로 연결 확인 |
| S1.8 | 🤖 | 프로젝트 폴더 구조 정리: `lib/`, `components/`, `app/`, `scripts/`, `supabase/migrations/`, `data/`, `mockups/` | 디렉토리 구조 | `tree -L 2` 결과 확인 |

### Phase 2 — DB 스키마 (예상 45분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S2.1 | 🤖 | 마이그레이션 0001: 마스터 (`brands`, `products`, `product_sources`, `product_search_keywords`, `ad_keywords`) | `supabase/migrations/0001_*.sql` | SQL syntax check |
| S2.2 | 🤖 | 마이그레이션 0002: 수집 데이터 (`source_rankings`, `youtube_*`, `search_trends`, `shopping_validations`) | `supabase/migrations/0002_*.sql` | 동일 |
| S2.3 | 🤖 | 마이그레이션 0003: 가공/사용자 (`trending_scores`, `discovery_candidates`, `profiles`, `beta_signups`) | `supabase/migrations/0003_*.sql` | 동일 |
| S2.4 | 🤖 | 마이그레이션 0004: RLS 정책 (위 표 그대로) | `supabase/migrations/0004_*.sql` | 동일 |
| S2.5 | 🤖 | Supabase Management API로 모든 마이그레이션 적용 | DB에 테이블 생성됨 | `pg_tables` 쿼리로 확인 |
| S2.6 | 🤖 | TypeScript Database 타입 생성 (`supabase gen types typescript`) | `lib/db/types.ts` | 타입 import OK |
| S2.7 | 🤖 | `ad_keywords` 시드 데이터 INSERT (~70개 키워드) | INSERT 실행 | `SELECT count(*) FROM ad_keywords` ≥ 70 |
| S2.8 | 🤖 | RLS 8 케이스 검증 스크립트 (`scripts/verify-rls.mjs`) | 검증 통과 | 8/8 PASS |

### Phase 3 — 올리브영 크롤러 (예상 90분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S3.1 | 🤖 | 올리브영 베스트 페이지 구조 분석 (`/store/main/getBestList.do?dispCatNo=...`) — 스킨케어/메이크업 카테고리 ID 확인 | 분석 노트 | dispCatNo 값 확정 |
| S3.2 | 🤖 | HTML/AJAX 파싱 모듈 (`lib/scrapers/oliveyoung.ts`) — 페이지당 100제품, User-Agent 로테이션, 1.5s sleep | 파일 | 1페이지 파싱 → JSON 200제품 |
| S3.3 | 🤖 | 브랜드/제품 정규화 함수 (`lib/normalize/product.ts`) — 공백/특수문자/대소문자 통일, variant 추출 | 파일 + 테스트 | 입력 5개 → 정규화 결과 검증 |
| S3.4 | 🤖 | 크롤 → DB 적재 스크립트 (`scripts/scrape-oliveyoung.mjs`) — `brands`/`products`/`product_sources`/`source_rankings` UPSERT | 스크립트 | 첫 실행 후 200 row 확인 |
| S3.5 | 🤖 | 첫 실행 + 검증: 200제품, 카테고리 분포, null 컬럼 점검 | 적재 결과 | DB 쿼리로 sanity |
| S3.6 | 🤖 | 차단 감지 핸들러 (HTTP 403/429 시 알림 + 재시도 백오프) | 핸들러 코드 | 의도적 429 시뮬레이션 |

### Phase 4 — YouTube 채널 수집 (예상 90분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S4.1 | 🤖 | `data/seed-channels.json` 검증 + `youtube_videos.channel_id` 시드 | DB에 channel 메타 (lazy: 첫 영상 수집 때 채워짐) | 채널 수 확인 |
| S4.2 | 🤖 | YouTube 클라이언트 (`lib/youtube/client.ts`) — quota 카운터 내장 | 파일 | quota 합계 출력 OK |
| S4.3 | 🤖 | `playlistItems.list` 모듈 — 채널의 uploads 플레이리스트에서 최근 N일 영상 ID 수집 | `lib/youtube/fetch-recent.ts` | 1 채널 → 영상 ID 50개 OK |
| S4.4 | 🤖 | `videos.list` 모듈 — 50 video ID 배치, contentDetails(duration) + statistics(viewCount) 포함 | `lib/youtube/fetch-video-meta.ts` | 50 영상 메타 적재 |
| S4.5 | 🤖 | Shorts 판정 (`is_short = duration_sec ≤ 180`) + 해시태그 파싱 | 파싱 함수 | duration 파서 단위 테스트 |
| S4.6 | 🤖 | `commentThreads.list` 모듈 + `authorChannelId` 필터 → `youtube_owner_comments` 적재 (403 graceful skip) | `lib/youtube/fetch-owner-comments.ts` | 5개 영상 샘플 적재 OK |
| S4.7 | 🤖 | 통합 수집 스크립트 (`scripts/fetch-youtube-daily.mjs`) — 303 채널 → 신규 영상 → 메타 → 작성자 댓글 | 스크립트 | quota ≤ 250, 영상 200~500개 적재 |

### Phase 5 — 광고 분류 + 제품 매칭 (예상 60분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S5.1 | 🤖 | 광고 분류기 (`lib/classifier/ad-detector.ts`) — `ad_keywords` 테이블 로드 + Tier 1+2 결정 로직 | 파일 + 단위 테스트 | 10개 케이스 (sponsored 5/organic 5) 통과 |
| S5.2 | 🤖 | 적재 스크립트 (`scripts/classify-ads.mjs`) — 새 영상 → `youtube_video_ad_status` UPSERT | 스크립트 | 200 영상 분류 결과 |
| S5.3 | 🤖 | 제품 매칭기 (`lib/matcher/product-mention.ts`) — 영상 텍스트 vs `products.normalized_name` + `aliases` 텍스트 매칭 | 파일 | 샘플 영상 5개 매칭 검증 |
| S5.4 | 🤖 | 매칭 적재 스크립트 (`scripts/match-products.mjs`) — `youtube_mentions` UPSERT | 스크립트 | 매칭 row 수 확인 |
| S5.5 | 🤖 | `product_search_keywords` 시드 — 200제품에 대해 자동 1차 (제품명 그대로) + ambiguous 후보는 status='ambiguous' 마킹 | 시드 INSERT | 200 row 확인 |

### Phase 6 — 네이버 데이터랩 + 쇼핑 (예상 45분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S6.1 | 🤖 | 데이터랩 클라이언트 (`lib/naver/datalab.ts`) — 검색어 트렌드 API, 그룹 단위 호출 (5개 묶음) | 파일 | 1 그룹 호출 → 일별 ratio 응답 |
| S6.2 | 🤖 | 쇼핑 검색 클라이언트 (`lib/naver/shopping.ts`) — 제품명 검색 → 평균가/리뷰 수 | 파일 | 1 제품 호출 OK |
| S6.3 | 🤖 | 트렌드 적재 스크립트 (`scripts/fetch-naver-trends.mjs`) — `product_search_keywords` 활성 row만 호출, `search_trends` 적재 | 스크립트 | 적재 row 수 확인 |
| S6.4 | 🤖 | 쇼핑 적재 스크립트 (`scripts/fetch-naver-shopping.mjs`) — `shopping_validations` 적재 | 스크립트 | 적재 row 수 확인 |

### Phase 7 — 합성 점수 + 라벨 + 발굴 큐 (예상 60분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S7.1 | 🤖 | 점수 계산 모듈 (`lib/scoring/composite.ts`) — z-score normalize + 가중합 | 파일 + 테스트 | 픽스처 입력 → 점수 검증 |
| S7.2 | 🤖 | 콜드 스타트 처리 — 누적 일수에 따라 1d/3d/7d delta 자동 선택 | 함수 | Day 3 시뮬레이션 시 3d delta 사용 확인 |
| S7.3 | 🤖 | 4-tier 라벨러 (`lib/scoring/tier.ts`) — organic/sponsored 비율 + 점수 임계 | 파일 + 테스트 | 4 케이스 모두 통과 |
| S7.4 | 🤖 | 역방향 발굴 큐 적재 (`scripts/find-discovery-candidates.mjs`) — search↑ AND mentions=0 인 제품/키워드 | 스크립트 | 큐 row 확인 |
| S7.5 | 🤖 | 일일 점수 산출 통합 (`scripts/compute-trending.mjs`) — 위 모두 호출 | 스크립트 | `trending_scores` 200 row |

### Phase 8 — 자동화 (예상 30분)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S8.1 | 🤖 | GitHub Actions workflow (`.github/workflows/daily-pipeline.yml`) — 매일 18:00 UTC (=03:00 KST) | yml | manual trigger 성공 |
| S8.2 | 🤖 | 시크릿 등록 안내 (사용자가 GitHub repo Settings → Secrets에 등록) | 안내 문서 | — |
| S8.3 | 👤 | GitHub repo 생성 + 시크릿 등록 + 첫 manual trigger | repo | Actions 탭에서 success |

### Phase 9 — UI (Week 2, 별도 세션)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S9.1 | 🤖 | 트렌딩 홈 (`/`) — mockup 디자인 → 실데이터 (Server Component) | `app/page.tsx` | 200 제품 카드 렌더링 |
| S9.2 | 🤖 | 제품 상세 (`/product/[id]`) — 3축 신호 + 광고 비율 시각화 | `app/product/[id]/page.tsx` | 신호 그래프 |
| S9.3 | 🤖 | 검색어 트렌드 (`/keywords`) | `app/keywords/page.tsx` | 차트 |
| S9.4 | 🤖 | 신상 리뷰 피드 (`/youtube`) — youtube_videos 정렬 | `app/youtube/page.tsx` | 영상 리스트 |
| S9.5 | 🤖 | 베타 가입 폼 + honeypot | `components/beta-form.tsx` | INSERT 동작 |
| S9.6 | 🤖 | 모바일 반응형 점검 | — | 모바일 뷰 OK |
| S9.7 | 🔗 | Vercel 배포 + 도메인 연결 | live URL | 외부 접속 OK |

### Phase 10 — 사용자 검증 (Week 2 끝)

| ID | 누가 | 작업 | 산출물 | 검증 |
|---|---|---|---|---|
| S10.1 | 👤 | 인터뷰 대상 3~5명 모집 (인스타 DM/지인) | 명단 | — |
| S10.2 | 👤 | 30분 데모 + 행동 관찰 (시간/저장/공유) | 인터뷰 노트 | — |
| S10.3 | 👤 | 라벨 정확도 평가 (🔥 라벨 제품 중 "들어본 적 있다" + "사고 싶다" 비율) | 평가 시트 | ≥ 60% 목표 |
| S10.4 | 🔗 | 가중치/임계 튜닝 (사용자 피드백 기반) | `lib/scoring/composite.ts` 수정 | v2.1 |

---

## 11. 14번 자산 재사용 정책

| 14번 자산 | 15번에서 |
|---|---|
| `data/creator-discovery.json` (709 → 303 채널, inactive pruned) | ✅ JSON만 복사 → `data/seed-channels.json` |
| Supabase 4개 테이블 (creators/videos/keywords/beta_signups) | ❌ 안 씀 (새 프로젝트) |
| YouTube 영상 데이터 | ❌ 새로 수집 |
| 협찬 분류 결과 | ❌ B2B용 (무관) |
| `scripts/discover-oliveyoung.mjs` | ❌ 목적 다름 (재사용 안 함) |
| YouTube quota 노하우 (`search.list` 100u 주의) | ✅ 노하우만 (Phase 4에 반영) |
| `scripts/fetch-all.mjs` 채널 기반 패턴 | ✅ 참고 (코드는 새로) |
| GLM 호출 패턴 | ❌ GLM 미사용 |

---

## 12. 보안 정책

- `.env*` git 커밋 절대 금지 (`.gitignore` 1순위 + `.env.local.example`만 커밋)
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` — 서버/스크립트 전용
- **노출 키 회전**: 사용자 결정으로 미실행 (위험 인지함). 개발 종료 시점에 재안내
- 크롤링: User-Agent 명시, 1.5초 sleep, 매일 1회만, robots.txt 준수, 차단 감지 시 멈춤
- pre-commit hook으로 시크릿 패턴 스캔 (Phase 1.x에 추가 검토)

---

## 13. 결정 보류 사항

| 항목 | 보류 사유 | 검토 시점 |
|---|---|---|
| 결제 PG | 사업자등록 없음 | 사업자 취득 시 |
| 도메인 | clickyy.io 가용성 미확인 | Week 2 |
| 가중치 (0.30/0.40/0.30) | 데이터 1주분 보고 결정 | Week 2 Day 5 (S10.4) |
| LLM 광고 분류 도입 | 룰 false negative 검증 필요 | Week 3+ |
| 무신사뷰티/컬리뷰티 | MVP 검증 후 | Week 3+ |
| 인스타/틱톡 | API 제약 | v2 |

---

## 14. 성공 지표

- [ ] **Day 1 끝**: `localhost:3000`에서 클린 민트 톤 임시 홈 렌더링 + Supabase 연결 OK
- [ ] **Phase 5 끝**: 200제품에 대해 광고 분류 + 제품 매칭 결과 DB 적재
- [ ] **Phase 8 끝**: GitHub Actions가 매일 자동 실행되어 `trending_scores` 채워짐 (Day 7+ stable)
- [ ] **Week 2 끝**: 비테크 뷰티 크리에이터 3~5명 데모, 행동 지표 수집
- [ ] **라벨 정확도**: 🔥 제품 중 "들어본 적 있다" + "사고 싶다" 응답 ≥ 60%
- [ ] **재방문 의향**: "주 N회 방문하겠다" 평균 ≥ 3회

---

## 부록 A: 한국 뷰티 이커머스 공식 API 매트릭스

| 사이트 | 공식 API | MVP 활용 |
|---|---|---|
| 올리브영 | ❌ 크롤만 | ✅ Week 1 |
| 무신사뷰티 | ❌ 크롤만 | 🔵 Week 3+ |
| 컬리뷰티 | ❌ 크롤만 | 🔵 Week 3+ |
| 다이소 / 11번가 | ❌ 크롤만 | ❌ |
| 쿠팡 (파트너스) | 🟡 제휴 | ❌ 사용자 의사 없음 |
| 네이버 쇼핑 검색 | ✅ 무료/공식 | ✅ Week 1 |
| 네이버 데이터랩 검색어 | ✅ 무료/공식 (보유) | ✅ Week 1 |
| 네이버 쇼핑 인사이트 | ✅ 별도 가입 | 🔵 Week 3+ |
| YouTube Data API | ✅ 보유 | ✅ Week 1 |
| Instagram Graph | ❌ 사실상 X | ❌ |
| TikTok Research | 🟡 학술용 | ❌ |

---

## 부록 B: Phase별 예상 소요시간 합계

| Phase | 예상 시간 | 비고 |
|---|---|---|
| Phase 0 | 10분 | |
| Phase 1 | 60분 | |
| Phase 2 | 45분 | |
| Phase 3 | 90분 | 올리브영 페이지 분석 변동성 ↑ |
| Phase 4 | 90분 | |
| Phase 5 | 60분 | |
| Phase 6 | 45분 | |
| Phase 7 | 60분 | |
| Phase 8 | 30분 | + S8.3 사용자 액션 |
| **합계 (Phase 0~8)** | **~7시간** | 한 세션에 가능 |
| Phase 9 (UI) | ~3시간 | 별도 세션 |
| Phase 10 (검증) | 1주 | 사용자 일정 |
