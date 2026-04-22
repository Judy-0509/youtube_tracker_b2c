const SHOPPING_URL = 'https://openapi.naver.com/v1/search/shop.json'

export type ShoppingResult = {
  keyword: string
  avgPrice: number | null
  reviewCount: number
  itemCount: number
}

type ShoppingItem = {
  lprice: string
  hprice: string
  reviewCount?: number
}

type ShoppingResponse = {
  total: number
  items: ShoppingItem[]
}

/**
 * 네이버 쇼핑 검색 API.
 * 키워드로 검색해 평균가·리뷰수 반환.
 */
export async function fetchShoppingInfo(
  clientId: string,
  clientSecret: string,
  keyword: string,
  display = 20,
): Promise<ShoppingResult> {
  const url = new URL(SHOPPING_URL)
  url.searchParams.set('query', keyword)
  url.searchParams.set('display', String(display))
  url.searchParams.set('sort', 'sim')

  const res = await fetch(url.toString(), {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shopping API HTTP ${res.status}: ${text}`)
  }

  const json = (await res.json()) as ShoppingResponse
  const items = json.items ?? []

  // 유효 가격만 추출해 평균 계산
  const prices = items
    .map((item) => {
      const low = Number(item.lprice)
      const high = Number(item.hprice)
      if (low > 0 && high > 0) return Math.round((low + high) / 2)
      return low > 0 ? low : null
    })
    .filter((p): p is number => p !== null)

  const avgPrice = prices.length > 0
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : null

  const reviewCount = items.reduce((s, item) => s + (item.reviewCount ?? 0), 0)

  return {
    keyword,
    avgPrice,
    reviewCount,
    itemCount: json.total,
  }
}
