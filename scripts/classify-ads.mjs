#!/usr/bin/env node
/**
 * 광고 분류 스크립트.
 * 실행: node --env-file=.env.local scripts/classify-ads.mjs
 *
 * 흐름:
 *  1. ad_keywords 로드 (active=true)
 *  2. 미분류 youtube_videos 조회
 *  3. 영상별 주인 댓글 조회
 *  4. Tier1+Tier2 룰 기반 분류
 *  5. youtube_video_ad_status UPSERT
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

// ── 광고 분류 로직 (lib/classifier/ad-detector.ts 인라인) ──────
function scanText(text, keywords) {
  if (!text) return []
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw.pattern.toLowerCase()))
}

function classifyAd(video, ownerCommentTexts, keywords) {
  const titleMatches = scanText(video.title, keywords)
  const descMatches = scanText(video.description ?? '', keywords)
  const hashtagMatches = scanText((video.hashtags ?? []).join(' '), keywords)

  const commentText = ownerCommentTexts.join(' ')
  const commentMatches = scanText(commentText, keywords)
  const tier2 = commentMatches.length > 0

  const signals = {
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

  if (totalWeight === 0) return { status: 'organic', confidence: 0.85, signals }

  const confidence = Math.min(0.99, 0.5 + totalWeight * 0.25)
  const status = totalWeight >= 1.0 ? 'sponsored' : 'unknown'
  return { status, confidence, signals }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) 광고 키워드 로드
  const { data: kwData, error: kwErr } = await supabase
    .from('ad_keywords')
    .select('pattern, weight, category')
    .eq('active', true)
  if (kwErr) { console.error('❌ ad_keywords 로드 실패:', kwErr.message); process.exit(1) }
  const keywords = kwData ?? []
  console.log(`🔑 광고 키워드: ${keywords.length}개`)

  // 2) 미분류 영상 조회 (youtube_video_ad_status에 없는 것)
  const { data: classified } = await supabase
    .from('youtube_video_ad_status')
    .select('video_id')
  const classifiedIds = new Set((classified ?? []).map((r) => r.video_id))

  const { data: allVideos, error: vErr } = await supabase
    .from('youtube_videos')
    .select('video_id, title, description, hashtags')
  if (vErr) { console.error('❌ youtube_videos 조회 실패:', vErr.message); process.exit(1) }

  const videos = (allVideos ?? []).filter((v) => !classifiedIds.has(v.video_id))
  console.log(`📹 분류 대상: ${videos.length}개 (기분류: ${classifiedIds.size}개 스킵)`)

  if (videos.length === 0) {
    console.log('✅ 분류할 영상 없음.')
    return
  }

  // 3) 영상별 주인 댓글 로드 (한번에 bulk)
  const videoIds = videos.map((v) => v.video_id)
  const commentMap = new Map()  // videoId → string[]

  for (const batch of chunk(videoIds, 200)) {
    const { data: comments } = await supabase
      .from('youtube_owner_comments')
      .select('video_id, text')
      .in('video_id', batch)
    for (const c of comments ?? []) {
      if (!commentMap.has(c.video_id)) commentMap.set(c.video_id, [])
      commentMap.get(c.video_id).push(c.text)
    }
  }
  console.log(`💬 주인 댓글 보유 영상: ${commentMap.size}개`)

  // 4) 분류 + 적재
  const stats = { sponsored: 0, organic: 0, unknown: 0 }
  const rows = []

  for (const video of videos) {
    const ownerComments = commentMap.get(video.video_id) ?? []
    const result = classifyAd(video, ownerComments, keywords)
    stats[result.status]++
    rows.push({
      video_id: video.video_id,
      status: result.status,
      confidence: result.confidence,
      signals: result.signals,
    })
  }

  // 배치 UPSERT (500개씩)
  let upserted = 0
  for (const batch of chunk(rows, 500)) {
    const { error: ue } = await supabase
      .from('youtube_video_ad_status')
      .upsert(batch, { onConflict: 'video_id' })
    if (ue) { console.error('❌ UPSERT 실패:', ue.message); process.exit(1) }
    upserted += batch.length
  }

  console.log('\n📊 결과:')
  console.log(`  sponsored: ${stats.sponsored}개`)
  console.log(`  organic:   ${stats.organic}개`)
  console.log(`  unknown:   ${stats.unknown}개`)
  console.log(`  총 적재:   ${upserted}개`)
  console.log('\n✅ 완료')
}

main().catch((e) => { console.error('💥 실패:', e); process.exit(1) })
