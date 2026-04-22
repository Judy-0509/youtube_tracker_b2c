// 마케팅 노이즈 단어 — 매칭 토큰 생성 시 제거
const NOISE_RE =
  /\b(기획|증정|특별|대용량|골라담기|[0-9]+종|중\s*택\s*[0-9]+|판매|한정|세트|구성|set|스페셜|에디션|edition|\d+매|\d+ml|\d+g|\d+정|\d+캡슐|\d+개)\b/gi

// 검색·매칭용 정규화 (소문자, 특수문자 → 공백)
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 제품 normalized_name에서 매칭 토큰 생성.
 * 예: "메디힐 더마 패드 200매 대용량 특별 구성 3종 중 택 1"
 *  → "메디힐 더마 패드" (앞 3개 유효 단어)
 */
function buildMatchToken(normalizedName: string, brandName: string): string {
  const cleaned = normalizedName
    .replace(NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ').filter((w) => w.length >= 2)

  // 브랜드명이 앞에 없으면 붙임
  const brandNorm = normalize(brandName)
  const leadWords = words.slice(0, 4)
  const joined = leadWords.join(' ')

  return joined.includes(brandNorm.split(' ')[0]) ? joined : `${brandNorm} ${joined}`
}

export type ProductRecord = {
  id: string
  normalizedName: string
  brandName: string
}

export type MentionMatch = {
  product_id: string
  matched_text: string
}

/**
 * 영상 텍스트(제목+설명+해시태그)에서 제품 언급 탐지.
 * 2글자 이상의 매칭 토큰이 비디오 텍스트에 포함되면 매칭.
 */
export function detectMentions(
  videoText: string,
  products: ProductRecord[],
): MentionMatch[] {
  const normText = normalize(videoText)
  const matches: MentionMatch[] = []
  const seen = new Set<string>()

  for (const product of products) {
    const token = buildMatchToken(product.normalizedName, product.brandName)
    if (token.length < 4) continue  // 너무 짧은 토큰은 오탐 방지

    if (normText.includes(normalize(token)) && !seen.has(product.id)) {
      seen.add(product.id)
      matches.push({ product_id: product.id, matched_text: token })
    }
  }

  return matches
}

export { buildMatchToken, normalize }
