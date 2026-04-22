import { EmailSignupForm } from '@/components/EmailSignupForm'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </div>
            <span className="font-bold text-xl">클리키</span>
          </div>
          <div className="text-xs text-gray-500 tracking-wider">COMING SOON ✨</div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary-subtle text-primary px-3 py-1 rounded-full text-xs font-semibold mb-8">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          출시 준비 중 · 4월 마지막 주 베타 오픈 예정
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
          다음 영상 소재,<br />
          <span className="text-primary">매일 발견하세요.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-12 leading-relaxed">
          뷰티 크리에이터를 위한 트렌드 디스커버리.<br />
          오늘 가장 핫한 제품·검색어·신상 리뷰를 한 곳에서.
        </p>

        {/* Email signup */}
        <EmailSignupForm />
        <p className="text-xs text-gray-400">베타 오픈 시 가장 먼저 알려드릴게요</p>
      </section>

      {/* Feature Preview Cards */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <p className="text-sm text-gray-400 text-center mb-8 tracking-wide">
          ─── 곧 보게 될 화면 미리보기 ───
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: 트렌딩 제품 */}
          <article className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="h-40 bg-gradient-to-br from-primary-subtle to-primary-soft relative">
              <div className="absolute top-3 left-3 bg-primary text-white text-xs font-bold px-2 py-1 rounded">
                #1
              </div>
              <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur text-primary text-xs font-bold px-2 py-1 rounded num">
                +312%
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-gray-500 mb-1">메디큐브</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-3">제로 모공 패드 2.0</h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">11.2K 언급</span>
                <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded font-medium">🔥 확정 트렌딩</span>
              </div>
            </div>
          </article>

          {/* Card 2: 검색어 트렌드 */}
          <article className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-400 tracking-wider mb-3">검색 급상승</div>
            <ul className="space-y-3">
              <li className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">톤업크림 추천</span>
                <span className="text-xs font-bold text-primary num">+89%</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">여드름 패치 비교</span>
                <span className="text-xs font-bold text-primary num">+76%</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">입술 각질 제거</span>
                <span className="text-xs font-bold text-primary num">+64%</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">다크서클 컨실러</span>
                <span className="text-xs font-bold text-primary num">+58%</span>
              </li>
            </ul>
          </article>

          {/* Card 3: 광고 vs 오가닉 */}
          <article className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-400 tracking-wider mb-3">광고 vs 진짜 인기</div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5 text-sm">
                  <span className="font-medium">🔥 확정 트렌딩</span>
                  <span className="text-gray-500">12 제품</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 text-sm">
                  <span className="font-medium">⚠️ 버즈만 있음</span>
                  <span className="text-gray-500">5 제품</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: '25%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 text-sm">
                  <span className="font-medium">🌱 신규 발굴</span>
                  <span className="text-gray-500">3 제품</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-300 rounded-full" style={{ width: '15%' }} />
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* What's coming */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-10">곧 만날 기능들</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="flex gap-3">
              <span className="text-primary text-lg">●</span>
              <div>
                <div className="font-semibold text-gray-900 mb-1">매일 자동 트렌드 분석</div>
                <div className="text-gray-600">올리브영 + 유튜브 + 네이버 검색량을 종합한 실시간 점수</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-primary text-lg">●</span>
              <div>
                <div className="font-semibold text-gray-900 mb-1">광고 vs 오가닉 라벨링</div>
                <div className="text-gray-600">유튜버가 돈 받고 띄운 건지, 진짜 인기인지 명확하게</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-primary text-lg">●</span>
              <div>
                <div className="font-semibold text-gray-900 mb-1">신상 리뷰 피드</div>
                <div className="text-gray-600">300+ 한국 뷰티 채널 신규 영상을 한 곳에 모아서</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-primary text-lg">●</span>
              <div>
                <div className="font-semibold text-gray-900 mb-1">트렌드 알림 (Pro)</div>
                <div className="text-gray-600">관심 카테고리 새 트렌드 뜨면 이메일로</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center text-sm text-gray-400">
        <div className="mb-2">© 2026 Clickyy</div>
        <div className="text-xs">뷰티 크리에이터를 위한 트렌드 인텔리전스</div>
      </footer>
    </main>
  )
}
