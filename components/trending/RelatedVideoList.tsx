'use client'

/**
 * 관련 유튜브 영상 리스트. organic / sponsored / 전체 필터.
 */
import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { RelatedVideo } from '@/lib/data/trending'

type Filter = 'all' | 'organic' | 'sponsored'

function formatViewCount(n: number | null): string {
  if (!n) return '—'
  if (n >= 10_000) {
    return `${(n / 10_000).toFixed(1)}만`
  }
  return n.toLocaleString()
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return '오늘'
  if (days < 30) return `${days}일 전`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}개월 전`
  return `${Math.floor(months / 12)}년 전`
}

function VideoBadge({ status }: { status: RelatedVideo['status'] }) {
  if (status === 'organic') {
    return (
      <span className="inline-flex items-center gap-[5px] py-[5px] px-[10px] rounded-md text-[11px] font-bold tracking-[0.02em] bg-sage/15 text-sage border border-sage/30 whitespace-nowrap justify-self-end">
        <span className="w-[5px] h-[5px] rounded-full bg-sage" />
        오가닉
      </span>
    )
  }
  if (status === 'sponsored') {
    return (
      <span className="inline-flex items-center gap-[5px] py-[5px] px-[10px] rounded-md text-[11px] font-bold tracking-[0.02em] bg-terracotta/15 text-terracotta border border-terracotta/30 whitespace-nowrap justify-self-end">
        <span className="w-[5px] h-[5px] rounded-full bg-terracotta" />
        스폰서
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-[5px] py-[5px] px-[10px] rounded-md text-[11px] font-bold tracking-[0.02em] bg-ink-4/20 text-ink-3 border border-transparent whitespace-nowrap justify-self-end">
      <span className="w-[5px] h-[5px] rounded-full bg-ink-3" />
      미분류
    </span>
  )
}

export function RelatedVideoList({ videos }: { videos: RelatedVideo[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const c = { all: videos.length, organic: 0, sponsored: 0 }
    for (const v of videos) {
      if (v.status === 'organic') c.organic += 1
      else if (v.status === 'sponsored') c.sponsored += 1
    }
    return c
  }, [videos])

  const filtered = useMemo(() => {
    if (filter === 'all') return videos
    return videos.filter((v) => v.status === filter)
  }, [videos, filter])

  return (
    <section className="bg-card border border-line rounded-2xl px-8 py-7">
      <div className="flex justify-between items-end mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-[18px] font-bold tracking-[-0.025em] mb-1">
            관련 유튜브 영상
          </h3>
          <div className="text-[13px] text-ink-3 flex items-center gap-[10px] flex-wrap">
            <span>총 {counts.all}건</span>
            <span className="inline-flex items-center gap-[5px]">
              <span className="w-[6px] h-[6px] rounded-full bg-sage" /> 오가닉 {counts.organic}
            </span>
            <span className="inline-flex items-center gap-[5px]">
              <span className="w-[6px] h-[6px] rounded-full bg-terracotta" /> 스폰서{' '}
              {counts.sponsored}
            </span>
          </div>
        </div>
        <div className="flex gap-1 bg-surface border border-line p-[3px] rounded-lg">
          {(['all', 'organic', 'sponsored'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`py-[6px] px-3 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-card text-primary font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-ink-3'
              }`}
            >
              {f === 'all' ? '전체' : f === 'organic' ? '오가닉' : '스폰서'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-3">
          영상이 아직 수집되지 않았습니다.
        </div>
      ) : (
        <div className="mt-2">
          {filtered.map((v) => (
            <a
              key={v.video_id}
              href={`https://www.youtube.com/watch?v=${v.video_id}`}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[140px_1fr_160px_90px] gap-5 items-center py-4 border-t border-line first:border-t-0 first:pt-0 hover:bg-surface-2 transition-colors"
            >
              <div className="w-[140px] h-20 rounded-lg bg-surface border border-line relative overflow-hidden flex-shrink-0">
                <Image
                  src={`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`}
                  alt={v.title}
                  fill
                  sizes="140px"
                  className="object-cover"
                />
                {v.duration_sec ? (
                  <div className="absolute right-[6px] bottom-[6px] text-[10px] font-semibold text-white bg-ink/85 py-[2px] px-[5px] rounded-[3px] num">
                    {Math.floor(v.duration_sec / 60)}:
                    {String(v.duration_sec % 60).padStart(2, '0')}
                  </div>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-[-0.015em] text-ink mb-[6px] leading-[1.4] line-clamp-2">
                  {v.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-3 flex-wrap">
                  <span className="font-semibold text-ink-2">
                    {v.channel_title ?? '알 수 없음'}
                  </span>
                  {v.published_at ? (
                    <>
                      <span className="text-ink-4">·</span>
                      <span>{formatRelativeDate(v.published_at)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-[3px] text-xs">
                <div className="flex justify-between text-ink-3">
                  <span>조회수</span>
                  <span className="font-semibold text-ink num">
                    {formatViewCount(v.view_count)}
                  </span>
                </div>
              </div>
              <VideoBadge status={v.status} />
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
