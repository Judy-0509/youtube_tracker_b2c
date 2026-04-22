#!/usr/bin/env node
/**
 * product_search_keywords 자동 시드 (S5.5).
 * 실행: node --env-file=.env.local scripts/seed-search-keywords.mjs
 *
 * 규칙:
 *  - primary_keyword = "브랜드명 핵심제품명" (노이즈 제거 후 앞 3단어)
 *  - 키워드 2글자 미만이거나 너무 일반적이면 status='ambiguous'
 */
import { createClient } from '@supabase/supabase-js'

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}
if (!env.url || !env.serviceKey) {
  console.error('❌ 환경변수 누락')
  process.exit(1)
}

const NOISE_RE =
  /\b(기획|증정|특별|대용량|골라담기|[0-9]+종|중\s*택\s*[0-9]+|판매|한정|세트|구성|set|스페셜|에디션|edition|\d+매|\d+ml|\d+g|\d+정|\d+캡슐|\d+개|기획세트|기획팩)\b/gi

function buildKeyword(normalizedName, brandName) {
  const cleaned = normalizedName
    .replace(NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ').filter((w) => w.length >= 2)
  // 브랜드명 포함 최대 4단어
  const brandNorm = brandName.toLowerCase().replace(/\s+/g, ' ').trim()
  const leadWords = words.slice(0, 4)
  const joined = leadWords.join(' ')

  return joined.startsWith(brandNorm.split(' ')[0]) ? joined : `${brandNorm} ${joined}`
}

function isAmbiguous(keyword) {
  const words = keyword.split(' ')
  // 2단어 이하거나 키워드 전체가 너무 짧으면 애매함
  return words.length <= 1 || keyword.length < 6
}

async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 이미 시드된 product_id 확인
  const { data: existing } = await supabase
    .from('product_search_keywords')
    .select('product_id')
  const seededIds = new Set((existing ?? []).map((r) => r.product_id))
  console.log(`  기존 시드: ${seededIds.size}개`)

  // 제품 + 브랜드 로드
  const { data: products, error } = await supabase
    .from('products')
    .select('id, normalized_name, brands(name)')
  if (error) { console.error('❌ products 로드 실패:', error.message); process.exit(1) }

  const targets = (products ?? []).filter((p) => !seededIds.has(p.id))
  console.log(`🛍️  시드 대상: ${targets.length}개 제품`)

  if (targets.length === 0) {
    console.log('✅ 이미 모두 시드됨.')
    return
  }

  const rows = []
  let ambiguousCount = 0

  for (const p of targets) {
    const brandName = p.brands?.name ?? ''
    const keyword = buildKeyword(p.normalized_name, brandName)
    const status = isAmbiguous(keyword) ? 'ambiguous' : 'active'
    if (status === 'ambiguous') ambiguousCount++

    rows.push({
      product_id: p.id,
      primary_keyword: keyword,
      alias_keywords: [],
      exclude_keywords: [],
      status,
    })
  }

  // UPSERT
  const { error: ue } = await supabase
    .from('product_search_keywords')
    .upsert(rows, { onConflict: 'product_id' })
  if (ue) { console.error('❌ UPSERT 실패:', ue.message); process.exit(1) }

  console.log('\n📊 결과:')
  console.log(`  active:    ${rows.length - ambiguousCount}개`)
  console.log(`  ambiguous: ${ambiguousCount}개`)
  console.log(`  총 시드:   ${rows.length}개`)

  // 샘플 출력
  const samples = rows.slice(0, 5)
  console.log('\n  샘플 키워드:')
  samples.forEach((r) => console.log(`    [${r.status}] ${r.primary_keyword}`))

  console.log('\n✅ 완료')
}

main().catch((e) => { console.error('💥 실패:', e); process.exit(1) })
