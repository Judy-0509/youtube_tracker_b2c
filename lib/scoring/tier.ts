export type Tier = 'confirmed' | 'detecting' | 'buzz_only' | 'newly_discovered'

type TierInput = {
  compositeScore: number
  youtubeBuzzScore: number       // raw (0 이상)
  rankChange7d: number
  searchGrowthScore: number
  organicBuzzRatio: number | null
}

/**
 * 4-tier 라벨 부여.
 *
 * confirmed       — composite 높음 + organic 비중 ≥ 40%
 * buzz_only       — YouTube 버즈 있지만 랭킹 확인 안 됨
 * newly_discovered — 검색량 급등 but YouTube 언급 없음 (역방향 발굴)
 * detecting       — 나머지 (기본 트렌딩 감지 중)
 */
export function assignTier(input: TierInput): Tier {
  const { compositeScore, youtubeBuzzScore, rankChange7d, searchGrowthScore, organicBuzzRatio } = input

  if (compositeScore >= 0.8 && (organicBuzzRatio === null || organicBuzzRatio >= 0.4)) {
    return 'confirmed'
  }

  if (youtubeBuzzScore > 0 && rankChange7d <= 0) {
    return 'buzz_only'
  }

  if (searchGrowthScore > 0.3 && youtubeBuzzScore === 0) {
    return 'newly_discovered'
  }

  return 'detecting'
}
