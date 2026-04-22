import fs from 'node:fs'

const file = process.argv[2] || './data/raw-recon/oy-all.html'
const html = fs.readFileSync(file, 'utf-8')

console.log(`File: ${file}`)
console.log(`Size: ${html.length} bytes`)
console.log(`Title: ${html.match(/<title>([^<]+)/)?.[1]}`)
console.log()

// Top 30 class names
const classes = {}
const re = /<[a-z]+\s+class="([^"]+)"/g
let m
while ((m = re.exec(html))) {
  for (const c of m[1].split(/\s+/)) classes[c] = (classes[c] || 0) + 1
}
console.log('Top 30 classes:')
Object.entries(classes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([c, n]) => console.log(`  ${String(n).padStart(4)} .${c}`))

console.log()
console.log('Keyword counts:')
const keywords = ['prd_info', 'tx_brand', 'tx_name', 'goodsNo', 'data-ref-goodsNo', '베스트', '랭킹', '상품', 'window.__', 'useState', 'NUXT', '__NEXT', 'react', 'Vue', '<script', '<noscript']
for (const kw of keywords) {
  const cnt = html.split(kw).length - 1
  if (cnt > 0) console.log(`  ${String(cnt).padStart(4)} ${kw}`)
}

console.log()
console.log('--- 페이지 본문 영역 (body 시작 200자) ---')
const bodyStart = html.indexOf('<body')
console.log(html.substring(bodyStart, bodyStart + 1500))
