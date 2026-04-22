#!/usr/bin/env node
/**
 * YouTube 채널 일일 영상 수집 + DB 적재.
 * 실행: node --env-file=.env.local scripts/fetch-youtube-daily.mjs
 *
 * 흐름:
 *  1. seed-channels.json에서 verified 채널 로드
 *  2. 채널별 playlistItems.list → 최근 7일 영상 ID
 *  3. 신규 영상만 videos.list 배치 → 메타데이터 수집
 *  4. youtube_videos UPSERT
 *  5. 신규 영상별 commentThreads.list → 채널 주인 댓글
 *  6. youtube_owner_comments UPSERT
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// ── 설정 ─────────────────────────────────────────────────────
const LOOKBACK_DAYS = 7
const MAX_RESULTS_PER_CHANNEL = 50   // 채널당 최대 조회 영상 수
const COMMENT_FETCH_LIMIT = 300      // 댓글 수집 대상 영상 최대 수 (quota 절약)
const API_BASE = 'https://www.googleapis.com/youtube/v3'

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  youtubeKey: process.env.YOUTUBE_API_KEY,
}

if (!env.url || !env.serviceKey || !env.youtubeKey) {
  console.error('❌ 환경변수 누락 — NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / YOUTUBE_API_KEY 확인')
  process.exit(1)
}

// ── 채널 시드 로드 ────────────────────────────────────────────
const seedPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/seed-channels.json')
const seed = JSON.parse(readFileSync(seedPath, 'utf-8'))
const channels = seed.creators.filter((c) => c.verified_by_api === true)
console.log(`📋 채널 시드: ${channels.length}개 (verified_by_api)`)

// ── 할당량 카운터 ─────────────────────────────────────────────
let quotaUsed = 0

// ── YouTube API 호출 ──────────────────────────────────────────
async function ytGet(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('key', env.youtubeKey)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(
      `YouTube [${endpoint}] HTTP ${res.status}: ${body.error?.message ?? ''}`,
    )
    err.status = res.status
    throw err
  }
  return res.json()
}

// ── 헬퍼 ─────────────────────────────────────────────────────
function uploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2)
}

function parseDurationSec(iso) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0)
}

function extractHashtags(text) {
  const found = new Set()
  for (const m of (text ?? '').matchAll(/#([\w가-힣]+)/g)) {
    found.add(m[1].toLowerCase())
  }
  return [...found]
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── S4.3: 채널별 최근 영상 ID ────────────────────────────────
async function fetchRecentVideoIds(channelId, cutoff) {
  quotaUsed += 1
  const data = await ytGet('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId(channelId),
    maxResults: MAX_RESULTS_PER_CHANNEL,
  })

  return (data.items ?? [])
    .filter((item) => {
      const pub = item.contentDetails?.videoPublishedAt
      return pub && new Date(pub) >= cutoff
    })
    .map((item) => item.contentDetails.videoId)
}

// ── S4.4+S4.5: 영상 메타데이터 + Shorts 판정 ────────────────
async function fetchVideoMeta(videoIds) {
  const rows = []
  for (const batch of chunk(videoIds, 50)) {
    quotaUsed += 1
    const data = await ytGet('videos', {
      part: 'snippet,contentDetails,statistics',
      id: batch.join(','),
    })
    for (const v of data.items ?? []) {
      const durationSec = parseDurationSec(v.contentDetails?.duration)
      const hashtags = [
        ...extractHashtags(v.snippet?.description),
        ...(v.snippet?.tags ?? []).map((t) => t.toLowerCase()),
      ]
      rows.push({
        video_id: v.id,
        channel_id: v.snippet?.channelId ?? '',
        channel_title: v.snippet?.channelTitle ?? null,
        title: v.snippet?.title ?? '',
        description: v.snippet?.description || null,
        hashtags: [...new Set(hashtags)],
        duration_sec: durationSec,
        is_short: durationSec > 0 && durationSec <= 180,
        published_at: v.snippet?.publishedAt ?? null,
        view_count: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
      })
    }
  }
  return rows
}

// ── S4.6: 채널 주인 댓글 ──────────────────────────────────────
async function fetchOwnerComments(videoId, channelId) {
  quotaUsed += 1
  try {
    const data = await ytGet('commentThreads', {
      part: 'snippet',
      videoId,
      maxResults: 100,
    })
    return (data.items ?? [])
      .filter(
        (t) => t.snippet?.topLevelComment?.snippet?.authorChannelId?.value === channelId,
      )
      .map((t) => ({
        comment_id: t.id,
        video_id: videoId,
        text: t.snippet.topLevelComment.snippet.textDisplay,
        published_at: t.snippet.topLevelComment.snippet.publishedAt ?? null,
      }))
  } catch (e) {
    if (e.status === 403 || e.status === 404) return []  // 댓글 비활성화 / 영상 없음
    throw e
  }
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  console.log(`📅 수집 기간: ${cutoff.toISOString().split('T')[0]} 이후 (최근 ${LOOKBACK_DAYS}일)`)

  // ── Step 1: 채널별 영상 ID 수집 ────────────────────────────
  console.log('\n🔍 채널별 최근 영상 ID 수집...')
  const allVideoIds = new Set()
  const videoChannelMap = new Map()  // videoId → channelId (댓글 수집용)
  let channelErrors = 0
  let channelsWithVideos = 0

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i]

    if (i > 0 && i % 50 === 0) {
      console.log(`  ${i}/${channels.length} 처리 중... (quota: ${quotaUsed}, 영상: ${allVideoIds.size}개)`)
    }

    try {
      const ids = await fetchRecentVideoIds(ch.channel_id, cutoff)
      if (ids.length > 0) {
        channelsWithVideos++
        ids.forEach((id) => {
          allVideoIds.add(id)
          videoChannelMap.set(id, ch.channel_id)
        })
      }
    } catch (e) {
      channelErrors++
      if (e.status !== 404) {
        console.warn(`  ⚠ [${ch.name}] ${e.message}`)
      }
    }

    // 10채널마다 짧은 딜레이 (burst 방지)
    if (i % 10 === 9) await sleep(150)
  }

  console.log(`  완료 — 총 영상 ID: ${allVideoIds.size}개 | 활성 채널: ${channelsWithVideos} | 에러: ${channelErrors}`)

  // ── Step 2: 이미 DB에 있는 영상 제외 ───────────────────────
  const videoIdList = [...allVideoIds]
  let newVideoIds = videoIdList

  if (videoIdList.length > 0) {
    const { data: existing, error: fetchErr } = await supabase
      .from('youtube_videos')
      .select('video_id')
      .in('video_id', videoIdList)

    if (fetchErr) {
      console.error('❌ 기존 영상 조회 실패:', fetchErr.message)
      process.exit(1)
    }

    const existingSet = new Set((existing ?? []).map((r) => r.video_id))
    newVideoIds = videoIdList.filter((id) => !existingSet.has(id))
    console.log(`\n  신규: ${newVideoIds.length}개 | 기존(스킵): ${existingSet.size}개`)
  }

  if (newVideoIds.length === 0) {
    console.log('\n✅ 수집할 신규 영상 없음.')
    console.log(`📊 YouTube 할당량: ${quotaUsed} / 10,000 units`)
    return
  }

  // ── Step 3: 영상 메타데이터 수집 (S4.4) ────────────────────
  console.log('\n📹 영상 메타데이터 수집...')
  const videoRows = await fetchVideoMeta(newVideoIds)
  const shorts = videoRows.filter((v) => v.is_short).length
  console.log(`  수집: ${videoRows.length}개 (Shorts: ${shorts}개, 일반: ${videoRows.length - shorts}개)`)

  // ── Step 4: youtube_videos UPSERT ──────────────────────────
  if (videoRows.length > 0) {
    const { error: ve } = await supabase
      .from('youtube_videos')
      .upsert(videoRows, { onConflict: 'video_id' })

    if (ve) {
      console.error('❌ youtube_videos UPSERT 실패:', ve.message)
      process.exit(1)
    }
    console.log(`  ✓ youtube_videos 적재: ${videoRows.length}개`)
  }

  // ── Step 5: 채널 주인 댓글 수집 (S4.6) ─────────────────────
  // 신규 영상 중 최대 COMMENT_FETCH_LIMIT개 — 최신순으로 우선 처리
  const commentTargets = videoRows
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, COMMENT_FETCH_LIMIT)

  console.log(`\n💬 채널 주인 댓글 수집 (${commentTargets.length}개 영상)...`)
  let totalComments = 0
  let commentErrors = 0

  for (let i = 0; i < commentTargets.length; i++) {
    const video = commentTargets[i]
    const channelId = videoChannelMap.get(video.video_id) ?? video.channel_id

    if (i > 0 && i % 50 === 0) {
      console.log(`  ${i}/${commentTargets.length} 처리 중... (quota: ${quotaUsed}, 댓글: ${totalComments}개)`)
    }

    try {
      const comments = await fetchOwnerComments(video.video_id, channelId)
      if (comments.length > 0) {
        const { error: ce } = await supabase
          .from('youtube_owner_comments')
          .upsert(comments, { onConflict: 'comment_id' })
        if (ce) throw new Error(ce.message)
        totalComments += comments.length
      }
    } catch (e) {
      commentErrors++
      if (commentErrors <= 5) console.warn(`  ⚠ 댓글 수집 실패 [${video.video_id}]: ${e.message}`)
    }

    if (i % 20 === 19) await sleep(100)
  }

  console.log(`  ✓ 주인 댓글 적재: ${totalComments}개 (에러: ${commentErrors})`)

  // ── 결과 요약 ───────────────────────────────────────────────
  console.log('\n📊 결과:')
  console.log(`  채널 처리:      ${channels.length - channelErrors} / ${channels.length}`)
  console.log(`  신규 영상:      ${videoRows.length}개 (Shorts ${shorts}개)`)
  console.log(`  주인 댓글:      ${totalComments}개`)
  console.log(`  YouTube 할당량: ${quotaUsed} / 10,000 units (${(quotaUsed / 100).toFixed(1)}%)`)

  console.log('\n✅ 완료')
}

main().catch((e) => {
  console.error('💥 실패:', e)
  process.exit(1)
})
