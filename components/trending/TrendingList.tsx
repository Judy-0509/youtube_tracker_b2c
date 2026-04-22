'use client'

/**
 * 트렌딩 홈의 인터랙티브 래퍼.
 * 서버에서 받은 products를 client-side filter / ad toggle로 거름.
 */
import { useMemo, useState } from 'react'
import type { TrendingProduct } from '@/lib/data/trending'
import { ProductRow, type ProductRowItem } from './ProductRow'
import type { TierKey } from './TierBadge'

type FilterKey = 'all' | TierKey

const FILTERS: { key: FilterKey; label: string; dot: string | null }[] = [
  { key: 'all', label: '전체', dot: null },
  { key: 'confirmed', label: '확정 트렌드', dot: 'bg-primary' },
  { key: 'buzz_only', label: '버즈 집중', dot: 'bg-terracotta' },
  { key: 'newly_discovered', label: '신규 감지', dot: 'bg-sage' },
]

const ORGANIC_THRESHOLD = 0.4

/**
 * composite_score는 z-score 합 (보통 -3..+3 범위) — UI 표시용 0..100 정규화.
 * 가장 높은 점수를 100으로, 0 미만은 0으로 클램프.
 */
function buildDisplayScores(products: TrendingProduct[]): Map<string, number> {
  const scores = new Map<string, number>()
  if (products.length === 0) return scores

  const maxComp = Math.max(...products.map((p) => p.composite_score), 0.0001)
  for (const p of products) {
    const ratio = Math.max(0, p.composite_score) / maxComp
    scores.set(p.id, Math.round(ratio * 100))
  }
  return scores
}

/** signal raw 값을 0..100로 정규화 (max 기준). */
function buildAxisNormalizers(products: TrendingProduct[]) {
  const maxYt = Math.max(...products.map((p) => p.youtube_buzz_score ?? 0), 0.0001)
  const maxSearch = Math.max(...products.map((p) => p.search_growth_score ?? 0), 0.0001)
  const maxRank = Math.max(...products.map((p) => Math.abs(p.rank_change_7d ?? 0)), 0.0001)
  return { maxYt, maxSearch, maxRank }
}

export function TrendingList({ products }: { products: TrendingProduct[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [adExcluded, setAdExcluded] = useState(false)

  const displayScores = useMemo(() => buildDisplayScores(products), [products])
  const axis = useMemo(() => buildAxisNormalizers(products), [products])

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: products.length,
      confirmed: 0,
      buzz_only: 0,
      newly_discovered: 0,
      detecting: 0,
    }
    for (const p of products) {
      const tier = (p.tier as TierKey) ?? 'detecting'
      c[tier] = (c[tier] ?? 0) + 1
    }
    return c
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filter !== 'all' && p.tier !== filter) return false
      if (adExcluded) {
        // 광고 제외 토글: organic ratio가 임계 미만이면 숨김
        if (p.organic_buzz_ratio !== null && p.organic_buzz_ratio < ORGANIC_THRESHOLD) {
          return false
        }
      }
      return true
    })
  }, [products, filter, adExcluded])

  const items: ProductRowItem[] = filtered.map((p, idx) => {
    const composite = displayScores.get(p.id) ?? 0
    const ytPct = ((p.youtube_buzz_score ?? 0) / axis.maxYt) * 100
    const searchPct = ((p.search_growth_score ?? 0) / axis.maxSearch) * 100
    const rankPct = (Math.abs(p.rank_change_7d ?? 0) / axis.maxRank) * 100
    return {
      id: p.id,
      rank: idx + 1,
      rankDelta: p.rank_change_7d,
      brand: p.brand_name,
      name: p.name,
      tags: [p.category].filter(Boolean),
      imageUrl: p.image_url,
      tier: (p.tier as TierKey) ?? 'detecting',
      composite,
      signalRank: rankPct,
      signalYoutube: ytPct,
      signalSearch: searchPct,
    }
  })

  return (
    <>
      {/* Controls bar */}
      <section className="flex items-center gap-3 mb-5 flex-wrap">
        <div
          role="tablist"
          className="flex gap-[6px] bg-card border border-line p-1 rounded-[10px]"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`py-2 px-[14px] rounded-[7px] text-[13px] font-medium flex items-center gap-[6px] transition-colors ${
                  active
                    ? 'bg-primary text-surface'
                    : 'text-ink-2 hover:text-primary'
                }`}
              >
                {f.dot && (
                  <span className={`w-[6px] h-[6px] rounded-full ${f.dot}`} />
                )}
                {f.label}
                <span
                  className={`text-[11px] font-semibold px-[6px] rounded-full num ${
                    active
                      ? 'bg-surface/20 text-surface'
                      : 'bg-surface text-ink-4'
                  }`}
                >
                  {counts[f.key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-[10px] bg-card border border-line py-2 px-[14px] rounded-[10px] text-[13px]">
          <div>
            <div className="font-medium text-ink-2">광고 포스트 제외</div>
            <div className="text-[11px] text-ink-4">오가닉 Buzz 비율만</div>
          </div>
          <button
            type="button"
            aria-pressed={adExcluded}
            onClick={() => setAdExcluded((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              adExcluded ? 'bg-primary' : 'bg-bone-2'
            }`}
          >
            <span
              className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-[left] ${
                adExcluded ? 'left-[18px]' : 'left-[2px]'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-card border border-line py-[9px] px-[14px] rounded-[10px] text-[13px] font-medium text-ink-2">
          정렬 <span className="text-primary font-semibold">복합 점수순 ↓</span>
        </div>
      </section>

      {/* Table */}
      <section className="bg-card border border-line rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[60px_1.6fr_110px_1fr_320px_130px] gap-4 px-6 py-[14px] bg-surface-2 border-b border-line text-[11px] font-bold tracking-[0.1em] uppercase text-ink-3">
          <div>#</div>
          <div>제품</div>
          <div>티어</div>
          <div>점수</div>
          <div>신호</div>
          <div className="text-right">액션</div>
        </div>
        {items.length === 0 ? (
          <div className="p-12 text-center text-ink-3 text-sm">
            조건에 맞는 제품이 없습니다.
          </div>
        ) : (
          items.map((item) => <ProductRow key={item.id} item={item} />)
        )}
      </section>
    </>
  )
}
