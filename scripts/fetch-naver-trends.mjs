#!/usr/bin/env node
/**
 * 네이버 데이터랩 검색어 트렌드 수집.
 * 실행: node --env-file=.env.local scripts/fetch-naver-trends.mjs
 *
 * 흐름:
 *  1. product_search_keywords (active) 로드
 *  2. 키워드 중복 제거 후 5개씩 묶어 DataLab API 호출
 *  3. search_trends UPSERT (product_id × keyword × date)
 */
import { createClient } from '@supabase/supabase-js'

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  clientId: process.env.NAVER_CLIENT_ID,
  clientSecret: process.env.NAVER_CLIENT_SECRET,
}
if (!env.url || !env.serviceKey || !env.clientId || !env.clientSecret) {
  console.error('❌ 환경변수 누락 (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)')
  process.exit(1)
}

const DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search'
const LOOKBACK_DAYS = 28

// ── 날짜 헬퍼 ─────────────────────────────────────────────────
function toDateStr(date) {
  return date.toISOString().split('T')[0]
}

function dateRange() {
  const end = new Date()
  end.setDate(end.getDate() - 1)  // 어제까지 (오늘은 미완성)
  const start = new Date(end)
  start.setDate(start.getDate() - (LOOKBACK_DAYS - 1))
  return { startDate: toDateStr(start), endDate: toDateStr(end) }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── DataLab API 호출 ──────────────────────────────────────────
async function fetchTrends(keywords, startDate, endDate) {
  const res = await fetch(DATALAB_URL, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': env.clientId,
      'X-Naver-Client-Secret': env.clientSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      timeUnit: 'date',
      keywordGroups: keywords.map((kw) => ({ groupName: kw, keywords: [kw] })),
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`DataLab HTTP ${res.status}: ${text}`)
    err.status = res.status
    throw err
  }

  const json = await res.json()
  return (json.results ?? []).map((r) => ({
    keyword: r.title,
    data: r.data.map((d) => ({ date: d.period, ratio: d.ratio })),
  }))
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

  // keyword → product_ids[] 매핑 (동일 키워드 여러 제품 처리)
  const kwMap = new Map()
  for (const row of kwRows ?? []) {
    if (!kwMap.has(row.primary_keyword)) kwMap.set(row.primary_keyword, [])
    kwMap.get(row.primary_keyword).push(row.product_id)
  }

  const uniqueKeywords = [...kwMap.keys()]
  console.log(`🔑 고유 키워드: ${uniqueKeywords.length}개 (제품 ${kwRows.length}개)`)

  const { startDate, endDate } = dateRange()
  console.log(`📅 기간: ${startDate} ~ ${endDate} (${LOOKBACK_DAYS}일)`)

  // 2) 5개씩 배치 호출
  const batches = chunk(uniqueKeywords, 5)
  console.log(`\n📡 DataLab API 호출: ${batches.length}회...`)

  const trendResults = new Map()  // keyword → [{date, ratio}]
  let apiErrors = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    try {
      const results = await fetchTrends(batch, startDate, endDate)
      for (const r of results) {
        trendResults.set(r.keyword, r.data)
      }
      process.stdout.write(`  [${i + 1}/${batches.length}] ✓\r`)
    } catch (e) {
      apiErrors++
      console.warn(`\n  ⚠ 배치 ${i + 1} 실패: ${e.message}`)
    }
    await sleep(300)  // API 레이트 리밋 대응
  }

  console.log(`\n  수집 완료: ${trendResults.size}개 키워드 (에러: ${apiErrors}회)`)

  // 3) search_trends rows 생성
  const today = toDateStr(new Date(Date.now() + 9*3600000))
  const rows = []

  for (const [keyword, dataPoints] of trendResults) {
    const productIds = kwMap.get(keyword) ?? []
    for (const productId of productIds) {
      for (const { date, ratio } of dataPoints) {
        rows.push({
          product_id: productId,
          keyword,
          date,
          ratio,
          fetched_at: new Date().toISOString(),
        })
      }
    }
  }

  console.log(`📝 적재 rows: ${rows.length}개`)

  // 4) UPSERT (500개씩)
  let upserted = 0
  for (const batch of chunk(rows, 500)) {
    const { error: ue } = await supabase
      .from('search_trends')
      .upsert(batch, { onConflict: 'product_id,keyword,date' })
    if (ue) { console.error('❌ UPSERT 실패:', ue.message); process.exit(1) }
    upserted += batch.length
  }

  console.log(`\n📊 결과:`)
  console.log(`  키워드:     ${trendResults.size}개`)
  console.log(`  총 rows:    ${upserted}개 (${LOOKBACK_DAYS}일 × 제품 수)`)
  console.log(`  API 호출:   ${batches.length - apiErrors} / ${batches.length}회 성공`)
  console.log('\n✅ 완료')
}

main().catch((e) => { console.error('💥 실패:', e); process.exit(1) })
