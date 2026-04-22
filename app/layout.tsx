import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '클리키 (Clickyy) — 뷰티 트렌드 디스커버리',
  description: '뷰티 크리에이터를 위한 매일 업데이트 되는 트렌드 인사이트. 지금 가장 핫한 제품·검색어·신상 리뷰를 한 곳에서.',
  keywords: ['뷰티 트렌드', '뷰티 크리에이터', '올리브영', '신상 화장품', '유튜브 뷰티'],
  openGraph: {
    title: '클리키 — 뷰티 트렌드 디스커버리',
    description: '다음 영상 소재, 매일 발견하세요.',
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="bg-surface text-ink antialiased">{children}</body>
    </html>
  )
}
