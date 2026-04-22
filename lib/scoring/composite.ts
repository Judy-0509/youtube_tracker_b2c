export type RawSignals = {
  rankChange: number | null       // 양수 = 상승 (이전 rank - 현재 rank)
  youtubeBuzzRaw: number          // Σ log10(view_count+1) for mentions in 7d
  searchGrowth: number | null     // (최근7일 avg - 이전7일 avg) / 이전7일 avg
  organicCount: number
  totalMentionCount: number
}

export type NormalizedSignals = {
  rankZ: number
  youtubeZ: number
  searchZ: number
}

export type ScoringResult = {
  rankChange7d: number
  youtubeBuzzScore: number
  searchGrowthScore: number
  compositeScore: number
  organicBuzzRatio: number | null
  sponsoredRatio: number | null
  isProvisional: boolean
}

// 가중치
const W_RANK = 0.40
const W_YOUTUBE = 0.35
const W_SEARCH = 0.25

function mean(vals: number[]): number {
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function std(vals: number[], m: number): number {
  if (vals.length < 2) return 1
  const variance = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length
  return Math.sqrt(variance) || 1
}

function zScore(val: number, m: number, s: number): number {
  return Math.max(-3, Math.min(3, (val - m) / s))
}

/**
 * 제품 배열의 raw 신호를 받아 z-score 정규화 후 composite score 계산.
 * 전체 제품을 한 번에 받아야 정규화 기준이 생긴다.
 */
export function computeCompositeScores(
  products: { productId: string; signals: RawSignals; isProvisional: boolean }[],
): Map<string, ScoringResult> {
  // null → 0 처리 후 정규화 기준 계산
  const rankVals = products.map((p) => p.signals.rankChange ?? 0)
  const ytVals = products.map((p) => p.signals.youtubeBuzzRaw)
  const srchVals = products.map((p) => p.signals.searchGrowth ?? 0)

  const rankMean = mean(rankVals);  const rankStd = std(rankVals, rankMean)
  const ytMean = mean(ytVals);      const ytStd = std(ytVals, ytMean)
  const srchMean = mean(srchVals);  const srchStd = std(srchVals, srchMean)

  const results = new Map<string, ScoringResult>()

  for (const p of products) {
    const s = p.signals
    const rankZ = zScore(s.rankChange ?? 0, rankMean, rankStd)
    const ytZ = zScore(s.youtubeBuzzRaw, ytMean, ytStd)
    const srchZ = zScore(s.searchGrowth ?? 0, srchMean, srchStd)

    const composite = W_RANK * rankZ + W_YOUTUBE * ytZ + W_SEARCH * srchZ

    const organicBuzzRatio =
      s.totalMentionCount > 0 ? s.organicCount / s.totalMentionCount : null
    const sponsoredRatio =
      s.totalMentionCount > 0 ? (s.totalMentionCount - s.organicCount) / s.totalMentionCount : null

    results.set(p.productId, {
      rankChange7d: s.rankChange ?? 0,
      youtubeBuzzScore: s.youtubeBuzzRaw,
      searchGrowthScore: s.searchGrowth ?? 0,
      compositeScore: Math.round(composite * 1000) / 1000,
      organicBuzzRatio,
      sponsoredRatio,
      isProvisional: p.isProvisional,
    })
  }

  return results
}
