import type { YouTubeClient } from './client'

export type VideoRow = {
  video_id: string
  channel_id: string
  channel_title: string | null
  title: string
  description: string | null
  hashtags: string[]
  duration_sec: number
  is_short: boolean
  published_at: string | null
  view_count: number | null
}

type VideoItem = {
  id: string
  snippet: {
    channelId: string
    channelTitle: string
    title: string
    description: string
    publishedAt: string
    tags?: string[]
  }
  contentDetails: { duration: string }
  statistics: { viewCount?: string }
}

type VideosListResponse = { items?: VideoItem[] }

// ISO 8601 duration (PT1H2M30S) → 초
export function parseDurationSec(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0)
}

function extractHashtags(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/#([\w가-힣]+)/g)) {
    found.add(m[1].toLowerCase())
  }
  return [...found]
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * videoIds 배열을 50개씩 배치 처리하여 youtube_videos 적재용 row 반환.
 * 1 배치 = 1 quota unit.
 */
export async function fetchVideoMeta(
  client: YouTubeClient,
  videoIds: string[],
): Promise<VideoRow[]> {
  const results: VideoRow[] = []

  for (const batch of chunk(videoIds, 50)) {
    client.quotaUsed += 1
    const data = await client.get<VideosListResponse>('videos', {
      part: 'snippet,contentDetails,statistics',
      id: batch.join(','),
    })

    for (const v of data.items ?? []) {
      const durationSec = parseDurationSec(v.contentDetails.duration)
      const hashtags = [
        ...extractHashtags(v.snippet.description ?? ''),
        ...(v.snippet.tags ?? []).map((t) => t.toLowerCase()),
      ]
      results.push({
        video_id: v.id,
        channel_id: v.snippet.channelId,
        channel_title: v.snippet.channelTitle ?? null,
        title: v.snippet.title,
        description: v.snippet.description || null,
        hashtags: [...new Set(hashtags)],
        duration_sec: durationSec,
        is_short: durationSec > 0 && durationSec <= 180,
        published_at: v.snippet.publishedAt ?? null,
        view_count: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
      })
    }
  }

  return results
}
