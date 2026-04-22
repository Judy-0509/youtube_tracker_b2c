#!/usr/bin/env node
/**
 * 제품 언급 매칭 스크립트.
 * 실행: node --env-file=.env.local scripts/match-products.mjs
 *
 * 흐름:
 *  1. products + brands 로드
 *  2. 미매칭 youtube_videos 조회
 *  3. 영상별 텍스트(제목+설명+해시태그)에서 제품 언급 탐지
 *  4. youtube_mentions UPSERT
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

// ── 매칭 로직 (lib/matcher/product-mention.ts 인라인) ──────────
const NOISE_RE =
  /\b(기획|증정|특별|대용량|골라담기|[0-9]+종|중\s*택\s*[0-9]+|판매|한정|세트|구성|set|스페셜|에디션|edition|\d+매|\d+ml|\d+g|\d+정|\d+캡슐|\d+개)\b/gi

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildMatchToken(normalizedName, brandName) {
  const cleaned = normalizedName.replace(NOISE_RE, ' ').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(' ').filter((w) => w.length >= 2)
  const leadWords = words.slice(0, 4)
  const joined = leadWords.join(' ')
  const brandNorm = normalize(brandName)
  return joined.includes(brandNorm.split(' ')[0]) ? joined : `${brandNorm} ${joined}`
}

function detectMentions(videoText, products) {
  const normText = normalize(videoText)
  const matches = []
  const seen = new Set()

  for (const product of products) {
    const token = buildMatchToken(product.normalizedName, product.brandName)
    if (token.length < 4) continue
    if (normText.includes(normalize(token)) && !seen.has(product.id)) {
      seen.add(product.id)
      matches.push({ product_id: product.id, matched_text: token })
    }
  }
  return matches
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

  // 1) 제품 + 브랜드 로드
  const { data: prodData, error: pe } = await supabase
    .from('products')
    .select('id, normalized_name, brand_id, brands(name)')
  if (pe) { console.error('❌ products 로드 실패:', pe.message); process.exit(1) }

  const products = (prodData ?? []).map((p) => ({
    id: p.id,
    normalizedName: p.normalized_name,
    brandName: p.brands?.name ?? '',
  }))
  console.log(`🛍️  제품: ${products.length}개`)

  // 2) 이미 매칭된 video_id 목록
  const { data: existingMentions } = await supabase
    .from('youtube_mentions')
    .select('video_id')
  const matchedVideoIds = new Set((existingMentions ?? []).map((m) => m.video_id))

  // 3) 미매칭 영상 조회
  const { data: allVideos, error: ve } = await supabase
    .from('youtube_videos')
    .select('video_id, title, description, hashtags')
  if (ve) { console.error('❌ youtube_videos 조회 실패:', ve.message); process.exit(1) }

  const videos = (allVideos ?? []).filter((v) => !matchedVideoIds.has(v.video_id))
  console.log(`📹 매칭 대상: ${videos.length}개 (기매칭: ${matchedVideoIds.size}개 스킵)`)

  if (videos.length === 0) {
    console.log('✅ 매칭할 영상 없음.')
    return
  }

  // 4) 언급 탐지 + 적재
  let totalMentions = 0
  let videosWithMatches = 0
  const allRows = []

  for (const video of videos) {
    const text = [video.title, video.description ?? '', (video.hashtags ?? []).join(' ')].join(' ')
    const mentions = detectMentions(text, products)

    if (mentions.length > 0) {
      videosWithMatches++
      for (const m of mentions) {
        allRows.push({
          product_id: m.product_id,
          video_id: video.video_id,
          matched_text: m.matched_text,
        })
      }
    }
  }

  // 배치 UPSERT
  for (const batch of chunk(allRows, 500)) {
    const { error: ue } = await supabase
      .from('youtube_mentions')
      .upsert(batch, { onConflict: 'product_id,video_id' })
    if (ue) { console.error('❌ UPSERT 실패:', ue.message); process.exit(1) }
  }
  totalMentions = allRows.length

  console.log('\n📊 결과:')
  console.log(`  언급 있는 영상: ${videosWithMatches} / ${videos.length}`)
  console.log(`  총 언급:        ${totalMentions}개`)

  // 상위 매칭 제품 출력
  const productCounts = {}
  allRows.forEach((r) => { productCounts[r.matched_text] = (productCounts[r.matched_text] || 0) + 1 })
  const top5 = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (top5.length > 0) {
    console.log('\n  상위 언급 제품:')
    top5.forEach(([name, cnt]) => console.log(`    ${name}: ${cnt}회`))
  }

  console.log('\n✅ 완료')
}

main().catch((e) => { console.error('💥 실패:', e); process.exit(1) })
