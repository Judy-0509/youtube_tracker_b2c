#!/usr/bin/env node
/**
 * 일일 트렌딩 점수 계산.
 * 실행: node --env-file=.env.local scripts/compute-trending.mjs
 *
 * 흐름:
 *  1. 전체 제품 로드
 *  2. 제품별 3축 raw 신호 계산
 *     - 랭킹 변화 (source_rankings 7일 delta)
 *     - YouTube 버즈 (youtube_mentions × view_count, organic/sponsored 분리)
 *     - 검색량 증가율 (search_trends 최근7일 vs 이전7일)
 *  3. z-score 정규화 → composite_score
 *  4. 4-tier 라벨 부여
 *  5. trending_scores UPSERT
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

// ── 가중치 ────────────────────────────────────────────────────
const W_RANK = 0.40
const W_YOUTUBE = 0.35
const W_SEARCH = 0.25

// ── 수학 헬퍼 ─────────────────────────────────────────────────
function mean(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
function std(arr, m) {
  if (arr.length < 2) return 1
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length
  return Math.sqrt(v) || 1
}
function zScore(val, m, s) {
  return Math.max(-3, Math.min(3, (val - m) / s))
}

// ── 날짜 헬퍼 ─────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().split('T')[0] }
function subtractDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return toDateStr(d)
}
function daysDiff(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000)
}

// ── 4-tier 라벨 ───────────────────────────────────────────────
function assignTier({ compositeScore, youtubeBuzzRaw, rankChange, searchGrowth, organicBuzzRatio }) {
  if (compositeScore >= 0.8 && (organicBuzzRatio === null || organicBuzzRatio >= 0.4)) {
    return 'confirmed'
  }
  if (youtubeBuzzRaw > 0 && (rankChange ?? 0) <= 0) {
    return 'buzz_only'
  }
  if ((searchGrowth ?? 0) > 0.3 && youtubeBuzzRaw === 0) {
    return 'newly_discovered'
  }
  return 'detecting'
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const today = toDateStr(new Date(Date.now() + 9*3600000))
  console.log(`📅 계산 날짜: ${today}`)

  // ── 1) 전체 제품 로드 ────────────────────────────────────────
  const { data: products } = await supabase.from('products').select('id')
  const productIds = (products ?? []).map((p) => p.id)
  console.log(`🛍️  제품: ${productIds.length}개`)

  // ── 2) 신호 데이터 bulk 로드 ─────────────────────────────────
  // [랭킹] 최근 14일
  const rankCutoff = subtractDays(today, 14)
  const { data: rankRows } = await supabase
    .from('source_rankings')
    .select('product_source_id, rank, scrape_date, product_sources(product_id)')
    .gte('scrape_date', rankCutoff)
    .order('scrape_date', { ascending: false })

  // product_id → [{rank, scrape_date}]
  const rankMap = new Map()
  for (const r of rankRows ?? []) {
    const pid = r.product_sources?.product_id
    if (!pid) continue
    if (!rankMap.has(pid)) rankMap.set(pid, [])
    rankMap.get(pid).push({ rank: r.rank, date: r.scrape_date })
  }

  // [YouTube] 최근 14일 mentions + video stats + ad status
  const ytCutoff = subtractDays(today, 14)
  const { data: mentionRows } = await supabase
    .from('youtube_mentions')
    .select('product_id, video_id, matched_at')
    .gte('matched_at', ytCutoff + 'T00:00:00Z')

  const mentionVideoIds = [...new Set((mentionRows ?? []).map((m) => m.video_id))]
  let videoMap = new Map()  // video_id → view_count
  let adMap = new Map()     // video_id → status

  if (mentionVideoIds.length > 0) {
    const { data: videos } = await supabase
      .from('youtube_videos')
      .select('video_id, view_count')
      .in('video_id', mentionVideoIds)
    const { data: adStatuses } = await supabase
      .from('youtube_video_ad_status')
      .select('video_id, status')
      .in('video_id', mentionVideoIds)

    ;(videos ?? []).forEach((v) => videoMap.set(v.video_id, v.view_count ?? 0))
    ;(adStatuses ?? []).forEach((a) => adMap.set(a.video_id, a.status))
  }

  // product_id → {totalBuzz, organicCount, totalCount}
  const ytMap = new Map()
  for (const m of mentionRows ?? []) {
    if (!ytMap.has(m.product_id)) ytMap.set(m.product_id, { totalBuzz: 0, organicCount: 0, totalCount: 0 })
    const entry = ytMap.get(m.product_id)
    const viewCount = videoMap.get(m.video_id) ?? 1
    entry.totalBuzz += Math.log10(viewCount + 1)
    entry.totalCount++
    if (adMap.get(m.video_id) !== 'sponsored') entry.organicCount++
  }

  // [검색] 최근 14일
  const srchCutoff = subtractDays(today, 14)
  const { data: trendRows } = await supabase
    .from('search_trends')
    .select('product_id, date, ratio')
    .gte('date', srchCutoff)

  // product_id → [{date, ratio}]
  const trendMap = new Map()
  for (const t of trendRows ?? []) {
    if (!trendMap.has(t.product_id)) trendMap.set(t.product_id, [])
    trendMap.get(t.product_id).push({ date: t.date, ratio: t.ratio })
  }

  // ── 3) 제품별 raw 신호 계산 ──────────────────────────────────
  const productSignals = productIds.map((pid) => {
    // 랭킹 변화 (7일 delta)
    const ranks = (rankMap.get(pid) ?? []).sort((a, b) => b.date.localeCompare(a.date))
    const todayRank = ranks.find((r) => r.date === today)?.rank ?? null
    const day7Rank = ranks.find((r) => r.date === subtractDays(today, 7))?.rank ?? null
    const rankChange = todayRank !== null && day7Rank !== null ? day7Rank - todayRank : null
    const isProvisional = ranks.length < 2

    // YouTube 버즈
    const yt = ytMap.get(pid) ?? { totalBuzz: 0, organicCount: 0, totalCount: 0 }

    // 검색 증가율
    const trends = trendMap.get(pid) ?? []
    const recent7 = trends.filter((t) => daysDiff(today, t.date) <= 7).map((t) => t.ratio)
    const prev7 = trends.filter((t) => { const d = daysDiff(today, t.date); return d > 7 && d <= 14 }).map((t) => t.ratio)
    const recentAvg = recent7.length ? mean(recent7) : 0
    const prevAvg = prev7.length ? mean(prev7) : 0
    const searchGrowth = prevAvg > 0 ? Math.min((recentAvg - prevAvg) / prevAvg, 3.0) : (recentAvg > 0 ? 1.0 : null)

    return {
      productId: pid,
      isProvisional,
      signals: { rankChange, youtubeBuzzRaw: yt.totalBuzz, searchGrowth, organicCount: yt.organicCount, totalMentionCount: yt.totalCount },
    }
  })

  // ── 4) z-score 정규화 ────────────────────────────────────────
  const rankVals = productSignals.map((p) => p.signals.rankChange ?? 0)
  const ytVals   = productSignals.map((p) => p.signals.youtubeBuzzRaw)
  const srchVals = productSignals.map((p) => p.signals.searchGrowth ?? 0)

  const rm = mean(rankVals);  const rs = std(rankVals, rm)
  const ym = mean(ytVals);    const ys = std(ytVals, ym)
  const sm = mean(srchVals);  const ss = std(srchVals, sm)

  // ── 5) composite 계산 + tier 부여 ─────────────────────────────
  const rows = productSignals.map((p) => {
    const { rankChange, youtubeBuzzRaw, searchGrowth, organicCount, totalMentionCount } = p.signals

    const rankZ   = zScore(rankChange ?? 0, rm, rs)
    const ytZ     = zScore(youtubeBuzzRaw, ym, ys)
    const srchZ   = zScore(searchGrowth ?? 0, sm, ss)
    const composite = W_RANK * rankZ + W_YOUTUBE * ytZ + W_SEARCH * srchZ

    const organicBuzzRatio = totalMentionCount > 0 ? organicCount / totalMentionCount : null
    const sponsoredRatio   = totalMentionCount > 0 ? (totalMentionCount - organicCount) / totalMentionCount : null

    const tier = assignTier({ compositeScore: composite, youtubeBuzzRaw, rankChange, searchGrowth, organicBuzzRatio })

    return {
      product_id: p.productId,
      date: today,
      rank_change_7d: rankChange ?? 0,
      youtube_buzz_score: Math.round(youtubeBuzzRaw * 1000) / 1000,
      search_growth_score: Math.round((searchGrowth ?? 0) * 1000) / 1000,
      composite_score: Math.round(composite * 1000) / 1000,
      organic_buzz_ratio: organicBuzzRatio,
      sponsored_ratio: sponsoredRatio,
      tier,
      is_provisional: p.isProvisional,
    }
  })

  // ── 6) UPSERT ────────────────────────────────────────────────
  const { error } = await supabase
    .from('trending_scores')
    .upsert(rows, { onConflict: 'product_id,date' })
  if (error) { console.error('❌ UPSERT 실패:', error.message); process.exit(1) }

  // ── 결과 요약 ─────────────────────────────────────────────────
  const tierCounts = rows.reduce((acc, r) => { acc[r.tier] = (acc[r.tier] || 0) + 1; return acc }, {})
  const topRows = [...rows].sort((a, b) => b.composite_score - a.composite_score).slice(0, 5)

  console.log('\n📊 결과:')
  console.log(`  총 제품:      ${rows.length}개`)
  console.log(`  confirmed:    ${tierCounts.confirmed ?? 0}`)
  console.log(`  detecting:    ${tierCounts.detecting ?? 0}`)
  console.log(`  buzz_only:    ${tierCounts.buzz_only ?? 0}`)
  console.log(`  newly_discovered: ${tierCounts.newly_discovered ?? 0}`)
  console.log(`  provisional:  ${rows.filter((r) => r.is_provisional).length}개`)

  console.log('\n🏆 상위 5개:')
  topRows.forEach((r, i) => {
    console.log(`  ${i + 1}. score=${r.composite_score.toFixed(3)} tier=${r.tier} provisional=${r.is_provisional}`)
  })

  console.log('\n✅ 완료')
}

main().catch((e) => { console.error('💥 실패:', e); process.exit(1) })
