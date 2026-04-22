/**
 * 4-tier badge. Server Component.
 *
 * confirmed         → "확정 트렌드"  (deep forest fill)
 * buzz_only         → "버즈 집중"    (terracotta tint)
 * newly_discovered  → "신규 감지"    (sage tint)
 * detecting         → "탐지 중"     (muted gray)
 */

export type TierKey = 'confirmed' | 'buzz_only' | 'newly_discovered' | 'detecting'

const TIER_META: Record<
  TierKey,
  { label: string; container: string; dot: string }
> = {
  confirmed: {
    label: '확정 트렌드',
    container: 'bg-primary text-surface border border-transparent',
    dot: 'bg-surface',
  },
  buzz_only: {
    label: '버즈 집중',
    container: 'bg-terracotta/15 text-terracotta border border-terracotta/30',
    dot: 'bg-terracotta',
  },
  newly_discovered: {
    label: '신규 감지',
    container: 'bg-sage/15 text-sage border border-sage/30',
    dot: 'bg-sage',
  },
  detecting: {
    label: '탐지 중',
    container: 'bg-ink-4/20 text-ink-3 border border-transparent',
    dot: 'bg-ink-3',
  },
}

export function TierBadge({ tier }: { tier: TierKey }) {
  const meta = TIER_META[tier] ?? TIER_META.detecting
  return (
    <span
      className={`inline-flex items-center gap-[6px] py-[4px] px-[9px] rounded-md text-[11px] font-bold tracking-[0.02em] whitespace-nowrap ${meta.container}`}
    >
      <span className={`w-[6px] h-[6px] rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}
