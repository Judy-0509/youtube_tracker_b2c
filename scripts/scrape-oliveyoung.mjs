#!/usr/bin/env node
/**
 * 올리브영 베스트 100개 일일 크롤 + DB 적재.
 * 실행: node --env-file=.env.local scripts/scrape-oliveyoung.mjs
 *
 * 흐름:
 *  1. Playwright로 getBestList.do fetch
 *  2. lib/scrapers/oliveyoung로 100개 제품 파싱
 *  3. lib/normalize로 정규화 + skincare/makeup만 필터 (~86개)
 *  4. UPSERT brands → products → product_sources → INSERT source_rankings
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ── 설정 ─────────────────────────────────────────────────────
const URL = 'https://www.oliveyoung.co.kr/store/main/getBestList.do'
const SOURCE = 'oliveyoung'

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}

if (!env.url || !env.serviceKey) {
  console.error('❌ Supabase env 누락')
  process.exit(1)
}

// 동적 import (TS 모듈 직접 사용 위해 tsx로 컴파일 필요 → 대신 인라인)
async function loadParser() {
  // .mjs에서 .ts 직접 import 불가 → 인라인 구현
  return null
}

// ── 인라인 파서 (lib/scrapers/oliveyoung.ts와 동일) ──────────
function parseBestList(html) {
  const matches = [...html.matchAll(/data-ref-goodsno="(A\d+)"/gi)]
  const firstPos = new Map()
  for (const m of matches) if (!firstPos.has(m[1])) firstPos.set(m[1], m.index)
  const positions = [...firstPos.entries()].sort((a, b) => a[1] - b[1])

  const ex = (text, re, decode = false) => {
    const m = text.match(re)
    if (!m) return null
    let v = m[1]
    if (decode) v = v.replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    return v
  }
  const parsePrice = (s) => (s ? (Number.isFinite(Number(s.replace(/,/g, ''))) ? Number(s.replace(/,/g, '')) : null) : null)

  const products = []
  for (let i = 0; i < positions.length; i++) {
    const [goodsNo, pos] = positions[i]
    const nextPos = i + 1 < positions.length ? positions[i + 1][1] : html.length
    const card = html.substring(Math.max(0, pos - 300), Math.min(html.length, nextPos + 100))

    const brand = ex(card, /data-ref-goodsbrand="([^"]+)"/i)
    const name = ex(card, /data-ref-goodsnm="([^"]+)"/i)
    const categoryFull = ex(card, /data-ref-goodscategory="([^"]+)"/i, true)
    const trackingRaw = ex(card, /data-ref-goodstrackingno="([^"]+)"/i)
    const rankRaw = ex(card, /<span class="thumb_flag best">(\d+)</)
    const discount = parsePrice(ex(card, /<span class="tx_cur"><span class="tx_num">([\d,]+)/))
    const original = parsePrice(ex(card, /<span class="tx_org"><span class="tx_num">([\d,]+)/))
    const imageUrl = ex(card, /<img src="(https:\/\/image\.oliveyoung\.co\.kr\/[^"]+)"/)
    const reviewWidth = ex(card, /<span class="point" style="width:(\d+(?:\.\d+)?)%">/)
    const reviewScore = reviewWidth ? Math.round((Number(reviewWidth) / 10) * 10) / 10 : null

    if (!brand || !name || !categoryFull) continue
    const tNo = trackingRaw ? Number(trackingRaw) : NaN
    const rank = rankRaw ? Number(rankRaw) : Number.isFinite(tNo) ? tNo : i + 1

    products.push({
      goodsNo,
      brand: brand.trim(),
      name: name.trim(),
      rank,
      categoryCode: categoryFull.split('>')[0].trim(),
      categoryFull,
      price: discount ?? original,
      originalPrice: original,
      imageUrl: imageUrl || null,
      productUrl: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${goodsNo}`,
      reviewScore,
    })
  }
  return products
}

function detectChallenge(html) {
  const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
  if (title.includes('잠시만 기다려') || /attention required/i.test(title)) return { challenged: true, reason: `title="${title}"` }
  if (html.length < 100_000) return { challenged: true, reason: `too small (${html.length}B)` }
  return { challenged: false }
}

// ── 정규화 (lib/normalize/product.ts 인라인) ─────────────────
const CATEGORY_MAP = { '01': 'skincare', '02': 'makeup', '04': 'bodycare', '05': 'haircare' }
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function normalizeBrand(raw) {
  return raw.trim().replace(/\s+/g, ' ')
}
function cleanName(raw) {
  let n = raw
  n = n.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
  n = n.replace(/\b(기획|증정|특별|대용량|골라담기|7종|3종|2종|판매|한정|SALE|세일)\b/gi, ' ')
  n = n.replace(/[+]/g, ' ').replace(/\s+/g, ' ').trim()
  return n
}
function normalizeForSearch(s) {
  return s.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
function extractVariant(raw) {
  const patterns = [/(\d+(?:\+\d+)?매)/i, /(\d+(?:\.\d+)?\s?ml)\b/i, /(\d+(?:\.\d+)?\s?g)\b/i, /(\d+(?:\.\d+)?\s?(?:정|캡슐|개))\b/i]
  for (const p of patterns) {
    const m = raw.match(p)
    if (m) return m[1].replace(/\s/g, '').toLowerCase()
  }
  return ''
}
function extractSubcategory(full) {
  const parts = full.split('>').map((s) => s.trim())
  return parts[2] ?? parts[1] ?? null
}
function normalize(p) {
  const brandName = normalizeBrand(p.brand)
  const productName = cleanName(p.name)
  return {
    brandName,
    productName,
    normalizedName: normalizeForSearch(productName),
    variant: extractVariant(p.name),
    category: CATEGORY_MAP[p.categoryCode] ?? null,
    subcategory: extractSubcategory(p.categoryFull),
  }
}

// ── 메인 ────────────────────────────────────────────────────
async function fetchHtml() {
  console.log('🚀 Chromium 시작...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8' },
  })
  const page = await context.newPage()
  console.log(`📥 fetch: ${URL}`)
  const res = await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('[data-ref-goodsno]', { timeout: 15000 }).catch(() => {})
  const html = await page.content()
  const status = res?.status() ?? 0
  await browser.close()
  return { status, html }
}

async function upsertAll(supabase, normalized) {
  const today = new Date().toISOString().split('T')[0]
  const stats = { brands: 0, products: 0, sources: 0, rankings: 0, skipped: 0, errors: 0 }

  for (const item of normalized) {
    try {
      // 1. brand UPSERT
      const { data: brand, error: be } = await supabase
        .from('brands')
        .upsert({ name: item.brandName }, { onConflict: 'name' })
        .select('id')
        .single()
      if (be || !brand) throw be ?? new Error('brand upsert failed')
      stats.brands++

      // 2. product UPSERT (brand_id + normalized_name + variant unique)
      const { data: product, error: pe } = await supabase
        .from('products')
        .upsert(
          {
            brand_id: brand.id,
            name: item.productName,
            normalized_name: item.normalizedName,
            variant: item.variant,
            category: item.category,
            subcategory: item.subcategory,
            image_url: item.imageUrl,
          },
          { onConflict: 'brand_id,normalized_name,variant' },
        )
        .select('id')
        .single()
      if (pe || !product) throw pe ?? new Error('product upsert failed')
      stats.products++

      // 3. product_source UPSERT
      const { data: src, error: se } = await supabase
        .from('product_sources')
        .upsert(
          { product_id: product.id, source: SOURCE, external_id: item.goodsNo, url: item.productUrl },
          { onConflict: 'source,external_id' },
        )
        .select('id')
        .single()
      if (se || !src) throw se ?? new Error('product_source upsert failed')
      stats.sources++

      // 4. source_ranking UPSERT (멱등 — 같은 날 재실행 OK)
      const { error: re } = await supabase.from('source_rankings').upsert(
        {
          source: SOURCE,
          product_source_id: src.id,
          category: item.category,
          rank: item.rank,
          price: item.price,
          review_count: null,
          scrape_date: today,
        },
        { onConflict: 'product_source_id,scrape_date' },
      )
      if (re) throw re
      stats.rankings++
    } catch (e) {
      stats.errors++
      console.error(`  ❌ ${item.brandName} - ${item.productName.substring(0, 30)}:`, e.message)
    }
  }

  return stats
}

async function main() {
  const supabase = createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) Fetch
  const { status, html } = await fetchHtml()
  console.log(`  HTTP ${status} | size=${html.length} bytes`)

  // 2) 챌린지 감지
  const ch = detectChallenge(html)
  if (ch.challenged) {
    console.error(`💥 차단/챌린지 감지: ${ch.reason}`)
    process.exit(2)
  }

  // 3) Parse
  const products = parseBestList(html)
  console.log(`📦 파싱: ${products.length}개 제품`)

  // 4) Normalize + filter
  const enriched = products.map((p) => ({ ...p, ...normalize(p) }))
  const target = enriched.filter((p) => p.category === 'skincare' || p.category === 'makeup')
  console.log(`🎯 스킨/메이크업 필터: ${target.length}개`)
  console.log(`  · skincare: ${target.filter((p) => p.category === 'skincare').length}`)
  console.log(`  · makeup:   ${target.filter((p) => p.category === 'makeup').length}`)

  // 5) Upsert
  console.log(`\n💾 DB 적재...`)
  const stats = await upsertAll(supabase, target.map((t) => ({
    brandName: t.brandName,
    productName: t.productName,
    normalizedName: t.normalizedName,
    variant: t.variant,
    category: t.category,
    subcategory: t.subcategory,
    imageUrl: t.imageUrl,
    goodsNo: t.goodsNo,
    productUrl: t.productUrl,
    rank: t.rank,
    price: t.price,
  })))

  console.log(`\n📊 결과:`)
  console.log(`  brands UPSERT:    ${stats.brands}`)
  console.log(`  products UPSERT:  ${stats.products}`)
  console.log(`  sources UPSERT:   ${stats.sources}`)
  console.log(`  rankings INSERT:  ${stats.rankings}`)
  console.log(`  errors:           ${stats.errors}`)

  if (stats.errors > 0) process.exit(1)
  console.log('\n✅ 완료')
}

main().catch((e) => {
  console.error('💥 실패:', e)
  process.exit(1)
})
