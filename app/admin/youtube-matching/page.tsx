/**
 * 어드민 — YouTube 매칭 진단 페이지
 * /admin/youtube-matching
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { YoutubeMatchingView } from '@/components/admin/YoutubeMatchingView'

export const dynamic = 'force-dynamic'

export type VideoRow = {
  video_id: string
  title: string
  channel_title: string | null
  view_count: number | null
  published_at: string | null
}

export type MentionRow = {
  video_id: string
  product_id: string
  matched_text: string
  product_name: string
  brand_name: string
}

export type ProductToken = {
  id: string
  name: string
  brand: string
  normalized: string
}

export default async function YoutubeMatchingPage() {
  const supabase = createAdminClient()

  const [videosRes, mentionsRes, productsRes] = await Promise.all([
    supabase
      .from('youtube_videos')
      .select('video_id, title, channel_title, view_count, published_at')
      .order('published_at', { ascending: false })
      .limit(500),
    supabase
      .from('youtube_mentions')
      .select('video_id, product_id, matched_text, products(name, brands(name))'),
    supabase
      .from('products')
      .select('id, name, normalized_name, brands(name)'),
  ])

  const videos: VideoRow[] = (videosRes.data ?? []).map((v) => ({
    video_id: v.video_id,
    title: v.title,
    channel_title: v.channel_title,
    view_count: v.view_count,
    published_at: v.published_at,
  }))

  const mentions: MentionRow[] = (mentionsRes.data ?? []).map((m: any) => ({
    video_id: m.video_id,
    product_id: m.product_id,
    matched_text: m.matched_text,
    product_name: m.products?.name ?? '',
    brand_name: m.products?.brands?.name ?? '',
  }))

  const products: ProductToken[] = (productsRes.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    brand: p.brands?.name ?? '',
    normalized: p.normalized_name ?? '',
  }))

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <div className="mb-8">
          <div className="text-xs font-bold tracking-[0.1em] uppercase text-ink-3 mb-2">
            어드민 / 진단
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            YouTube 매칭 현황
          </h1>
          <p className="text-sm text-ink-3 mt-1">
            수집된 영상과 제품 간 매칭 상태를 확인합니다. 미매칭 영상에는 잠재 후보를 미리 표시합니다.
          </p>
        </div>

        <YoutubeMatchingView
          videos={videos}
          mentions={mentions}
          products={products}
        />
      </div>
    </main>
  )
}
