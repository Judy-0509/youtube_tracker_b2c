import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// ── 테이블 목록 + 진행 매핑 ──────────────────────────────
const TABLES: Array<{
  name: string
  group: 'master' | 'collection' | 'processed' | 'user'
  publicRead: boolean
  populatedBy: string
}> = [
  { name: 'brands', group: 'master', publicRead: true, populatedBy: 'Phase 3 (올리브영 크롤)' },
  { name: 'products', group: 'master', publicRead: true, populatedBy: 'Phase 3' },
  { name: 'product_sources', group: 'master', publicRead: true, populatedBy: 'Phase 3' },
  { name: 'product_search_keywords', group: 'master', publicRead: false, populatedBy: 'Phase 5' },
  { name: 'ad_keywords', group: 'master', publicRead: false, populatedBy: '✅ Phase 2 완료' },
  { name: 'source_rankings', group: 'collection', publicRead: false, populatedBy: 'Phase 3' },
  { name: 'youtube_videos', group: 'collection', publicRead: false, populatedBy: 'Phase 4' },
  { name: 'youtube_owner_comments', group: 'collection', publicRead: false, populatedBy: 'Phase 4' },
  { name: 'youtube_video_ad_status', group: 'collection', publicRead: false, populatedBy: 'Phase 5 (광고 분류기)' },
  { name: 'youtube_mentions', group: 'collection', publicRead: false, populatedBy: 'Phase 5 (제품 매칭)' },
  { name: 'search_trends', group: 'collection', publicRead: false, populatedBy: 'Phase 6 (네이버랩)' },
  { name: 'shopping_validations', group: 'collection', publicRead: false, populatedBy: 'Phase 6' },
  { name: 'trending_scores', group: 'processed', publicRead: true, populatedBy: 'Phase 7 (점수 산출)' },
  { name: 'discovery_candidates', group: 'processed', publicRead: false, populatedBy: 'Phase 7' },
  { name: 'profiles', group: 'user', publicRead: false, populatedBy: '사용자 가입 시 자동' },
  { name: 'beta_signups', group: 'user', publicRead: false, populatedBy: '베타 폼 제출 시' },
]

const GROUP_LABEL: Record<string, string> = {
  master: '🗂️ 마스터',
  collection: '📥 수집 데이터',
  processed: '⚙️ 가공 / 점수',
  user: '👤 사용자',
}

type Counts = Record<string, number | null>

async function fetchData() {
  const admin = createAdminClient()

  // 모든 테이블 row count 병렬 조회
  const countResults = await Promise.all(
    TABLES.map(async (t) => {
      const { count, error } = await admin
        .from(t.name as never)
        .select('*', { count: 'exact', head: true })
      return { table: t.name, count: error ? null : count ?? 0 }
    }),
  )
  const counts: Counts = Object.fromEntries(countResults.map((r) => [r.table, r.count]))

  // 광고 키워드 전체 (그룹화 위해)
  const { data: adKeywords } = await admin
    .from('ad_keywords')
    .select('id, category, pattern, weight, active, notes')
    .order('category', { ascending: true })
    .order('id', { ascending: true })

  // pg_policies (RLS 정책)
  const { data: policies } = await admin.rpc('exec_sql' as never, {} as never).then(
    () => ({ data: null }),
    () => ({ data: null }),
  )
  // RPC가 없으면 직접 카운트
  let policyCount = 0
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/nbluhyzyeidnywnafszm/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `select count(*)::int as cnt from pg_policies where schemaname='public';`,
        }),
        cache: 'no-store',
      },
    )
    const json = await res.json()
    policyCount = json[0]?.cnt ?? 0
  } catch {}

  return { counts, adKeywords: adKeywords ?? [], policyCount }
}

// ── 카테고리별 광고 키워드 그룹화 ─────────────────────────
function groupKeywords(rows: { category: string; pattern: string; notes: string | null }[]) {
  const map: Record<string, typeof rows> = {}
  for (const r of rows) {
    if (!map[r.category]) map[r.category] = []
    map[r.category].push(r)
  }
  return map
}

const CATEGORY_META: Record<string, { label: string; color: string; desc: string }> = {
  direct: { label: 'direct', color: 'bg-red-50 text-red-700 border-red-200', desc: '직접 광고 표기 (광고/협찬/PPL 등)' },
  hashtag: { label: 'hashtag', color: 'bg-blue-50 text-blue-700 border-blue-200', desc: '해시태그 형태 (#광고 등)' },
  market: { label: 'market', color: 'bg-amber-50 text-amber-700 border-amber-200', desc: '마켓·판매 신호 (공구/단독/라방 등)' },
  regex: { label: 'regex', color: 'bg-purple-50 text-purple-700 border-purple-200', desc: '정규식 패턴' },
}

export default async function AdminStatusPage() {
  const { counts, adKeywords, policyCount } = await fetchData()

  const totalTables = TABLES.length
  const totalRows = Object.values(counts).reduce<number>((s, v) => s + (v ?? 0), 0)
  const publicTables = TABLES.filter((t) => t.publicRead).length
  const populatedTables = TABLES.filter((t) => (counts[t.name] ?? 0) > 0).length

  const grouped = groupKeywords(adKeywords)

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">DB 상태</h1>
              <div className="text-xs text-gray-500 mt-0.5">
                {env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')} · 서울 리전
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/status"
              className="text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-lg"
            >
              ↻ 새로고침
            </Link>
            <Link href="/" className="text-xs text-gray-500 hover:text-gray-900">
              홈으로
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* KPI Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 mb-1">테이블</div>
            <div className="text-3xl font-bold text-gray-900 num">{totalTables}</div>
            <div className="text-xs text-gray-400 mt-1">
              {populatedTables}개 채워짐 · {totalTables - populatedTables}개 대기
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 mb-1">총 row</div>
            <div className="text-3xl font-bold text-primary num">{totalRows.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">현재 적재된 데이터</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 mb-1">공개 테이블</div>
            <div className="text-3xl font-bold text-gray-900 num">{publicTables}</div>
            <div className="text-xs text-gray-400 mt-1">anon SELECT 가능</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 mb-1">RLS 정책</div>
            <div className="text-3xl font-bold text-gray-900 num">{policyCount}</div>
            <div className="text-xs text-gray-400 mt-1">활성 정책 수</div>
          </div>
        </section>

        {/* Tables Inventory by Group */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">테이블 인벤토리</h2>
            <div className="text-xs text-gray-500">RLS · row 수 · 다음 채워질 Phase</div>
          </div>

          {Object.entries(GROUP_LABEL).map(([group, label]) => {
            const tablesInGroup = TABLES.filter((t) => t.group === group)
            return (
              <div key={group} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">테이블명</th>
                        <th className="text-right px-4 py-2 font-medium">Row 수</th>
                        <th className="text-center px-4 py-2 font-medium">공개</th>
                        <th className="text-left px-4 py-2 font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tablesInGroup.map((t) => {
                        const count = counts[t.name]
                        const hasData = (count ?? 0) > 0
                        return (
                          <tr key={t.name} className="hover:bg-primary-subtle group">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-900">
                              <Link
                                href={`/admin/status/${t.name}`}
                                className="hover:text-primary group-hover:underline flex items-center gap-1"
                              >
                                {t.name}
                                <span className="text-gray-300 group-hover:text-primary text-xs">→</span>
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-right num">
                              {count === null ? (
                                <span className="text-red-500">err</span>
                              ) : hasData ? (
                                <span className="font-bold text-primary">{count.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-300">0</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {t.publicRead ? (
                                <span title="anon SELECT 가능">🌐</span>
                              ) : (
                                <span title="service_role only">🔒</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{t.populatedBy}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </section>

        {/* Ad Keywords Browser */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              광고 키워드 사전{' '}
              <span className="text-base font-normal text-gray-500 ml-2">{adKeywords.length}개</span>
            </h2>
            <div className="text-xs text-gray-500">Phase 5 광고 분류기에서 사용</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(CATEGORY_META).map(([cat, meta]) => {
              const items = grouped[cat] ?? []
              return (
                <div key={cat} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <span className={`inline-block text-xs font-mono px-2 py-1 rounded border ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">{meta.desc}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-700 num">{items.length}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((kw) => (
                        <span
                          key={kw.pattern}
                          title={kw.notes ?? undefined}
                          className="inline-block bg-gray-100 hover:bg-gray-200 text-xs font-mono text-gray-700 px-2 py-1 rounded border border-gray-200 transition-colors"
                        >
                          {kw.pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Quick Links */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">바로가기</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <a
              href={`https://supabase.com/dashboard/project/nbluhyzyeidnywnafszm/editor`}
              target="_blank"
              rel="noreferrer"
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary transition"
            >
              <div className="font-semibold text-sm">Supabase Table Editor</div>
              <div className="text-xs text-gray-500 mt-1">대시보드에서 직접 보기</div>
            </a>
            <a
              href={`https://supabase.com/dashboard/project/nbluhyzyeidnywnafszm/sql/new`}
              target="_blank"
              rel="noreferrer"
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary transition"
            >
              <div className="font-semibold text-sm">SQL Editor</div>
              <div className="text-xs text-gray-500 mt-1">직접 쿼리 작성</div>
            </a>
            <a
              href={`https://supabase.com/dashboard/project/nbluhyzyeidnywnafszm/auth/policies`}
              target="_blank"
              rel="noreferrer"
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary transition"
            >
              <div className="font-semibold text-sm">RLS 정책 보기</div>
              <div className="text-xs text-gray-500 mt-1">대시보드 Auth 탭</div>
            </a>
            <Link
              href="/api/health"
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary transition"
            >
              <div className="font-semibold text-sm">/api/health</div>
              <div className="text-xs text-gray-500 mt-1">JSON 헬스 체크</div>
            </Link>
            <a
              href="/"
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary transition"
            >
              <div className="font-semibold text-sm">홈 (코밍순)</div>
              <div className="text-xs text-gray-500 mt-1">/</div>
            </a>
          </div>
        </section>

        {/* Footer note */}
        <div className="text-center text-xs text-gray-400 py-6 border-t border-gray-200">
          ⚠️ 개발용 페이지 — 프로덕션 배포 전 인증 추가 필요
          <br />
          마지막 갱신: {new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </div>
      </div>
    </main>
  )
}
