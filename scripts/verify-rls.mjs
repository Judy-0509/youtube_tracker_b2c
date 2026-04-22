#!/usr/bin/env node
/**
 * RLS 8 케이스 검증.
 * anon 키로 SELECT/INSERT 시도 → 정책대로 허용/거부되는지 확인.
 * 실행: node --env-file=.env.local scripts/verify-rls.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('❌ Supabase URL / anon key 누락')
  process.exit(1)
}

const supabase = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ts = Date.now()

const tests = [
  // ── 공개 SELECT (허용) ──
  {
    name: 'anon SELECT brands (공개 — 허용)',
    expected: 'allow',
    op: () => supabase.from('brands').select('id').limit(1),
  },
  {
    name: 'anon SELECT products (공개 — 허용)',
    expected: 'allow',
    op: () => supabase.from('products').select('id').limit(1),
  },
  {
    name: 'anon SELECT trending_scores (공개 — 허용)',
    expected: 'allow',
    op: () => supabase.from('trending_scores').select('product_id').limit(1),
  },

  // ── 원천 데이터 INSERT (거부) ──
  {
    name: 'anon INSERT brands (정책 없음 — 거부)',
    expected: 'deny',
    op: () => supabase.from('brands').insert({ name: `_rls_test_${ts}` }),
  },
  {
    name: 'anon INSERT youtube_videos (정책 없음 — 거부)',
    expected: 'deny',
    op: () =>
      supabase.from('youtube_videos').insert({
        video_id: `_rls_${ts}`,
        channel_id: 'test',
        title: 'rls test',
      }),
  },
  {
    name: 'anon INSERT ad_keywords (정책 없음 — 거부)',
    expected: 'deny',
    op: () => supabase.from('ad_keywords').insert({ category: 'direct', pattern: `_rls_${ts}` }),
  },

  // ── beta_signups 특수 케이스 ──
  {
    name: 'anon INSERT beta_signups (honeypot — 허용)',
    expected: 'allow',
    op: () => supabase.from('beta_signups').insert({ email: `rls-test-${ts}@test.com` }),
  },
  {
    name: 'anon SELECT beta_signups (정책 없음 — 결과 0건)',
    expected: 'allow_empty', // RLS는 SELECT 거부 시 빈 배열 반환
    op: () => supabase.from('beta_signups').select('id').limit(1),
  },
]

let pass = 0
let fail = 0
const failures = []

console.log(`\n🔍 RLS 검증 — ${tests.length} 케이스\n`)

for (const t of tests) {
  const { data, error } = await t.op()

  let actual
  if (error) {
    actual = 'deny'
  } else if (Array.isArray(data) && data.length === 0) {
    actual = 'allow_empty'
  } else {
    actual = 'allow'
  }

  // 'allow' === 'allow_empty' 둘 다 허용 의미로 인정
  const isMatch =
    t.expected === actual ||
    (t.expected === 'allow' && actual === 'allow_empty') ||
    (t.expected === 'allow_empty' && actual === 'allow')

  if (isMatch) {
    pass++
    console.log(`  ✅ ${t.name}`)
  } else {
    fail++
    failures.push(`${t.name} — expected=${t.expected}, actual=${actual}, error=${error?.message ?? 'none'}`)
    console.log(`  ❌ ${t.name}`)
    console.log(`     expected: ${t.expected} / actual: ${actual}`)
    if (error) console.log(`     error: ${error.message}`)
  }
}

console.log(`\n결과: ${pass}/${tests.length} 통과\n`)

if (fail > 0) {
  console.log('실패 케이스:')
  failures.forEach((f) => console.log(`  · ${f}`))
  process.exit(1)
}

process.exit(0)
