/**
 * Top navigation. Server Component.
 * Mirrors `.nav` from Clickyy App.html.
 */
import Link from 'next/link'

export function Header() {
  return (
    <nav className="sticky top-0 z-20 h-16 bg-card border-b border-line flex items-center px-10 gap-10">
      <Link href="/" className="flex items-baseline gap-[10px] text-[20px] font-bold tracking-[-0.02em]">
        <span className="w-2 h-2 rounded-full bg-primary -translate-y-[2px]" />
        클리키
        <span className="ml-1 text-[10px] font-bold tracking-[0.1em] text-ink-4 uppercase">
          beauty analytics
        </span>
      </Link>

      <div className="flex gap-1 ml-2">
        <Link
          href="/"
          className="px-[14px] py-2 rounded-lg text-sm font-semibold bg-surface text-primary"
        >
          트렌딩
        </Link>
        <span className="px-[14px] py-2 rounded-lg text-sm font-medium text-ink-2 hover:text-primary cursor-pointer">
          제품
        </span>
        <span className="px-[14px] py-2 rounded-lg text-sm font-medium text-ink-2 hover:text-primary cursor-pointer">
          키워드
        </span>
        <span className="px-[14px] py-2 rounded-lg text-sm font-medium text-ink-2 hover:text-primary cursor-pointer">
          크리에이터
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-[10px] bg-surface border border-line h-[38px] px-[14px] rounded-full text-sm text-ink-3 w-[320px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-[15px] h-[15px] opacity-60 flex-shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            placeholder="제품, 브랜드, 크리에이터 검색"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-ink placeholder:text-ink-4"
          />
          <span className="text-[11px] font-semibold text-ink-4 bg-card px-[7px] py-[3px] rounded-[5px] border border-line flex-shrink-0">
            ⌘K
          </span>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary text-surface grid place-items-center text-[13px] font-bold flex-shrink-0">
          미
        </div>
      </div>
    </nav>
  )
}
