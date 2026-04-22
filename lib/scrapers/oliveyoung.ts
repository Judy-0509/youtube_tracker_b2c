/**
 * 올리브영 베스트 리스트 페이지 HTML 파서.
 * 입력: getBestList.do의 rendered HTML (Playwright 출력)
 * 출력: 제품 메타 배열
 */

export type OYProduct = {
  goodsNo: string
  brand: string
  name: string
  rank: number
  categoryCode: string         // '01' (대카테고리 코드)
  categoryFull: string         // '01 > 마스크팩 > 시트팩'
  price: number | null         // 할인가 우선, 없으면 정가
  originalPrice: number | null
  imageUrl: string | null
  productUrl: string
  reviewScore: number | null   // 0~10 점
}

const BASE = 'https://www.oliveyoung.co.kr'

function extract(text: string, re: RegExp, decodeEntities = false): string | null {
  const m = text.match(re)
  if (!m) return null
  let v = m[1]
  if (decodeEntities) v = v.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  return v
}

function parsePrice(s: string | null): number | null {
  if (!s) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function parseBestList(html: string): OYProduct[] {
  // distinct goodsNo의 첫 등장 위치 수집
  const matches = [...html.matchAll(/data-ref-goodsno="(A\d+)"/gi)]
  const firstPos = new Map<string, number>()
  for (const m of matches) {
    if (!firstPos.has(m[1])) firstPos.set(m[1], m.index!)
  }

  const positions = [...firstPos.entries()].sort((a, b) => a[1] - b[1])
  const products: OYProduct[] = []

  for (let i = 0; i < positions.length; i++) {
    const [goodsNo, pos] = positions[i]
    const nextPos = i + 1 < positions.length ? positions[i + 1][1] : html.length
    const card = html.substring(Math.max(0, pos - 300), Math.min(html.length, nextPos + 100))

    const brand = extract(card, /data-ref-goodsbrand="([^"]+)"/i)
    const name = extract(card, /data-ref-goodsnm="([^"]+)"/i)
    const categoryFull = extract(card, /data-ref-goodscategory="([^"]+)"/i, true)
    const trackingRaw = extract(card, /data-ref-goodstrackingno="([^"]+)"/i)
    const rankFromBest = extract(card, /<span class="thumb_flag best">(\d+)</)

    const discount = parsePrice(extract(card, /<span class="tx_cur"><span class="tx_num">([\d,]+)/))
    const original = parsePrice(extract(card, /<span class="tx_org"><span class="tx_num">([\d,]+)/))

    const imageUrl = extract(card, /<img src="(https:\/\/image\.oliveyoung\.co\.kr\/[^"]+)"/)

    const reviewWidth = extract(card, /<span class="point" style="width:(\d+(?:\.\d+)?)%">/)
    const reviewScore = reviewWidth ? Math.round((Number(reviewWidth) / 10) * 10) / 10 : null

    if (!brand || !name || !categoryFull) continue

    const trackingNo = trackingRaw ? Number(trackingRaw) : NaN
    const rank = rankFromBest ? Number(rankFromBest) : Number.isFinite(trackingNo) ? trackingNo : i + 1

    products.push({
      goodsNo,
      brand: brand.trim(),
      name: name.trim(),
      rank,
      categoryCode: categoryFull.split('>')[0].trim(),
      categoryFull,
      price: discount ?? original,
      originalPrice: original,
      imageUrl: imageUrl || null,
      productUrl: `${BASE}/store/goods/getGoodsDetail.do?goodsNo=${goodsNo}`,
      reviewScore,
    })
  }

  return products
}

/**
 * Cloudflare/안티봇 챌린지 페이지 감지.
 * title이 "잠시만 기다려" 시작이거나, body가 너무 작으면 챌린지로 판단.
 */
export function detectChallenge(html: string): { challenged: boolean; reason?: string } {
  const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
  if (title.includes('잠시만 기다려') || title.toLowerCase().includes('attention required')) {
    return { challenged: true, reason: `title: "${title}"` }
  }
  if (html.length < 100_000) {
    return { challenged: true, reason: `too small: ${html.length} bytes` }
  }
  return { challenged: false }
}
