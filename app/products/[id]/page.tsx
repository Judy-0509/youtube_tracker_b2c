/**
 * 제품 상세 페이지. Server Component.
 *
 * 데이터: lib/data/trending.ts → getProductDetail, getRelatedVideos
 * UI: 클리키 App.html `#page-detail` 미러링.
 */
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { RelatedVideoList } from '@/components/trending/RelatedVideoList'
import { TierBadge, type TierKey } from '@/components/trending/TierBadge'
import { TrendChart } from '@/components/trending/TrendChart'
import { getProductDetail, getRelatedVideos } from '@/lib/data/trending'

export const dynamic = 'force-dynamic'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function formatScore(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(digits)
}

function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${Math.round(n * 100)}%`
}

type Params = Promise<{ id: string }>

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const [{ product, history }, videos] = await Promise.all([
    getProductDetail(id),
    getRelatedVideos(id),
  ])

  if (!product) {
    notFound()
  }

  const tier: TierKey = (product.tier as TierKey) ?? 'detecting'

  // 디스플레이용 0..100 정규화 (composite_score는 z-score 합)
  const scaledComposite = Math.max(0, Math.min(100, Math.round(((product.composite_score + 1) / 2) * 100)))

  // 3축 기여도 표시 (raw 값을 max 기준으로 0..100)
  const ytPct = Math.min(100, Math.round((product.youtube_buzz_score ?? 0) * 10))
  const searchPct = Math.min(100, Math.round((product.search_growth_score ?? 0) * 100))
  const rankPct = Math.min(100, Math.round(Math.abs(product.rank_change_7d ?? 0) * 5))

  return (
    <main className="min-h-screen bg-surface">
      <Header />

      <div className="max-w-[1400px] mx-auto px-10 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[13px] text-ink-3 mb-6">
          <Link href="/" className="hover:text-primary">트렌딩</Link>
          <span className="text-ink-4">›</span>
          <span>{product.brand_name || '브랜드'}</span>
          <span className="text-ink-4">›</span>
          <span className="text-ink-2">{product.name}</span>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
          {/* Product header card */}
          <section className="bg-card border border-line rounded-2xl p-8">
            <div className="flex gap-6 items-start">
              <div className="w-[140px] h-[140px] flex-shrink-0 rounded-xl border border-line bg-surface relative overflow-hidden grid place-items-center">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="140px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0,transparent_6px,rgba(31,58,46,0.05)_6px,rgba(31,58,46,0.05)_12px)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-sage mb-[6px]">
                  {product.brand_name || '브랜드'}
                </div>
                <h1 className="text-[30px] font-extrabold tracking-[-0.03em] leading-[1.15] text-ink mb-3">
                  {product.name}
                </h1>
                <div className="flex gap-2 items-center mb-4 flex-wrap">
                  <TierBadge tier={tier} />
                  {product.category && (
                    <span className="text-xs text-ink-3 bg-surface px-[10px] py-[5px] rounded-md border border-line font-medium">
                      {product.category}
                    </span>
                  )}
                  {product.subcategory && (
                    <span className="text-xs text-ink-3 bg-surface px-[10px] py-[5px] rounded-md border border-line font-medium">
                      {product.subcategory}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-dashed border-line grid grid-cols-3 gap-5">
              <div>
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-ink-3 mb-1">
                  복합 점수
                </div>
                <div className="text-[18px] font-bold tracking-[-0.02em] num">
                  {formatScore(product.composite_score, 2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-ink-3 mb-1">
                  올영 랭킹
                </div>
                <div className="text-[18px] font-bold tracking-[-0.02em] num">
                  {product.oliveyoung_rank ? `#${product.oliveyoung_rank}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-ink-3 mb-1">
                  오가닉 비율
                </div>
                <div className="text-[18px] font-bold tracking-[-0.02em] num">
                  {formatPercent(product.organic_buzz_ratio)}
                </div>
              </div>
            </div>
          </section>

          {/* Score card (primary fill) */}
          <section className="bg-primary text-surface rounded-2xl p-8 flex flex-col relative overflow-hidden">
            <div
              className="absolute -top-10 -right-10 w-[180px] h-[180px] rounded-full"
              style={{ background: 'rgba(140, 168, 144, 0.08)' }}
            />
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-sage-2">
              3축 트렌드 점수
            </div>
            <div className="mt-[14px] flex items-baseline gap-[10px]">
              <div className="text-[64px] font-extrabold tracking-[-0.04em] leading-none num">
                {scaledComposite}
              </div>
              <div className="text-sm text-sage-2 font-medium">/ 100</div>
              {product.rank_change_7d !== null && product.rank_change_7d !== 0 && (
                <div className="ml-auto text-[13px] font-bold text-terracotta-2 bg-terracotta/15 py-[5px] px-[10px] rounded-md num">
                  {product.rank_change_7d > 0 ? '▲' : '▼'} {Math.abs(product.rank_change_7d)}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-4 relative z-10">
              {/* 랭킹 기여 */}
              <div>
                <div className="flex justify-between items-baseline mb-[7px]">
                  <div className="text-[13px] font-semibold flex items-center gap-2">
                    <span className="w-[18px] h-[18px] rounded grid place-items-center text-[10px] font-bold bg-sage-2 text-primary">
                      R
                    </span>
                    랭킹 기여
                  </div>
                  <div className="text-sm font-bold num">
                    {formatScore(product.rank_change_7d, 0)}
                  </div>
                </div>
                <div className="h-[10px] rounded-full overflow-hidden relative" style={{ background: 'rgba(244, 240, 230, 0.1)' }}>
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full"
                    style={{
                      width: `${rankPct}%`,
                      background: 'linear-gradient(90deg, #8CA890, #B5CCB8)',
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                </div>
                <div className="text-[11px] text-sage-2 mt-[5px]">
                  올리브영 7일 랭킹 변동
                </div>
              </div>

              {/* YouTube 기여 */}
              <div>
                <div className="flex justify-between items-baseline mb-[7px]">
                  <div className="text-[13px] font-semibold flex items-center gap-2">
                    <span className="w-[18px] h-[18px] rounded grid place-items-center text-[10px] font-bold bg-terracotta text-white">
                      Y
                    </span>
                    YouTube 기여
                  </div>
                  <div className="text-sm font-bold num">
                    {formatScore(product.youtube_buzz_score)}
                  </div>
                </div>
                <div className="h-[10px] rounded-full overflow-hidden relative" style={{ background: 'rgba(244, 240, 230, 0.1)' }}>
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full"
                    style={{
                      width: `${ytPct}%`,
                      background: 'linear-gradient(90deg, #C97B5A, #E8B59A)',
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                </div>
                <div className="text-[11px] text-sage-2 mt-[5px]">
                  영상 언급량 × 조회수 (오가닉 보정)
                </div>
              </div>

              {/* 검색 기여 */}
              <div>
                <div className="flex justify-between items-baseline mb-[7px]">
                  <div className="text-[13px] font-semibold flex items-center gap-2">
                    <span className="w-[18px] h-[18px] rounded grid place-items-center text-[10px] font-bold bg-bone text-primary">
                      S
                    </span>
                    검색 기여
                  </div>
                  <div className="text-sm font-bold num">
                    {formatScore(product.search_growth_score, 2)}
                  </div>
                </div>
                <div className="h-[10px] rounded-full overflow-hidden relative" style={{ background: 'rgba(244, 240, 230, 0.1)' }}>
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full"
                    style={{
                      width: `${searchPct}%`,
                      background: 'linear-gradient(90deg, #E8E1CC, #F4EDD9)',
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                </div>
                <div className="text-[11px] text-sage-2 mt-[5px]">
                  네이버 검색량 7일 성장률
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-sage-2 flex items-center gap-2 relative z-10">
              <span>최초 감지</span>
              <span className="text-surface font-medium num">{formatDate(product.first_seen_at)}</span>
            </div>
          </section>
        </div>

        {/* Trend chart */}
        <TrendChart history={history} />

        {/* Related videos */}
        <RelatedVideoList videos={videos} />
      </div>
    </main>
  )
}
