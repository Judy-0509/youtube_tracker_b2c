# 클리키 (Clickyy B2C)

뷰티 크리에이터를 위한 트렌드 디스커버리 SaaS.  
올리브영 랭킹 · YouTube 버즈 · 네이버 검색량 3축 신호를 합산해 **"지금 뜨는 뷰티 제품"** 을 매일 업데이트합니다.

## Tech Stack

| 영역 | 사용 기술 |
|------|----------|
| Frontend | Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · Pretendard |
| Backend | Supabase (Postgres 17 + Auth, 서울 리전) |
| 수집 | Playwright Chromium · YouTube Data API v3 · 네이버 데이터랩 API |
| 인프라 | GitHub Actions (daily cron) |

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # 실제 키 채우기
npm run dev
```

브라우저에서 http://localhost:3000  
DB 상태 확인: http://localhost:3000/admin/status

## 환경변수

`.env.local.example` 참고. 필요한 키:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
YOUTUBE_API_KEY
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
```

## 데이터 파이프라인 (일일 자동화)

아래 스크립트를 순서대로 실행합니다. Phase 8에서 GitHub Actions cron으로 자동화 예정.

```bash
# 1. 올리브영 베스트 크롤
node --env-file=.env.local scripts/scrape-oliveyoung.mjs

# 2. YouTube 채널 영상 수집 (302개 채널)
node --env-file=.env.local scripts/fetch-youtube-daily.mjs

# 3. 광고 분류 (Tier1+2 룰 기반)
node --env-file=.env.local scripts/classify-ads.mjs

# 4. 영상 ↔ 제품 매칭
node --env-file=.env.local scripts/match-products.mjs

# 5. 네이버 검색 트렌드
node --env-file=.env.local scripts/fetch-naver-trends.mjs

# 6. 네이버 쇼핑 가격
node --env-file=.env.local scripts/fetch-naver-shopping.mjs

# 7. 트렌딩 점수 계산
node --env-file=.env.local scripts/compute-trending.mjs

# 8. 발굴 큐 적재
node --env-file=.env.local scripts/find-discovery-candidates.mjs
```

## 트렌딩 점수 계산

3축 신호를 z-score 정규화 후 가중합:

```
composite_score = 0.40 × rank_z + 0.35 × youtube_z + 0.25 × search_z
```

| Tier | 조건 |
|------|------|
| `confirmed` | composite ≥ 0.8 + organic 비중 ≥ 40% |
| `buzz_only` | YouTube 버즈 있지만 랭킹 미확인 |
| `newly_discovered` | 검색 급등, YouTube 언급 없음 |
| `detecting` | 모니터링 중 (기본) |

UI에서 광고 포함/제외 토글: `youtube_buzz_score × organic_buzz_ratio`

## 광고 분류

- **Tier 1**: 제목·설명·해시태그에서 `ad_keywords` 테이블 스캔
- **Tier 2**: 채널 주인 댓글에서 광고 문구 탐지 (가중치 1.5×)

## 프로젝트 구조

```
app/                  # Next.js App Router 페이지
  admin/status/       # DB 상태 대시보드
lib/
  youtube/            # YouTube API 클라이언트 모듈
  naver/              # 네이버 데이터랩·쇼핑 클라이언트
  classifier/         # 광고 분류기
  matcher/            # 제품 언급 매처
  scoring/            # 트렌딩 점수 계산·티어 라벨
  scrapers/           # 올리브영 HTML 파서
  normalize/          # 제품명 정규화
  supabase/           # Supabase 클라이언트 (client/server/admin)
scripts/              # 일일 수집·계산 스크립트
data/
  seed-channels.json  # 302개 뷰티 채널 시드
supabase/migrations/  # DB 마이그레이션 SQL
```

## 진행 상황

- [x] Phase 0 — 사전 준비 (채널 시드, .gitignore)
- [x] Phase 1 — 인프라 (Next.js, Supabase, 환경변수)
- [x] Phase 2 — DB 스키마 + RLS
- [x] Phase 3 — 올리브영 크롤러 (Playwright, 86개 제품)
- [x] Phase 4 — YouTube 채널 수집 (642개 영상, 108개 주인 댓글)
- [x] Phase 5 — 광고 분류 + 제품 매칭 (sponsored 128개 / organic 514개)
- [x] Phase 6 — 네이버 데이터랩 + 쇼핑 (671개 트렌드 rows)
- [x] Phase 7 — 트렌딩 점수 계산 (86개 제품, 4-tier)
- [ ] Phase 8 — GitHub Actions 일일 자동화
- [ ] Phase 9 — UI 구현 (트렌딩 홈, 제품 상세, 키워드 페이지)

## 보안

- `.env.local` 절대 커밋 금지 (.gitignore 적용됨)
- `SUPABASE_SERVICE_ROLE_KEY` 서버·스크립트 전용
- `data/raw-*` 크롤 원본 파일 커밋 제외
