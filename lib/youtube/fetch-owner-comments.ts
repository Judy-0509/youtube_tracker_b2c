import { YouTubeApiError, type YouTubeClient } from './client'

export type OwnerCommentRow = {
  comment_id: string
  video_id: string
  text: string
  published_at: string | null
}

type CommentThread = {
  id: string
  snippet: {
    topLevelComment: {
      snippet: {
        textDisplay: string
        authorChannelId?: { value: string }
        publishedAt: string
      }
    }
  }
}

type CommentThreadsResponse = { items?: CommentThread[] }

/**
 * 영상의 최상위 댓글 중 채널 주인(channelId)이 작성한 것만 반환.
 * 댓글 비활성화(403) 또는 영상 없음(404)은 빈 배열로 graceful skip.
 */
export async function fetchOwnerComments(
  client: YouTubeClient,
  videoId: string,
  channelId: string,
): Promise<OwnerCommentRow[]> {
  client.quotaUsed += 1
  try {
    const data = await client.get<CommentThreadsResponse>('commentThreads', {
      part: 'snippet',
      videoId,
      maxResults: 100,
    })

    return (data.items ?? [])
      .filter(
        (t) => t.snippet.topLevelComment.snippet.authorChannelId?.value === channelId,
      )
      .map((t) => ({
        comment_id: t.id,
        video_id: videoId,
        text: t.snippet.topLevelComment.snippet.textDisplay,
        published_at: t.snippet.topLevelComment.snippet.publishedAt ?? null,
      }))
  } catch (e) {
    if (e instanceof YouTubeApiError && (e.status === 403 || e.status === 404)) {
      return []
    }
    throw e
  }
}
