#!/usr/bin/env node
/**
 * Supabase Management API로 마이그레이션 + 시드 적용
 * 실행: node --env-file=.env.local scripts/apply-migrations.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const PROJECT_REF = 'nbluhyzyeidnywnafszm'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

if (!ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN 누락. node --env-file=.env.local로 실행하세요.')
  process.exit(1)
}

async function runSql(label, sql) {
  process.stdout.write(`▶ ${label} ... `)
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('FAIL')
    console.error(`  HTTP ${res.status}: ${text}`)
    return false
  }
  console.log('OK')
  return true
}

async function main() {
  const root = path.resolve(import.meta.dirname, '..')
  const migrationsDir = path.join(root, 'supabase', 'migrations')
  const seedsDir = path.join(root, 'supabase', 'seeds')

  // 마이그레이션 (순서대로)
  const migrations = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
  console.log(`\n📋 마이그레이션 ${migrations.length}개:`)
  for (const file of migrations) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8')
    const ok = await runSql(file, sql)
    if (!ok) process.exit(1)
  }

  // 시드 (있으면)
  try {
    const seeds = (await fs.readdir(seedsDir)).filter((f) => f.endsWith('.sql')).sort()
    if (seeds.length > 0) {
      console.log(`\n🌱 시드 ${seeds.length}개:`)
      for (const file of seeds) {
        const sql = await fs.readFile(path.join(seedsDir, file), 'utf-8')
        const ok = await runSql(file, sql)
        if (!ok) process.exit(1)
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }

  // 검증 쿼리: public 스키마 테이블 수
  console.log('\n🔍 검증:')
  const checkRes = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `select tablename from pg_tables where schemaname = 'public' order by tablename;`,
    }),
  })
  const tables = await checkRes.json()
  console.log(`  생성된 테이블 (${tables.length}개):`)
  tables.forEach((t) => console.log(`    · ${t.tablename}`))

  const adKwRes = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `select count(*) as cnt from public.ad_keywords;` }),
  })
  const adKw = await adKwRes.json()
  console.log(`  ad_keywords 시드: ${adKw[0].cnt}개`)

  console.log('\n✅ 적용 완료\n')
}

main().catch((e) => {
  console.error('💥 실패:', e)
  process.exit(1)
})
