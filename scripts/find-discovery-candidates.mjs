#!/usr/bin/env node
/**
 * 역방향 발굴 큐 적재.
 * 실행: node --env-file=.env.local scripts/find-discovery-candidates.mjs
 *
 * 조건 (OR):
 *  A. 검색량 급등 (search_growth > 0.5) AND youtube_mentions = 0
 *  B. 랭킹 급등 (rank_change_7d >= 10) AND youtube_mentions = 0
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

async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const today = new Date().toISOString().split('T')[0]

  // 1) 오늘 trending_scores 로드
  const { data: scores, error } = await supabase
    .from('trending_scores')
    .select('product_id, tier, composite_score, search_growth_score, rank_change_7d, youtube_buzz_score')
    .eq('date', today)
  if (error) { console.error('❌ trending_scores 조회 실패:', error.message); process.exit(1) }

  // 2) 이미 discovery_candidates에 있는 product_id 제외
  const { data: existing } = await supabase
    .from('discovery_candidates')
    .select('external_data')
    .eq('candidate_type', 'product')
    .eq('status', 'pending')
  const existingProductIds = new Set(
    (existing ?? []).map((r) => r.external_data?.product_id).filter(Boolean)
  )

  // 3) 발굴 조건 필터
  const candidates = (scores ?? []).filter((s) => {
    if (existingProductIds.has(s.product_id)) return false
    const noYoutube = s.youtube_buzz_score === 0
    const searchSpike = (s.search_growth_score ?? 0) > 0.5
    const rankJump = (s.rank_change_7d ?? 0) >= 10
    return noYoutube && (searchSpike || rankJump)
  })

  console.log(`🔍 발굴 후보: ${candidates.length}개 (전체 ${scores?.length ?? 0}개 중)`)

  if (candidates.length === 0) {
    console.log('✅ 신규 발굴 후보 없음.')
    return
  }

  // 4) product 이름 조회
  const { data: prodData } = await supabase
    .from('products')
    .select('id, name, brands(name)')
    .in('id', candidates.map((c) => c.product_id))
  const prodMap = new Map((prodData ?? []).map((p) => [p.id, p]))

  // 5) discovery_candidates INSERT
  const rows = candidates.map((c) => {
    const prod = prodMap.get(c.product_id)
    const signal = (c.search_growth_score ?? 0) > 0.5 ? 'naver_search_spike' : 'oliveyoung_rank_jump'
    return {
      candidate_type: 'product',
      source_signal: signal,
      external_data: {
        product_id: c.product_id,
        product_name: prod?.name ?? '',
        brand_name: prod?.brands?.name ?? '',
        search_growth: c.search_growth_score,
        rank_change: c.rank_change_7d,
        date: today,
      },
      status: 'pending',
    }
  })

  const { error: ie } = await supabase.from('discovery_candidates').insert(rows)
  if (ie) { console.error('❌ INSERT 실패:', ie.message); process.exit(1) }

  console.log('\n📋 발굴 큐 추가:')
  rows.forEach((r) => {
    console.log(`  [${r.source_signal}] ${r.external_data.brand_name} ${r.external_data.product_name}`)
  })
  console.log('\n✅ 완료')
}

main().catch((e) => { console.error('💥 실패:', e); process.exit(1) })
