#!/usr/bin/env node
/**
 * Playwright로 올영 베스트 페이지 3개 fetch 테스트.
 * 성공 시 data/raw-recon/oy-*.html 저장.
 */
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const RAW_DIR = path.resolve('./data/raw-recon')

const URLS = [
  { name: 'all', url: 'https://www.oliveyoung.co.kr/store/main/getBestList.do' },
  { name: 'skin', url: 'https://www.oliveyoung.co.kr/store/main/getBestList.do?dispCatNo=10000010001' },
  { name: 'makeup', url: 'https://www.oliveyoung.co.kr/store/main/getBestList.do?dispCatNo=10000010002' },
]

async function main() {
  await fs.mkdir(RAW_DIR, { recursive: true })

  console.log('🚀 Chromium 시작...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    },
  })

  const page = await context.newPage()

  for (const target of URLS) {
    console.log(`\n📥 ${target.name}: ${target.url}`)
    try {
      const res = await page.goto(target.url, { waitUntil: 'networkidle', timeout: 45000 })
      const status = res?.status() ?? 0
      // 추가 대기: 제품 카드 로드
      await page.waitForSelector('.cate_prd_list, .prd_info, [data-ref-goodsno]', { timeout: 10000 }).catch(() => {})
      const html = await page.content()
      const ids = [...html.matchAll(/data-ref-goodsno="(A\d+)"/gi)].map((m) => m[1])
      const goodsCount = ids.length
      const distinctIds = new Set(ids).size

      console.log(`  HTTP ${status} | size=${html.length} | goodsNo refs=${goodsCount} | distinct=${distinctIds}`)

      const outPath = path.join(RAW_DIR, `oy-${target.name}.html`)
      await fs.writeFile(outPath, html, 'utf-8')
      console.log(`  저장: ${outPath}`)

      // 1초 대기 (responsible scraping)
      await page.waitForTimeout(1500)
    } catch (e) {
      console.error(`  ❌ ${e.message}`)
    }
  }

  await browser.close()
  console.log('\n✅ 완료')
}

main().catch((e) => {
  console.error('💥 실패:', e)
  process.exit(1)
})
