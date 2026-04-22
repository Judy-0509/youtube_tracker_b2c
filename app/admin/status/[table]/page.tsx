import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const ALLOWED = [
  'brands',
  'products',
  'product_sources',
  'product_search_keywords',
  'ad_keywords',
  'source_rankings',
  'youtube_videos',
  'youtube_owner_comments',
  'youtube_video_ad_status',
  'youtube_mentions',
  'search_trends',
  'shopping_validations',
  'trending_scores',
  'discovery_candidates',
  'profiles',
  'beta_signups',
] as const

const PAGE_SIZE = 50

type Row = Record<string, unknown>

export default async function TableDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { table } = await params
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10))

  if (!ALLOWED.includes(table as (typeof ALLOWED)[number])) notFound()

  const admin = createAdminClient()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // ── 데이터 fetch (테이블별 커스텀) ─────────────────────
  let rows: Row[] = []
  let total = 0
  let columns: string[] = []
  let renderHints: Record<string, 'image' | 'url' | 'date' | 'array' | 'json' | 'boolean'> = {}

  const { count } = await admin
    .from(table as never)
    .select('*', { count: 'exact', head: true })
  total = count ?? 0

  if (table === 'brands') {
    const { data } = await admin
      .from('brands')
      .select('id, name, name_en, aliases, created_at')
      .range(from, to)
      .order('name')
    rows = data ?? []
    columns = ['name', 'name_en', 'aliases', 'product_count', 'created_at']
    renderHints = { aliases: 'array', created_at: 'date' }
    // enrich with product count
    if (rows.length) {
      const ids = rows.map((r) => r.id as string)
      const { data: products } = await admin.from('products').select('brand_id').in('brand_id', ids)
      const counts: Record<string, number> = {}
      ;(products ?? []).forEach((p: { brand_id: string }) => {
        counts[p.brand_id] = (counts[p.brand_id] || 0) + 1
      })
      rows = rows.map((b) => ({ ...b, product_count: counts[b.id as string] || 0 }))
    }
  } else if (table === 'products') {
    const { data } = await admin
      .from('products')
      .select('id, name, normalized_name, variant, category, subcategory, image_url, first_seen_at, brands(name)')
      .range(from, to)
      .order('first_seen_at', { ascending: false })
    rows = (data ?? []).map((r: Row & { brands: { name: string } | null }) => ({
      ...r,
      brand: r.brands?.name ?? null,
    }))
    columns = ['image_url', 'brand', 'name', 'category', 'subcategory', 'variant', 'first_seen_at']
    renderHints = { image_url: 'image', first_seen_at: 'date' }
  } else if (table === 'product_sources') {
    const { data } = await admin
      .from('product_sources')
      .select('id, source, external_id, url, first_seen_at, products(name, brands(name))')
      .range(from, to)
      .order('first_seen_at', { ascending: false })
    rows = (data ?? []).map((r: Row & { products: { name: string; brands: { name: string } | null } | null }) => ({
      ...r,
      product: r.products?.name,
      brand: r.products?.brands?.name,
    }))
    columns = ['source', 'external_id', 'brand', 'product', 'url', 'first_seen_at']
    renderHints = { url: 'url', first_seen_at: 'date' }
  } else if (table === 'source_rankings') {
    const { data } = await admin
      .from('source_rankings')
      .select('id, source, category, rank, price, scrape_date, scraped_at, product_sources(external_id, products(name, brands(name)))')
      .range(from, to)
      .order('scrape_date', { ascending: false })
      .order('rank', { ascending: true })
    rows = (data ?? []).map((r: Row & { product_sources: { external_id: string; products: { name: string; brands: { name: string } | null } | null } | null }) => ({
      ...r,
      external_id: r.product_sources?.external_id,
      product: r.product_sources?.products?.name,
      brand: r.product_sources?.products?.brands?.name,
    }))
    columns = ['scrape_date', 'source', 'category', 'rank', 'brand', 'product', 'price']
    renderHints = { scrape_date: 'date' }
  } else if (table === 'ad_keywords') {
    const { data } = await admin
      .from('ad_keywords')
      .select('id, category, pattern, weight, active, notes')
      .range(from, to)
      .order('category')
      .order('id')
    rows = data ?? []
    columns = ['category', 'pattern', 'weight', 'active', 'notes']
    renderHints = { active: 'boolean' }
  } else if (table === 'beta_signups') {
    const { data } = await admin
      .from('beta_signups')
      .select('id, email, source, created_at')
      .range(from, to)
      .order('created_at', { ascending: false })
    rows = data ?? []
    columns = ['email', 'source', 'created_at']
    renderHints = { created_at: 'date' }
  } else if (table === 'profiles') {
    const { data } = await admin
      .from('profiles')
      .select('id, email, display_name, plan, created_at')
      .range(from, to)
      .order('created_at', { ascending: false })
    rows = data ?? []
    columns = ['email', 'display_name', 'plan', 'created_at']
    renderHints = { created_at: 'date' }
  } else if (table === 'youtube_videos') {
    const { data } = await admin
      .from('youtube_videos')
      .select('video_id, channel_title, title, is_short, duration_sec, view_count, hashtags, published_at')
      .range(from, to)
      .order('published_at', { ascending: false })
    rows = data ?? []
    columns = ['published_at', 'channel_title', 'title', 'is_short', 'duration_sec', 'view_count', 'hashtags']
    renderHints = { published_at: 'date', is_short: 'boolean', hashtags: 'array' }
  } else if (table === 'youtube_owner_comments') {
    const { data } = await admin
      .from('youtube_owner_comments')
      .select('comment_id, video_id, text, published_at')
      .range(from, to)
      .order('published_at', { ascending: false })
    rows = data ?? []
    columns = ['published_at', 'video_id', 'text']
    renderHints = { published_at: 'date' }
  } else if (table === 'youtube_video_ad_status') {
    const { data } = await admin
      .from('youtube_video_ad_status')
      .select('video_id, status, confidence, classified_at')
      .range(from, to)
      .order('classified_at', { ascending: false })
    rows = data ?? []
    columns = ['classified_at', 'video_id', 'status', 'confidence']
    renderHints = { classified_at: 'date' }
  } else if (table === 'youtube_mentions') {
    const { data } = await admin
      .from('youtube_mentions')
      .select('id, matched_at, matched_text, video_id, products(name, brands(name))')
      .range(from, to)
      .order('matched_at', { ascending: false })
    rows = (data ?? []).map((r: Row & { products: { name: string; brands: { name: string } | null } | null }) => ({
      ...r,
      product: r.products?.name,
      brand: r.products?.brands?.name,
    }))
    columns = ['matched_at', 'brand', 'product', 'matched_text', 'video_id']
    renderHints = { matched_at: 'date' }
  } else {
    // 기타 테이블: 전체 컬럼 RAW
    const { data } = await admin
      .from(table as never)
      .select('*')
      .range(from, to)
    rows = (data ?? []) as Row[]
    columns = rows[0] ? Object.keys(rows[0] as object) : []
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/status" className="text-gray-500 hover:text-gray-900 text-sm">
              ← DB 상태
            </Link>
            <div>
              <div className="font-mono text-base font-bold">{table}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {total.toLocaleString()} row · {totalPages} 페이지
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {rows.length > 0 && (
              <span>
                {(from + 1).toLocaleString()}–{Math.min(to + 1, total).toLocaleString()} 표시 중
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {rows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
            <div className="text-lg font-bold text-gray-900 mb-2">데이터가 없습니다</div>
            <div className="text-sm text-gray-500">
              이 테이블은 아직 비어 있어요. 해당 Phase가 실행되면 채워집니다.
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600 border-b border-gray-200">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="text-left px-4 py-3 font-semibold whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map((col) => (
                          <td key={col} className="px-4 py-3 align-top">
                            {renderCell(row[col], renderHints[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500">
                  페이지 {page} / {totalPages}
                </div>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={`/admin/status/${table}?page=${page - 1}`}
                      className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-1.5 rounded-lg text-sm"
                    >
                      ← 이전
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={`/admin/status/${table}?page=${page + 1}`}
                      className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-1.5 rounded-lg text-sm"
                    >
                      다음 →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

// ── 셀 렌더링 ──────────────────────────────────────────────
function renderCell(value: unknown, hint?: 'image' | 'url' | 'date' | 'array' | 'json' | 'boolean') {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-300">—</span>
  }

  if (hint === 'image' && typeof value === 'string') {
    return (
      <img
        src={value}
        alt=""
        className="w-12 h-12 rounded object-cover bg-gray-100 border border-gray-200"
        loading="lazy"
      />
    )
  }

  if (hint === 'url' && typeof value === 'string') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline text-xs font-mono"
      >
        {value.length > 50 ? `${value.substring(0, 50)}…` : value}
      </a>
    )
  }

  if (hint === 'date' && typeof value === 'string') {
    return (
      <span className="text-xs text-gray-600 whitespace-nowrap font-mono">
        {new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
      </span>
    )
  }

  if (hint === 'array' && Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-300">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span
            key={i}
            className="bg-gray-100 text-xs font-mono text-gray-700 px-2 py-0.5 rounded"
          >
            {String(v)}
          </span>
        ))}
      </div>
    )
  }

  if (hint === 'boolean') {
    return value === true ? <span className="text-primary">✓</span> : <span className="text-gray-400">✗</span>
  }

  if (typeof value === 'object') {
    return (
      <pre className="text-xs bg-gray-50 p-1 rounded font-mono overflow-x-auto max-w-xs">
        {JSON.stringify(value, null, 0)}
      </pre>
    )
  }

  if (typeof value === 'number') {
    return <span className="num">{value.toLocaleString()}</span>
  }

  const s = String(value)
  return <span className={s.length > 50 ? '' : 'whitespace-nowrap'}>{s.length > 100 ? `${s.substring(0, 100)}…` : s}</span>
}
