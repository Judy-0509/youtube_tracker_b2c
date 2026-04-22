/**
 * 트렌딩 홈. Server Component.
 *
 * 데이터: lib/data/trending.ts → getTrendingProducts()
 * UI: 클리키 App.html `#page-home` 미러링.
 */
import { Header } from '@/components/layout/Header'
import { TrendingList } from '@/components/trending/TrendingList'
import { getTrendingProducts } from '@/lib/data/trending'

export const dynamic = 'force-dynamic'

function formatToday(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

export default async function HomePage() {
  const products = await getTrendingProducts()

  // 메타 데이터 (간단 집계)
  const totalProducts = products.length
  const channelCount = 313 // PRD 고정값 (수집 채널)
  const updatedLabel = '오늘'

  return (
    <main className="min-h-screen bg-surface">
      <Header />

      <div className="max-w-[1400px] mx-auto px-10 py-10">
        {/* Hero */}
        <section className="bg-card border border-line rounded-2xl px-9 py-8 grid grid-cols-[1fr_auto] gap-10 items-end mb-6 relative overflow-hidden">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-terracotta inline-block animate-pulse" />
              오늘의 트렌딩 · {formatToday()}
            </div>
            <h1 className="text-[40px] font-extrabold tracking-[-0.035em] leading-[1.1] mt-[14px]">
              지금 뜨는<br />K-뷰티<span className="text-ink-4 font-medium">.</span>
            </h1>
            <p className="mt-3 text-sm text-ink-2 max-w-[520px]">
              매일 새벽, 313개 채널과 네이버 검색 데이터를 분석합니다.
              스폰서 콘텐츠가 만든 일시적 노출은 토글로 걸러볼 수 있어요.
            </p>
          </div>

          <div className="grid grid-flow-col auto-cols-max gap-8 py-5">
            <div>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-ink-3 mb-[6px]">
                수집 채널
              </div>
              <div className="text-[26px] font-bold tracking-[-0.025em] num">{channelCount}</div>
              <div className="text-xs text-sage font-semibold mt-[2px]">실시간 모니터링</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-ink-3 mb-[6px]">
                트렌딩 제품
              </div>
              <div className="text-[26px] font-bold tracking-[-0.025em] num">{totalProducts}</div>
              <div className="text-xs text-sage font-semibold mt-[2px]">상위 노출</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-ink-3 mb-[6px]">
                업데이트
              </div>
              <div className="text-[26px] font-bold tracking-[-0.025em]">{updatedLabel}</div>
              <div className="text-xs text-sage font-semibold mt-[2px]">매일 새벽 06:00</div>
            </div>
          </div>
        </section>

        <TrendingList products={products} />
      </div>
    </main>
  )
}
