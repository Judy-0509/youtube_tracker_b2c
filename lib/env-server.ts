/**
 * 서버-전용 환경변수 (시크릿).
 * 'server-only' import로 클라이언트 번들에 포함 시 빌드 실패.
 */
import 'server-only'
import { z } from 'zod'

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ACCESS_TOKEN: z.string().optional(),
  YOUTUBE_API_KEY: z.string().min(1),
  NAVER_CLIENT_ID: z.string().min(1),
  NAVER_CLIENT_SECRET: z.string().min(1),
})

const parsed = serverSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ 환경변수 검증 실패 (server):', parsed.error.flatten().fieldErrors)
  throw new Error('서버 환경변수 누락. .env.local 확인.')
}

export const serverEnv = parsed.data
export type ServerEnv = z.infer<typeof serverSchema>
