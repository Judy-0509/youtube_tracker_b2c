#!/usr/bin/env node
/**
 * 발굴 후보 제품 컨텍스트 조회.
 * 실행: node --env-file=.env.local scripts/lookup-discovery.mjs
 *
 * - 네이버 블로그/뉴스: 검색 급등 이유 파악
 * - YouTube search.list: 상위 노출 영상
 */

const env = {
  naverClientId: process.env.NAVER_CLIENT_ID,
  naverClientSecret: process.env.NAVER_CLIENT_SECRET,
  youtubeKey: process.env.YOUTUBE_API_KEY,
}

const PRODUCTS = [
  { name: '메디힐 랩핑 세럼 마스크', rank: 11 },
  { name: '무지개맨션 오브제 스테인 틴트', rank: 18 },
  { name: '마녀공장 퓨어 소이빈 클렌징오일', rank: 48 },
]

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function stripHtml(s) { return s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#[0-9]+;/g, '') }

// ── 네이버 검색 ───────────────────────────────────────────────
async function naverSearch(type, query, display = 5) {
  const url = new URL(`https://openapi.naver.com/v1/search/${type}.json`)
  url.searchParams.set('query', query)
  url.searchParams.set('display', display)
  url.searchParams.set('sort', 'date')
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': env.naverClientId,
      'X-Naver-Client-Secret': env.naverClientSecret,
    },
  })
  if (!res.ok) throw new Error(`Naver ${type} HTTP ${res.status}`)
  return res.json()
}

// ── YouTube 검색 ──────────────────────────────────────────────
async function youtubeSearch(query, maxResults = 5) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('key', env.youtubeKey)
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('regionCode', 'KR')
  url.searchParams.set('relevanceLanguage', 'ko')
  url.searchParams.set('order', 'relevance')
  url.searchParams.set('maxResults', maxResults)
  url.searchParams.set('part', 'snippet')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`YouTube search HTTP ${res.status}`)
  return res.json()
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  let ytQuota = 0

  for (const product of PRODUCTS) {
    console.log('\n' + '═'.repeat(60))
    console.log(`📦 ${product.name}  (올리브영 ${product.rank}위)`)
    console.log('═'.repeat(60))

    // 1) 네이버 블로그
    try {
      const blog = await naverSearch('blog', product.name, 5)
      console.log(`\n📝 네이버 블로그 최신 5개:`)
      ;(blog.items ?? []).forEach((item, i) => {
        const title = stripHtml(item.title)
        const date = item.postdate ? item.postdate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : ''
        console.log(`  ${i + 1}. [${date}] ${title}`)
        console.log(`     ${item.bloggerName} — ${item.link}`)
      })
      await sleep(150)
    } catch (e) {
      console.log(`  ⚠ 블로그 조회 실패: ${e.message}`)
    }

    // 2) 네이버 뉴스
    try {
      const news = await naverSearch('news', product.name, 3)
      console.log(`\n📰 네이버 뉴스 최신 3개:`)
      if ((news.items ?? []).length === 0) {
        console.log('  (관련 뉴스 없음)')
      } else {
        ;(news.items ?? []).forEach((item, i) => {
          const title = stripHtml(item.title)
          const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : ''
          console.log(`  ${i + 1}. [${date}] ${title}`)
        })
      }
      await sleep(150)
    } catch (e) {
      console.log(`  ⚠ 뉴스 조회 실패: ${e.message}`)
    }

    // 3) YouTube 상위 영상
    try {
      ytQuota += 100
      const yt = await youtubeSearch(product.name, 5)
      console.log(`\n▶  YouTube 상위 5개 영상:`)
      ;(yt.items ?? []).forEach((item, i) => {
        const title = item.snippet?.title ?? ''
        const channel = item.snippet?.channelTitle ?? ''
        const date = item.snippet?.publishedAt?.split('T')[0] ?? ''
        const videoId = item.id?.videoId ?? ''
        console.log(`  ${i + 1}. [${date}] ${title}`)
        console.log(`     채널: ${channel} — https://youtu.be/${videoId}`)
      })
      await sleep(300)
    } catch (e) {
      console.log(`  ⚠ YouTube 조회 실패: ${e.message}`)
    }
  }

  console.log(`\n📊 YouTube 할당량 소모: ${ytQuota} units`)
}

main().catch(e => { console.error('💥 실패:', e); process.exit(1) })
