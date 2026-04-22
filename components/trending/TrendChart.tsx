'use client'

/**
 * 7일 / 14일 트렌드 라인차트. 외부 의존성 없는 순수 SVG.
 *
 * 4 series: composite (primary line + area), rank (sage), youtube (terracotta), search (bone-2 dashed).
 */
import { useMemo, useState } from 'react'
import type { TrendingHistoryPoint } from '@/lib/data/trending'

type Period = 7 | 14

const COLORS = {
  composite: '#1F3A2E',
  rank: '#5A7A5E',
  youtube: '#C97B5A',
  search: '#D7CDB0',
}

function formatXLabel(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}.${dd}`
}

export function TrendChart({ history }: { history: TrendingHistoryPoint[] }) {
  const [period, setPeriod] = useState<Period>(7)

  const points = useMemo(() => {
    if (!history.length) return []
    return history.slice(-period)
  }, [history, period])

  const W = 900
  const H = 260
  const padL = 50
  const padR = 20
  const padT = 20
  const padB = 40
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const chart = useMemo(() => {
    if (points.length === 0) return null

    const compArr = points.map((p) => p.composite_score)
    const rankArr = points.map((p) => Math.abs(p.rank_change_7d ?? 0))
    const ytArr = points.map((p) => p.youtube_buzz_score ?? 0)
    const srchArr = points.map((p) => p.search_growth_score ?? 0)

    const allVals = [...compArr, ...rankArr, ...ytArr, ...srchArr]
    const rawMax = Math.max(...allVals, 1)
    const max = Math.ceil(rawMax / 10) * 10 + 10
    const min = 0

    const x = (i: number) =>
      padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = (v: number) => padT + (1 - (v - min) / (max - min)) * innerH

    const pathFor = (arr: number[]) =>
      arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

    const compPath = pathFor(compArr)
    const areaPath = `${compPath} L ${x(points.length - 1).toFixed(1)} ${y(min).toFixed(1)} L ${x(0).toFixed(1)} ${y(min).toFixed(1)} Z`

    return {
      compPath,
      areaPath,
      rankPath: pathFor(rankArr),
      ytPath: pathFor(ytArr),
      searchPath: pathFor(srchArr),
      x,
      y,
      max,
      min,
      compArr,
    }
  }, [points, innerW, innerH])

  return (
    <section className="bg-card border border-line rounded-2xl px-8 py-7 mb-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="text-[18px] font-bold tracking-[-0.025em] mb-1">
            {period}일 점수 추이
          </h3>
          <div className="text-[13px] text-ink-3">복합 점수와 3-축 세부 신호</div>
        </div>
        <div className="flex gap-1 bg-surface border border-line p-[3px] rounded-lg">
          {[7, 14].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p as Period)}
              className={`py-[5px] px-[11px] rounded-md text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-card text-primary font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-ink-3'
              }`}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-[18px] mb-[18px] text-xs">
        <div className="flex items-center gap-[6px] text-ink-2 font-medium">
          <span className="w-3 h-[3px] rounded-sm" style={{ background: COLORS.composite }} />
          복합 점수
        </div>
        <div className="flex items-center gap-[6px] text-ink-2 font-medium">
          <span className="w-3 h-[3px] rounded-sm" style={{ background: COLORS.rank }} />
          랭킹
        </div>
        <div className="flex items-center gap-[6px] text-ink-2 font-medium">
          <span className="w-3 h-[3px] rounded-sm" style={{ background: COLORS.youtube }} />
          YouTube
        </div>
        <div className="flex items-center gap-[6px] text-ink-2 font-medium">
          <span className="w-3 h-[3px] rounded-sm" style={{ background: COLORS.search }} />
          검색
        </div>
      </div>

      <div className="relative h-[260px]">
        {!chart ? (
          <div className="h-full grid place-items-center text-sm text-ink-3">
            아직 충분한 시계열 데이터가 없습니다.
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full block">
            <defs>
              <linearGradient id="compArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={COLORS.composite} stopOpacity="0.18" />
                <stop offset="100%" stopColor={COLORS.composite} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* gridlines */}
            {[0, 1, 2, 3, 4].map((g) => {
              const gv = chart.min + ((chart.max - chart.min) * g) / 4
              const gy = chart.y(gv)
              return (
                <g key={g}>
                  <line
                    x1={padL}
                    x2={W - padR}
                    y1={gy}
                    y2={gy}
                    stroke="#E3DCC7"
                    strokeWidth={1}
                    strokeDasharray={g === 0 ? undefined : '2 4'}
                  />
                  <text
                    x={padL - 10}
                    y={gy + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#9AA49C"
                    fontFamily="Pretendard"
                    fontWeight={500}
                  >
                    {Math.round(gv)}
                  </text>
                </g>
              )
            })}

            {/* x labels */}
            {points.map((p, i) => (
              <text
                key={p.date}
                x={chart.x(i)}
                y={H - 15}
                textAnchor="middle"
                fontSize="11"
                fill="#6B7870"
                fontFamily="Pretendard"
                fontWeight={500}
              >
                {formatXLabel(p.date)}
              </text>
            ))}

            <path d={chart.areaPath} fill="url(#compArea)" />
            <path d={chart.searchPath} stroke={COLORS.search} strokeWidth={2} fill="none" strokeDasharray="4 4" />
            <path d={chart.ytPath} stroke={COLORS.youtube} strokeWidth={2} fill="none" />
            <path d={chart.rankPath} stroke={COLORS.rank} strokeWidth={2} fill="none" />
            <path
              d={chart.compPath}
              stroke={COLORS.composite}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* dots on composite */}
            {chart.compArr.map((v, i) => {
              const isLast = i === chart.compArr.length - 1
              return (
                <circle
                  key={i}
                  cx={chart.x(i)}
                  cy={chart.y(v)}
                  r={isLast ? 5 : 3.5}
                  fill={COLORS.composite}
                  stroke="#fff"
                  strokeWidth={isLast ? 2.5 : 2}
                />
              )
            })}
          </svg>
        )}
      </div>
    </section>
  )
}
