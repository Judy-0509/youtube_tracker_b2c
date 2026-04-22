/**
 * Trending data layer.
 * Server-side Supabase queries for the public trending UI.
 */
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type TierKey = 'confirmed' | 'buzz_only' | 'newly_discovered' | 'detecting'

export type TrendingProduct = {
  id: string
  name: string
  brand_name: string
  image_url: string | null
  category: string
  tier: TierKey
  composite_score: number
  rank_change_7d: number | null
  youtube_buzz_score: number | null
  search_growth_score: number | null
  organic_buzz_ratio: number | null
  oliveyoung_rank: number | null
}

export type TrendingHistoryPoint = {
  date: string
  composite_score: number
  rank_change_7d: number | null
  youtube_buzz_score: number | null
  search_growth_score: number | null
}

export type ProductDetailRow = TrendingProduct & {
  first_seen_at: string | null
  subcategory: string | null
  sponsored_ratio: number | null
}

export type ProductDetailResult = {
  product: ProductDetailRow | null
  history: TrendingHistoryPoint[]
}

export type RelatedVideo = {
  video_id: string
  title: string
  channel_title: string | null
  view_count: number | null
  published_at: string | null
  status: 'organic' | 'sponsored' | 'unknown'
  duration_sec: number | null
}

/**
 * 가장 최근에 trending_scores가 채워진 날짜를 반환.
 * (오늘 데이터가 없을 수도 있어서 안전 가드)
 */
async function getLatestTrendingDate(supabase: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from('trending_scores')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[trending] latest date query failed:', error.message)
    return null
  }
  return data?.date ?? null
}

/** product_id → 가장 최근 oliveyoung 랭킹 매핑. */
async function fetchLatestOliveyoungRanks(
  supabase: ReturnType<typeof createAdminClient>,
  productIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (productIds.length === 0) return result

  // product_sources 우선 매핑 (oliveyoung 소스만)
  const { data: sources, error: srcErr } = await supabase
    .from('product_sources')
    .select('id, product_id, source')
    .in('product_id', productIds)
    .eq('source', 'oliveyoung')

  if (srcErr) {
    console.error('[trending] product_sources lookup failed:', srcErr.message)
    return result
  }
  const sourceList = sources ?? []
  if (sourceList.length === 0) return result

  const sourceIds = sourceList.map((s) => s.id)
  const sourceToProduct = new Map(sourceList.map((s) => [s.id, s.product_id]))

  const { data: rankings, error: rankErr } = await supabase
    .from('source_rankings')
    .select('product_source_id, rank, scrape_date')
    .in('product_source_id', sourceIds)
    .order('scrape_date', { ascending: false })

  if (rankErr) {
    console.error('[trending] source_rankings lookup failed:', rankErr.message)
    return result
  }

  for (const row of rankings ?? []) {
    const pid = sourceToProduct.get(row.product_source_id)
    if (!pid) continue
    if (!result.has(pid)) {
      result.set(pid, row.rank)
    }
  }
  return result
}

/**
 * 트렌딩 홈 — 오늘(혹은 최신) 날짜 trending_scores 상위 20개.
 */
export async function getTrendingProducts(): Promise<TrendingProduct[]> {
  try {
    const supabase = createAdminClient()
    const latestDate = await getLatestTrendingDate(supabase)
    if (!latestDate) return []

    const { data, error } = await supabase
      .from('trending_scores')
      .select(
        `
        product_id,
        composite_score,
        tier,
        rank_change_7d,
        youtube_buzz_score,
        search_growth_score,
        organic_buzz_ratio,
        products:products!inner (
          id,
          name,
          image_url,
          category,
          brand:brands!inner ( name )
        )
        `,
      )
      .eq('date', latestDate)
      .order('composite_score', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[trending] getTrendingProducts failed:', error.message)
      return []
    }

    const rows = data ?? []
    if (rows.length === 0) return []

    const productIds = rows.map((r) => r.product_id)
    const oyRanks = await fetchLatestOliveyoungRanks(supabase, productIds)

    return rows.map((r) => {
      // PostgREST nested select returns object (single relation). Type as any for the join shape.
      const product = (r as { products: any }).products
      const brandObj = product?.brand
      const brandName: string =
        Array.isArray(brandObj) ? brandObj[0]?.name ?? '' : brandObj?.name ?? ''
      return {
        id: r.product_id,
        name: product?.name ?? '',
        brand_name: brandName,
        image_url: product?.image_url ?? null,
        category: product?.category ?? '',
        tier: (r.tier as TierKey) ?? 'detecting',
        composite_score: Number(r.composite_score ?? 0),
        rank_change_7d: r.rank_change_7d,
        youtube_buzz_score: r.youtube_buzz_score,
        search_growth_score: r.search_growth_score,
        organic_buzz_ratio: r.organic_buzz_ratio,
        oliveyoung_rank: oyRanks.get(r.product_id) ?? null,
      }
    })
  } catch (err) {
    console.error('[trending] getTrendingProducts threw:', err)
    return []
  }
}

/**
 * 제품 상세 + 최근 7일 트렌딩 점수 시계열.
 */
export async function getProductDetail(id: string): Promise<ProductDetailResult> {
  try {
    const supabase = createAdminClient()

    const { data: productRow, error: prodErr } = await supabase
      .from('products')
      .select(
        `
        id,
        name,
        image_url,
        category,
        subcategory,
        first_seen_at,
        brand:brands!inner ( name )
        `,
      )
      .eq('id', id)
      .maybeSingle()

    if (prodErr) {
      console.error('[trending] getProductDetail product failed:', prodErr.message)
      return { product: null, history: [] }
    }
    if (!productRow) {
      return { product: null, history: [] }
    }

    // 최근 14일 trending_scores (차트 14일 탭 대비)
    const { data: scores, error: scoreErr } = await supabase
      .from('trending_scores')
      .select(
        'date, composite_score, tier, rank_change_7d, youtube_buzz_score, search_growth_score, organic_buzz_ratio, sponsored_ratio',
      )
      .eq('product_id', id)
      .order('date', { ascending: false })
      .limit(14)

    if (scoreErr) {
      console.error('[trending] getProductDetail scores failed:', scoreErr.message)
    }

    const scoreRows = scores ?? []
    const latest = scoreRows[0]
    const history: TrendingHistoryPoint[] = scoreRows
      .slice()
      .reverse()
      .map((s) => ({
        date: s.date,
        composite_score: Number(s.composite_score ?? 0),
        rank_change_7d: s.rank_change_7d,
        youtube_buzz_score: s.youtube_buzz_score,
        search_growth_score: s.search_growth_score,
      }))

    const oyRanks = await fetchLatestOliveyoungRanks(supabase, [id])
    const brandObj = (productRow as { brand: any }).brand
    const brandName: string =
      Array.isArray(brandObj) ? brandObj[0]?.name ?? '' : brandObj?.name ?? ''

    const detail: ProductDetailRow = {
      id: productRow.id,
      name: productRow.name,
      brand_name: brandName,
      image_url: productRow.image_url ?? null,
      category: productRow.category ?? '',
      subcategory: productRow.subcategory ?? null,
      first_seen_at: productRow.first_seen_at ?? null,
      tier: (latest?.tier as TierKey) ?? 'detecting',
      composite_score: Number(latest?.composite_score ?? 0),
      rank_change_7d: latest?.rank_change_7d ?? null,
      youtube_buzz_score: latest?.youtube_buzz_score ?? null,
      search_growth_score: latest?.search_growth_score ?? null,
      organic_buzz_ratio: latest?.organic_buzz_ratio ?? null,
      sponsored_ratio: latest?.sponsored_ratio ?? null,
      oliveyoung_rank: oyRanks.get(id) ?? null,
    }

    return { product: detail, history }
  } catch (err) {
    console.error('[trending] getProductDetail threw:', err)
    return { product: null, history: [] }
  }
}

/**
 * 제품에 매칭된 유튜브 영상 + 광고 분류 상태.
 */
export async function getRelatedVideos(productId: string): Promise<RelatedVideo[]> {
  try {
    const supabase = createAdminClient()

    const { data: mentions, error: mentErr } = await supabase
      .from('youtube_mentions')
      .select('video_id')
      .eq('product_id', productId)

    if (mentErr) {
      console.error('[trending] getRelatedVideos mentions failed:', mentErr.message)
      return []
    }

    const videoIds = Array.from(new Set((mentions ?? []).map((m) => m.video_id)))
    if (videoIds.length === 0) return []

    const { data: videos, error: vidErr } = await supabase
      .from('youtube_videos')
      .select('video_id, title, channel_title, view_count, published_at, duration_sec')
      .in('video_id', videoIds)
      .order('view_count', { ascending: false })
      .limit(10)

    if (vidErr) {
      console.error('[trending] getRelatedVideos videos failed:', vidErr.message)
      return []
    }
    const videoRows = videos ?? []
    if (videoRows.length === 0) return []

    const { data: adStatuses, error: adErr } = await supabase
      .from('youtube_video_ad_status')
      .select('video_id, status')
      .in(
        'video_id',
        videoRows.map((v) => v.video_id),
      )

    if (adErr) {
      console.error('[trending] getRelatedVideos ad status failed:', adErr.message)
    }

    const statusMap = new Map<string, string>()
    for (const s of adStatuses ?? []) {
      statusMap.set(s.video_id, s.status)
    }

    return videoRows.map((v) => {
      const raw = statusMap.get(v.video_id)
      let status: RelatedVideo['status'] = 'unknown'
      if (raw === 'organic') status = 'organic'
      else if (raw === 'sponsored') status = 'sponsored'
      return {
        video_id: v.video_id,
        title: v.title,
        channel_title: v.channel_title,
        view_count: v.view_count,
        published_at: v.published_at,
        status,
        duration_sec: v.duration_sec,
      }
    })
  } catch (err) {
    console.error('[trending] getRelatedVideos threw:', err)
    return []
  }
}
