'use client'

/**
 * 한 줄짜리 트렌딩 제품 행. Client component (router.push).
 *
 * Layout grid: `60px 1.6fr 110px 1fr 320px 130px`
 *   1) rank + delta
 *   2) product image + brand/name/tags
 *   3) tier badge
 *   4) score (number + ring)
 *   5) 3-axis signal bars
 *   6) actions (bookmark + 상세 →)
 */
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ScoreRing } from './ScoreRing'
import { SignalBars } from './SignalBars'
import { TierBadge, type TierKey } from './TierBadge'

export type ProductRowItem = {
  id: string
  rank: number
  rankDelta: number | null // 양수=상승, 음수=하락, null=NEW
  brand: string
  name: string
  tags?: string[]
  imageUrl: string | null
  tier: TierKey
  composite: number          // 0..100 표시값
  signalRank: number         // 0..100
  signalYoutube: number      // 0..100
  signalSearch: number       // 0..100
}

const COL = 'grid grid-cols-[60px_1.6fr_110px_1fr_320px_130px] gap-4 items-center'

function RankDelta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="text-[10px] font-bold text-terracotta bg-terracotta/15 px-[5px] py-[1px] rounded-[3px]">
        NEW
      </span>
    )
  }
  if (delta === 0) return null
  const isUp = delta > 0
  return (
    <span
      className={`text-[10px] font-bold ${isUp ? 'text-sage' : 'text-terracotta'}`}
    >
      {isUp ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  )
}

export function ProductRow({ item }: { item: ProductRowItem }) {
  const router = useRouter()
  const handleNavigate = () => router.push(`/products/${item.id}`)

  const compositePct = Math.max(0, Math.min(100, item.composite))

  return (
    <div
      onClick={handleNavigate}
      className={`${COL} px-6 py-5 border-b border-line cursor-pointer transition-colors hover:bg-surface-2 last:border-b-0`}
    >
      {/* 1. rank */}
      <div className="text-[26px] font-bold tracking-[-0.03em] text-primary flex items-baseline gap-1">
        <span className="num">{String(item.rank).padStart(2, '0')}</span>
        <RankDelta delta={item.rankDelta} />
      </div>

      {/* 2. product */}
      <div className="flex items-center gap-[14px] min-w-0">
        <div className="w-14 h-14 rounded-[10px] bg-surface border border-line flex-shrink-0 overflow-hidden grid place-items-center relative">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              width={56}
              height={56}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0,transparent_5px,rgba(31,58,46,0.06)_5px,rgba(31,58,46,0.06)_10px)]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-ink-3 tracking-[0.02em] mb-[3px]">
            {item.brand}
          </div>
          <div className="text-[15px] font-bold tracking-[-0.02em] text-ink overflow-hidden text-ellipsis whitespace-nowrap">
            {item.name}
          </div>
          {item.tags && item.tags.length > 0 && (
            <div className="flex gap-[6px] mt-[5px]">
              {item.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-medium text-ink-3 bg-surface px-[7px] py-[2px] rounded border border-line"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. tier */}
      <div>
        <TierBadge tier={item.tier} />
      </div>

      {/* 4. composite score + ring */}
      <div className="flex items-center gap-[10px]">
        <div className="text-[22px] font-bold tracking-[-0.025em] text-primary min-w-[48px] num">
          {Math.round(item.composite)}
        </div>
        <ScoreRing pct={compositePct} />
      </div>

      {/* 5. signals */}
      <div>
        <SignalBars
          rank={{ value: item.signalRank, pct: item.signalRank }}
          youtube={{ value: item.signalYoutube, pct: item.signalYoutube }}
          search={{ value: item.signalSearch, pct: item.signalSearch }}
        />
      </div>

      {/* 6. actions */}
      <div className="flex gap-[6px] justify-end items-center">
        <button
          type="button"
          aria-label="저장"
          onClick={(e) => e.stopPropagation()}
          className="w-[34px] h-[34px] rounded-lg bg-surface border border-line text-ink-3 inline-flex items-center justify-center transition-colors hover:text-primary hover:border-line-2 flex-shrink-0"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-[14px] h-[14px]"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleNavigate()
          }}
          className="h-[34px] px-[14px] rounded-lg bg-primary text-surface text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0 hover:bg-primary-2 transition-colors"
        >
          상세 →
        </button>
      </div>
    </div>
  )
}
