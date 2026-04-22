/**
 * 3-axis signal bars (랭킹 / 유튜브 / 검색). Server Component.
 *
 * Each row: [icon · label] | bar | numeric value
 * Values are clamped 0..100 (% fill); displayed numeric is the raw axis value.
 */

type SignalBarsProps = {
  rank: { value: number; pct: number }
  youtube: { value: number; pct: number }
  search: { value: number; pct: number }
}

const ROW = 'grid grid-cols-[52px_1fr_42px] gap-[10px] items-center text-[11px]'

function clampPct(p: number): number {
  if (Number.isNaN(p)) return 0
  return Math.max(0, Math.min(100, p))
}

export function SignalBars({ rank, youtube, search }: SignalBarsProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className={ROW}>
        <div className="text-ink-3 font-semibold flex items-center gap-[5px]">
          <span className="w-[14px] h-[14px] rounded-[3px] grid place-items-center text-[9px] font-bold bg-primary text-surface">
            R
          </span>
          랭킹
        </div>
        <div className="h-[6px] bg-bone rounded-full overflow-hidden relative">
          <span
            className="absolute top-0 left-0 bottom-0 rounded-full bg-primary"
            style={{ width: `${clampPct(rank.pct)}%`, transition: 'width 0.3s' }}
          />
        </div>
        <div className="text-right text-[11px] font-semibold text-ink-2 num">
          {Math.round(rank.value)}
        </div>
      </div>

      <div className={ROW}>
        <div className="text-ink-3 font-semibold flex items-center gap-[5px]">
          <span className="w-[14px] h-[14px] rounded-[3px] grid place-items-center text-[9px] font-bold bg-terracotta text-white">
            Y
          </span>
          유튜브
        </div>
        <div className="h-[6px] bg-bone rounded-full overflow-hidden relative">
          <span
            className="absolute top-0 left-0 bottom-0 rounded-full bg-terracotta"
            style={{ width: `${clampPct(youtube.pct)}%`, transition: 'width 0.3s' }}
          />
        </div>
        <div className="text-right text-[11px] font-semibold text-ink-2 num">
          {Math.round(youtube.value)}
        </div>
      </div>

      <div className={ROW}>
        <div className="text-ink-3 font-semibold flex items-center gap-[5px]">
          <span className="w-[14px] h-[14px] rounded-[3px] grid place-items-center text-[9px] font-bold bg-sage text-white">
            S
          </span>
          검색
        </div>
        <div className="h-[6px] bg-bone rounded-full overflow-hidden relative">
          <span
            className="absolute top-0 left-0 bottom-0 rounded-full bg-sage"
            style={{ width: `${clampPct(search.pct)}%`, transition: 'width 0.3s' }}
          />
        </div>
        <div className="text-right text-[11px] font-semibold text-ink-2 num">
          {Math.round(search.value)}
        </div>
      </div>
    </div>
  )
}
