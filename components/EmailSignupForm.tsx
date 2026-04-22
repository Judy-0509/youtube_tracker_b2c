'use client'

import { useState, type FormEvent } from 'react'

export function EmailSignupForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    // TODO: Phase 2에서 beta_signups 테이블에 INSERT
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mb-4 text-center">
        <div className="bg-primary-subtle text-primary border border-primary-soft rounded-lg px-4 py-3 text-sm font-medium">
          ✨ 신청 완료 — 베타 오픈 시 가장 먼저 알려드릴게요
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto mb-4">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일 주소"
        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft transition"
      />
      <button
        type="submit"
        className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-lg font-semibold transition shadow-sm"
      >
        얼리 액세스 신청
      </button>
    </form>
  )
}
