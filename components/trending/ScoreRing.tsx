'use client'

/**
 * 44×44 SVG progress ring. Used inside the trending row score column.
 * `pct` is 0..100.
 */
export function ScoreRing({ pct }: { pct: number }) {
  const safe = Math.max(0, Math.min(100, pct))
  const circumference = 2 * Math.PI * 16 // ≈ 100.53
  const offset = circumference * (1 - safe / 100)

  return (
    <div className="relative w-11 h-11">
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
        <circle
          cx="22"
          cy="22"
          r="16"
          strokeWidth={4}
          fill="none"
          stroke="#E8E1CC"
        />
        <circle
          cx="22"
          cy="22"
          r="16"
          strokeWidth={4}
          fill="none"
          stroke="#1F3A2E"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s' }}
        />
      </svg>
    </div>
  )
}
