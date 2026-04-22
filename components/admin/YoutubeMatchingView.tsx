'use client'

import { useMemo, useState } from 'react'
import type { VideoRow, MentionRow, ProductToken } from '@/app/admin/youtube-matching/page'

// ── 잠재 매칭 로직 ────────────────────────────────────────────
const NOISE = /\b(기획|증정|특별|대용량|골라담기|[0-9]+종|중\s*택\s*[0-9]+|판매|한정|세트|구성|set|스페셜|에디션|edition|\d+매|\d+ml|\d+g|\d+정|\d+캡슐|\d+개)\b/gi

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildKeywords(product: ProductToken): string[] {
  const cleaned = norm(product.normalized).replace(NOISE, ' ').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(' ').filter((w) => w.length >= 2)
  const brandWord = norm(product.brand).split(' ')[0]
  const nonBrandWords = words.filter((w) => !norm(product.brand).includes(w)).slice(0, 2)
  return [brandWord, ...nonBrandWords].filter(Boolean)
}

function getPotentialMatches(title: string, products: ProductToken[], limit = 3) {
  const normTitle = norm(title)
  const results: { product: ProductToken; keywords: string[]; hitCount: number }[] = []
  for (const p of products) {
    const keywords = buildKeywords(p)
    if (keywords.length === 0) continue
    const hits = keywords.filter((kw) => normTitle.includes(kw))
    if (hits.length >= Math.min(2, keywords.length)) {
      results.push({ product: p, keywords, hitCount: hits.length })
    }
  }
  return results.sort((a, b) => b.hitCount - a.hitCount).slice(0, limit)
}

function relDate(iso: string | null): string {
  if (!iso) return '—'
  const d = Date.now() - new Date(iso).getTime()
  const days = Math.floor(d / 86400000)
  if (days <= 0) return '오늘'
  if (days < 30) return `${days}일 전`
  return `${Math.floor(days / 30)}개월 전`
}

function fmtViews(n: number | null): string {
  if (!n) return '—'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  return n.toLocaleString()
}

type Tab = 'unmatched' | 'matched'

type Props = {
  videos: VideoRow[]
  mentions: MentionRow[]
  products: ProductToken[]
}

export function YoutubeMatchingView({ videos, mentions, products }: Props) {
  const [tab, setTab] = useState<Tab>('unmatched')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const mentionMap = useMemo(() => {
    const m = new Map<string, MentionRow[]>()
    for (const mention of mentions) {
      if (!m.has(mention.video_id)) m.set(mention.video_id, [])
      m.get(mention.video_id)!.push(mention)
    }
    return m
  }, [mentions])

  const matchedVideos = useMemo(() => videos.filter((v) => mentionMap.has(v.video_id)), [videos, mentionMap])
  const unmatchedVideos = useMemo(() => videos.filter((v) => !mentionMap.has(v.video_id)), [videos, mentionMap])

  const potentialMap = useMemo(() => {
    const map = new Map<string, { product: ProductToken; keywords: string[]; hitCount: number }[]>()
    for (const v of unmatchedVideos) map.set(v.video_id, getPotentialMatches(v.title, products))
    return map
  }, [unmatchedVideos, products])

  const matchRate = videos.length > 0 ? (matchedVideos.length / videos.length) * 100 : 0
  const unmatchedWithCandidate = unmatchedVideos.filter((v) => (potentialMap.get(v.video_id)?.length ?? 0) > 0).length

  const displayVideos = useMemo(() => {
    const base = tab === 'matched' ? matchedVideos : unmatchedVideos
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter(
      (v) => v.title.toLowerCase().includes(q) || (v.channel_title ?? '').toLowerCase().includes(q),
    )
  }, [tab, matchedVideos, unmatchedVideos, search])

  return (
    <div className="space-y-6">
      {/* ── 통계 바 ── */}
      <div className="bg-card border border-line rounded-2xl p-6">
        <div className="grid grid-cols-4 gap-6 mb-5">
          {[
            { label: '전체 영상', value: videos.length.toLocaleString(), color: 'text-ink' },
            { label: '매칭 완료', value: matchedVideos.length.toLocaleString(), color: 'text-primary' },
            { label: '미매칭', value: unmatchedVideos.length.toLocaleString(), color: 'text-terracotta' },
            { label: '잠재 후보 있음', value: unmatchedWithCandidate.toLocaleString(), color: 'text-sage' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-ink-4 mb-1">{s.label}</div>
              <div className={`text-[32px] font-extrabold tracking-[-0.03em] num ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
        {/* 매칭률 게이지 */}
        <div>
          <div className="flex justify-between text-xs text-ink-3 mb-[6px]">
            <span>매칭률</span>
            <span className="font-bold text-primary num">{matchRate.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-bone rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${matchRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 탭 + 검색 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-card border border-line p-1 rounded-[10px] gap-1">
          {([
            { key: 'unmatched' as Tab, label: '미매칭', count: unmatchedVideos.length },
            { key: 'matched' as Tab, label: '매칭됨', count: matchedVideos.length },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-[7px] rounded-[7px] text-[13px] font-medium transition-colors flex items-center gap-2 ${
                tab === t.key ? 'bg-primary text-surface' : 'text-ink-2 hover:text-primary'
              }`}
            >
              {t.label}
              <span className={`text-[11px] font-bold px-[6px] py-[1px] rounded-full ${
                tab === t.key ? 'bg-white/20 text-surface' : 'bg-surface text-ink-4'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-card border border-line h-[38px] px-4 rounded-full ml-auto w-[300px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-ink-4 flex-shrink-0">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목 또는 채널명 검색"
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-ink-4"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-ink-4 hover:text-ink text-xs">✕</button>
          )}
        </div>

        <div className="text-sm text-ink-3">
          <span className="num font-semibold text-ink">{displayVideos.length}</span>개 표시
        </div>
      </div>

      {/* ── 안내 (미매칭) ── */}
      {tab === 'unmatched' && unmatchedWithCandidate > 0 && (
        <div className="flex items-start gap-3 bg-terracotta/8 border border-terracotta/20 rounded-xl px-5 py-4 text-sm">
          <span className="text-terracotta font-bold flex-shrink-0">💡</span>
          <span className="text-ink-2">
            <span className="font-semibold text-terracotta">{unmatchedWithCandidate}개</span> 영상에 잠재 매칭 후보가 있습니다.
            행을 클릭해 후보를 확인하고, 매칭 스크립트를 개선하면 자동 연결됩니다.
          </span>
        </div>
      )}

      {/* ── 테이블 ── */}
      <div className="bg-card border border-line rounded-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="grid grid-cols-[56px_1fr_160px_80px_80px_160px] gap-3 px-5 py-3 bg-surface-2 border-b border-line text-[11px] font-bold tracking-[0.08em] uppercase text-ink-3">
          <div />
          <div>영상 제목 / 채널</div>
          <div>업로드</div>
          <div className="text-right">조회수</div>
          <div className="text-center">상태</div>
          <div>{tab === 'matched' ? '매칭 제품' : '잠재 후보'}</div>
        </div>

        {displayVideos.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-3">
            {search ? `"${search}" 검색 결과 없음` : '영상 없음'}
          </div>
        ) : (
          <div>
            {displayVideos.map((v) => {
              const matched = mentionMap.get(v.video_id) ?? []
              const potential = potentialMap.get(v.video_id) ?? []
              const isExpanded = expandedId === v.video_id
              const hasPotential = potential.length > 0

              return (
                <div key={v.video_id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : v.video_id)}
                    className={`grid grid-cols-[56px_1fr_160px_80px_80px_160px] gap-3 px-5 py-[14px] border-b border-line items-center cursor-pointer transition-colors ${
                      isExpanded ? 'bg-surface-2' : 'hover:bg-surface-2/60'
                    } last:border-b-0`}
                  >
                    {/* 썸네일 */}
                    <a
                      href={`https://www.youtube.com/watch?v=${v.video_id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://i.ytimg.com/vi/${v.video_id}/default.jpg`}
                        alt=""
                        className="w-14 h-10 object-cover rounded-md border border-line"
                      />
                    </a>

                    {/* 제목 + 채널 */}
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-ink leading-[1.35] line-clamp-1 mb-[3px]">
                        {v.title}
                      </div>
                      <div className="text-[11px] text-ink-3 font-medium">{v.channel_title ?? '—'}</div>
                    </div>

                    {/* 날짜 */}
                    <div className="text-[12px] text-ink-3">{relDate(v.published_at)}</div>

                    {/* 조회수 */}
                    <div className="text-[12px] text-ink-2 font-semibold text-right num">{fmtViews(v.view_count)}</div>

                    {/* 상태 배지 */}
                    <div className="flex justify-center">
                      {matched.length > 0 ? (
                        <span className="inline-flex items-center gap-[4px] text-[10px] font-bold px-[7px] py-[3px] rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                          <span className="w-[5px] h-[5px] rounded-full bg-primary" />
                          매칭
                        </span>
                      ) : hasPotential ? (
                        <span className="inline-flex items-center gap-[4px] text-[10px] font-bold px-[7px] py-[3px] rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20 whitespace-nowrap">
                          <span className="w-[5px] h-[5px] rounded-full bg-terracotta" />
                          후보
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-[4px] text-[10px] font-bold px-[7px] py-[3px] rounded-full bg-bone text-ink-4 whitespace-nowrap">
                          없음
                        </span>
                      )}
                    </div>

                    {/* 제품/후보 미리보기 */}
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {matched.length > 0
                        ? matched.slice(0, 2).map((m) => (
                            <span key={m.product_id} className="text-[10px] font-semibold bg-primary/10 text-primary px-[7px] py-[3px] rounded-md border border-primary/15 whitespace-nowrap max-w-[140px] truncate">
                              {m.brand_name} {m.product_name}
                            </span>
                          ))
                        : potential.slice(0, 2).map((pm) => (
                            <span key={pm.product.id} className="text-[10px] font-semibold bg-terracotta/10 text-terracotta px-[7px] py-[3px] rounded-md border border-terracotta/15 whitespace-nowrap max-w-[140px] truncate">
                              {pm.product.brand} {pm.product.name.split(' ').slice(0, 2).join(' ')}
                            </span>
                          ))
                      }
                      {matched.length > 2 && (
                        <span className="text-[10px] text-ink-3 py-[3px]">+{matched.length - 2}</span>
                      )}
                    </div>
                  </div>

                  {/* 확장 패널 */}
                  {isExpanded && (
                    <div className="px-5 py-4 bg-surface border-b border-line">
                      <div className="flex gap-6">
                        {/* 썸네일 크게 */}
                        <a
                          href={`https://www.youtube.com/watch?v=${v.video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`}
                            alt={v.title}
                            className="w-[200px] h-[112px] object-cover rounded-lg border border-line"
                          />
                        </a>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink mb-1 leading-[1.4]">{v.title}</div>
                          <div className="text-xs text-ink-3 mb-4">
                            {v.channel_title} · {relDate(v.published_at)} · 조회 {fmtViews(v.view_count)}
                          </div>

                          {matched.length > 0 && (
                            <div>
                              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-ink-3 mb-2">매칭된 제품</div>
                              <div className="flex flex-wrap gap-2">
                                {matched.map((m) => (
                                  <span key={m.product_id} className="inline-flex items-center gap-[5px] bg-primary/10 text-primary text-[11px] font-bold px-3 py-[5px] rounded-lg border border-primary/20">
                                    <span className="w-[5px] h-[5px] rounded-full bg-primary" />
                                    {m.brand_name} {m.product_name}
                                    <span className="text-[9px] opacity-60 ml-1 font-normal">"{m.matched_text}"</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {matched.length === 0 && potential.length > 0 && (
                            <div>
                              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-ink-3 mb-2">
                                잠재 후보 — 키워드 AND 매칭 결과
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {potential.map((pm) => (
                                  <span key={pm.product.id} className="inline-flex items-center gap-[5px] bg-terracotta/10 text-terracotta text-[11px] font-bold px-3 py-[5px] rounded-lg border border-terracotta/20">
                                    <span className="w-[5px] h-[5px] rounded-full bg-terracotta" />
                                    {pm.product.brand} {pm.product.name.split(' ').slice(0, 3).join(' ')}
                                    <span className="text-[9px] opacity-70 ml-1">히트 {pm.hitCount}/{pm.keywords.length} [{pm.keywords.join('·')}]</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {matched.length === 0 && potential.length === 0 && (
                            <div className="text-xs text-ink-4 italic">
                              키워드 매칭 후보 없음 — 뷰티 외 콘텐츠이거나 제품명 등록 필요
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
