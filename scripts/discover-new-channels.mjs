#!/usr/bin/env node
/**
 * 신규 크리에이터 자동 발굴.
 * 실행: node --env-file=.env.local scripts/discover-new-channels.mjs
 *
 * 흐름:
 *  1. discovery_candidates (product, pending) 로드
 *  2. 제품별 YouTube search.list → 상위 영상 채널 수집
 *  3. channels.list로 구독자 수 확인
 *  4. 구독자 5,000명 이상 + 기존 시드에 없는 채널 필터
 *  5. data/seed-channels.json 업데이트
 *  6. discovery_candidates에 channel 타입으로 적재 (status='auto_added')
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_PATH = path.resolve(__dirname, '../data/seed-channels.json')

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  youtubeKey: process.env.YOUTUBE_API_KEY,
}
if (!env.url || !env.serviceKey || !env.youtubeKey) {
  console.error('❌ 환경변수 누락')
  process.exit(1)
}

const MIN_SUBSCRIBERS = 5000
const MAX_PRODUCTS_TO_SEARCH = 10  // quota 절약 (100 units × 제품 수)
const API_BASE = 'https://www.googleapis.com/youtube/v3'

let quotaUsed = 0

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function subscriberTier(count) {
  if (count >= 1_000_000) return 'mega'
  if (count >= 100_000) return 'mid'
  return 'micro'
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function ytGet(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('key', env.youtubeKey)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(`YouTube [${endpoint}] HTTP ${res.status}: ${body.error?.message ?? ''}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) 기존 시드 로드
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf-8'))
  const existingChannelIds = new Set(seed.creators.map(c => c.channel_id))
  console.log(`📋 기존 시드: ${seed.creators.length}개 채널`)

  // 2) 발굴 후보 제품 로드 (pending 상태)
  const { data: candidates } = await supabase
    .from('discovery_candidates')
    .select('external_data')
    .eq('candidate_type', 'product')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(MAX_PRODUCTS_TO_SEARCH)

  if (!candidates?.length) {
    console.log('✅ 발굴 대상 제품 없음.')
    return
  }

  console.log(`🔍 제품별 YouTube 검색 (${candidates.length}개)...`)

  // 3) 제품별 YouTube 검색 → 채널 ID 수집
  const channelSearchMap = new Map()  // channelId → {productName, videoTitle, videoId}

  for (const c of candidates) {
    const productName = c.external_data?.product_name ?? ''
    if (!productName) continue

    try {
      quotaUsed += 100
      const data = await ytGet('search', {
        part: 'snippet',
        q: productName,
        type: 'video',
        regionCode: 'KR',
        relevanceLanguage: 'ko',
        order: 'relevance',
        maxResults: 10,
      })

      for (const item of data.items ?? []) {
        const channelId = item.snippet?.channelId
        if (!channelId || existingChannelIds.has(channelId)) continue
        if (!channelSearchMap.has(channelId)) {
          channelSearchMap.set(channelId, {
            channelTitle: item.snippet?.channelTitle ?? '',
            productName,
            videoTitle: item.snippet?.title ?? '',
            videoId: item.id?.videoId ?? '',
          })
        }
      }
      process.stdout.write(`  [${productName.substring(0, 20)}] ${(data.items ?? []).length}개 영상 → `)
      process.stdout.write(`신규 채널 ${data.items?.filter(i => !existingChannelIds.has(i.snippet?.channelId)).length ?? 0}개\n`)
    } catch (e) {
      console.warn(`  ⚠ [${productName}] 검색 실패: ${e.message}`)
    }
    await sleep(300)
  }

  if (channelSearchMap.size === 0) {
    console.log('✅ 신규 채널 없음.')
    console.log(`📊 YouTube 할당량: ${quotaUsed} units`)
    return
  }

  console.log(`\n📡 채널 구독자 수 확인 (${channelSearchMap.size}개)...`)

  // 4) channels.list로 구독자 수 확인 (50개씩 배치)
  const channelIds = [...channelSearchMap.keys()]
  const channelDetails = new Map()

  for (const batch of chunk(channelIds, 50)) {
    quotaUsed += 1
    try {
      const data = await ytGet('channels', {
        part: 'snippet,statistics',
        id: batch.join(','),
      })
      for (const ch of data.items ?? []) {
        channelDetails.set(ch.id, {
          channelId: ch.id,
          handle: ch.snippet?.customUrl ? `@${ch.snippet.customUrl.replace(/^@/, '')}` : null,
          name: ch.snippet?.title ?? '',
          country: ch.snippet?.country ?? null,
          defaultLanguage: ch.snippet?.defaultLanguage ?? null,
          subscriberCount: Number(ch.statistics?.subscriberCount ?? 0),
          videoCount: Number(ch.statistics?.videoCount ?? 0),
          hiddenSubscriberCount: ch.statistics?.hiddenSubscriberCount ?? false,
        })
      }
    } catch (e) {
      console.warn(`  ⚠ channels.list 실패: ${e.message}`)
    }
    await sleep(200)
  }

  // 5) 구독자 5,000명 이상 필터
  const qualified = [...channelDetails.values()].filter(ch => {
    if (ch.hiddenSubscriberCount) return false  // 구독자 수 비공개
    return ch.subscriberCount >= MIN_SUBSCRIBERS
  })

  console.log(`  ✓ 조건 충족 (${MIN_SUBSCRIBERS.toLocaleString()}명 이상): ${qualified.length}개`)

  if (qualified.length === 0) {
    console.log('✅ 추가할 신규 채널 없음.')
    console.log(`📊 YouTube 할당량: ${quotaUsed} units`)
    return
  }

  // 6) seed-channels.json 업데이트
  const newSeedEntries = qualified.map(ch => ({
    channel_id: ch.channelId,
    handle: ch.handle,
    name: ch.name,
    country: ch.country,
    default_language: ch.defaultLanguage,
    category_tags: ['beauty'],
    subscriber_count_approx: ch.subscriberCount,
    subscriber_tier: subscriberTier(ch.subscriberCount),
    video_count: ch.videoCount,
    verified_by_api: true,
    discovery_source: 'product_search',
    discovery_trigger: channelSearchMap.get(ch.channelId)?.productName ?? '',
  }))

  seed.creators.push(...newSeedEntries)
  seed.total = seed.creators.length
  writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2))
  console.log(`  ✓ seed-channels.json 업데이트: ${seed.total}개`)

  // 7) discovery_candidates에 channel 타입으로 적재
  const dbRows = qualified.map(ch => {
    const search = channelSearchMap.get(ch.channelId)
    return {
      candidate_type: 'channel',
      source_signal: 'product_search',
      external_data: {
        channel_id: ch.channelId,
        channel_name: ch.name,
        subscriber_count: ch.subscriberCount,
        discovery_trigger_product: search?.productName ?? '',
        sample_video_id: search?.videoId ?? '',
        sample_video_title: search?.videoTitle ?? '',
      },
      status: 'auto_added',
    }
  })

  const { error } = await supabase.from('discovery_candidates').insert(dbRows)
  if (error) console.warn('  ⚠ DB 적재 실패:', error.message)
  else console.log(`  ✓ discovery_candidates 적재: ${dbRows.length}개`)

  // 결과 출력
  console.log('\n📋 추가된 채널:')
  newSeedEntries.forEach(ch => {
    console.log(`  ${ch.name} (${ch.subscriber_count_approx?.toLocaleString()}명) ← "${ch.discovery_trigger}"`)
  })

  console.log(`\n📊 YouTube 할당량: ${quotaUsed} units`)
  console.log('\n✅ 완료')
}

main().catch(e => { console.error('💥 실패:', e); process.exit(1) })
