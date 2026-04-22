export type AdStatus = 'sponsored' | 'organic' | 'unknown'

export type AdSignals = {
  tier1_title: string[]
  tier1_hashtags: string[]
  tier1_description: string[]
  tier2_owner_comment: boolean
}

export type AdClassification = {
  status: AdStatus
  confidence: number
  signals: AdSignals
}

export type AdKeyword = {
  pattern: string
  weight: number
  category: string
}

// ── 텍스트에서 매칭된 키워드 추출 ────────────────────────────
function scanText(text: string, keywords: AdKeyword[]): AdKeyword[] {
  if (!text) return []
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw.pattern.toLowerCase()))
}

/**
 * 단일 영상을 광고/유기 분류.
 *
 * Tier 1 — 제목·설명·해시태그에서 ad_keywords 스캔
 * Tier 2 — 채널 주인 댓글에서 ad_keywords 스캔 (가중치 1.5배)
 *
 * totalWeight >= 1.0 → sponsored
 * totalWeight === 0  → organic (confidence 0.85)
 * 0 < totalWeight < 1.0 → unknown
 */
export function classifyAd(
  video: {
    title: string
    description: string | null
    hashtags: string[]
  },
  ownerCommentTexts: string[],
  keywords: AdKeyword[],
): AdClassification {
  const titleMatches = scanText(video.title, keywords)
  const descMatches = scanText(video.description ?? '', keywords)
  const hashtagMatches = scanText(video.hashtags.join(' '), keywords)

  const commentText = ownerCommentTexts.join(' ')
  const commentMatches = scanText(commentText, keywords)
  const tier2 = commentMatches.length > 0

  const signals: AdSignals = {
    tier1_title: titleMatches.map((m) => m.pattern),
    tier1_hashtags: hashtagMatches.map((m) => m.pattern),
    tier1_description: descMatches.map((m) => m.pattern),
    tier2_owner_comment: tier2,
  }

  const tier1Weight = [...titleMatches, ...descMatches, ...hashtagMatches].reduce(
    (s, m) => s + m.weight,
    0,
  )
  const totalWeight = tier1Weight + (tier2 ? 1.5 : 0)

  if (totalWeight === 0) {
    return { status: 'organic', confidence: 0.85, signals }
  }

  const confidence = Math.min(0.99, 0.5 + totalWeight * 0.25)
  const status: AdStatus = totalWeight >= 1.0 ? 'sponsored' : 'unknown'

  return { status, confidence, signals }
}
