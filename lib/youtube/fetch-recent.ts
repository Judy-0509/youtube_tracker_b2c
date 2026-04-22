import type { YouTubeClient } from './client'

type PlaylistItem = {
  contentDetails: {
    videoId: string
    videoPublishedAt?: string
  }
}

type PlaylistItemsResponse = {
  items?: PlaylistItem[]
}

// UC채널ID → UU업로드플레이리스트ID (YouTube 표준 변환)
export function uploadsPlaylistId(channelId: string): string {
  return 'UU' + channelId.slice(2)
}

/**
 * 채널의 업로드 플레이리스트에서 cutoff 이후 게시된 영상 ID 목록 반환.
 * playlistItems.list는 최신순 정렬 → cutoff보다 오래된 항목 이후는 무시.
 */
export async function fetchRecentVideoIds(
  client: YouTubeClient,
  channelId: string,
  cutoff: Date,
): Promise<string[]> {
  client.quotaUsed += 1

  const data = await client.get<PlaylistItemsResponse>('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId(channelId),
    maxResults: 50,
  })

  const ids: string[] = []
  for (const item of data.items ?? []) {
    const pub = item.contentDetails.videoPublishedAt
    if (pub && new Date(pub) >= cutoff) {
      ids.push(item.contentDetails.videoId)
    }
  }
  return ids
}
