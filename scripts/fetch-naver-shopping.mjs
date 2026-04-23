#!/usr/bin/env node
/**
 * 네이버 쇼핑 검색 적재 스크립트.
 * 실행: node --env-file=.env.local scripts/fetch-naver-shopping.mjs
 *
 * 흐름:
 *  1. product_search_keywords (active) 로드
 *  2. 키워드별 쇼핑 API 호출 → 평균가·리뷰수
 *  3. shopping_validations UPSERT
 */
import { createClient } from '@supabase/supabase-js'

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  clientId: process.env.NAVER_CLIENT_ID,
  clientSecret: process.env.NAVER_CLIENT_SECRET,
}
if (!env.url || !env.serviceKey || !env.clientId || !env.clientSecret) {
  console.error('❌ 환경변수 누락')
  process.exit(1)
}

const SHOPPING_URL = 'https://openapi.naver.com/v1/search/shop.json'

// ── 쇼핑 API 호출 ─────────────────────────────────────────────
async function fetchShopping(keyword) {
  const url = new URL(SHOPPING_URL)
  url.searchParams.set('query', keyword)
  url.searchParams.set('display', '20')
  url.searchParams.set('sort', 'sim')

  const res = await fetch(url.toString(), {
    headers: {
      'X-Naver-Client-Id': env.clientId,
      'X-Naver-Client-Secret': env.clientSecret,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`Shopping HTTP ${res.status}: ${text}`)
    err.status = res.status
    throw err
  }

  const json = await res.json()
  const items = json.items ?? []

  // 유효 가격만 추출해 평균 계산
  const prices = items
    .map((item) => {
      const low = Number(item.lprice)
      const high = Number(item.hprice)
      if (low > 0 && high > 0) return Math.round((low + high) / 2)
      return low > 0 ? low : null
    })
    .filter((p) => p !== null)

  const avgPrice = prices.length > 0
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : null

  const reviewCount = items.reduce((s, item) => s + (Number(item.reviewCount) || 0), 0)

  return { avgPrice, reviewCount }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) 키워드 로드
  const { data: kwRows, error } = await supabase
    .from('product_search_keywords')
    .select('product_id, primary_keyword')
    .eq('status', 'active')
  if (error) { console.error('❌ 키워드 로드 실패:', error.message); process.exit(1) }

  // keyword → product_ids[] 매핑
  const kwMap = new Map()
  for (const row of kwRows ?? []) {
    if (!kwMap.has(row.primary_keyword)) kwMap.set(row.primary_keyword, [])
    kwMap.get(row.primary_keyword).push(row.product_id)
  }

  const uniqueKeywords = [...kwMap.keys()]
  console.log(`🛍️  고유 키워드: ${uniqueKeywords.length}개`)

  // 2) 키워드별 쇼핑 API 호출
  console.log('\n📡 네이버 쇼핑 API 호출...')
  const today = new Date(Date.now() + 9*3600000).toISOString().split('T')[0]
  const rows = []
  let apiErrors = 0

  for (let i = 0; i < uniqueKeywords.length; i++) {
    const keyword = uniqueKeywords[i]
    process.stdout.write(`  [${i + 1}/${uniqueKeywords.length}] ${keyword.substring(0, 20)}...\r`)

    try {
      const { avgPrice, reviewCount } = await fetchShopping(keyword)
      const productIds = kwMap.get(keyword) ?? []
      for (const productId of productIds) {
        rows.push({
          product_id: productId,
          date: today,
          avg_price: avgPrice,
          review_count: reviewCount,
        })
      }
    } catch (e) {
      apiErrors++
      if (apiErrors <= 5) console.warn(`\n  ⚠ [${keyword}] ${e.message}`)
    }

    await sleep(120)  // 초당 ~8회 이하 유지
  }

  console.log(`\n  수집 완료: ${rows.length}개 rows (에러: ${apiErrors}회)`)

  if (rows.length === 0) {
    console.log('✅ 적재할 데이터 없음.')
    return
  }

  // 3) UPSERT
  const { error: ue } = await supabase
    .from('shopping_validations')
    .upsert(rows, { onConflict: 'product_id,date' })
  if (ue) { console.error('❌ UPSERT 실패:', ue.message); process.exit(1) }

  // 평균가 샘플 출력
  const withPrice = rows.filter((r) => r.avg_price !== null)
  const sampleRows = [...rows].sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0)).slice(0, 3)

  console.log('\n📊 결과:')
  console.log(`  적재:           ${rows.length}개`)
  console.log(`  평균가 있음:    ${withPrice.length}개`)
  console.log(`  API 에러:       ${apiErrors}회`)

  if (sampleRows.length > 0) {
    console.log('\n  리뷰 많은 상위 3개:')
    for (const r of sampleRows) {
      const kw = [...kwMap.entries()].find(([, ids]) => ids.includes(r.product_id))?.[0] ?? ''
      console.log(`    ${kw}: 평균가 ${r.avg_price?.toLocaleString() ?? '-'}원 / 리뷰 ${r.review_count?.toLocaleString()}개`)
    }
  }

  console.log('\n✅ 완료')
}

main().catch((e) => { console.error('💥 실패:', e); process.exit(1) })
