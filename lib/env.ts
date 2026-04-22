/**
 * 클라이언트-안전 환경변수 (NEXT_PUBLIC_* 만).
 * 클라이언트 컴포넌트와 서버 모두에서 import 가능.
 *
 * 서버-전용 시크릿 (SUPABASE_SERVICE_ROLE_KEY 등)은 lib/env-server.ts 참고.
 */
import { z } from 'zod'

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})

if (!parsed.success) {
  console.error('❌ 환경변수 검증 실패 (client):', parsed.error.flatten().fieldErrors)
  throw new Error('환경변수 누락. .env.local 확인 — .env.local.example 참고.')
}

export const env = parsed.data
export type Env = z.infer<typeof clientSchema>
