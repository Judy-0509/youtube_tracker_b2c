/**
 * 관리자용 Supabase 클라이언트 (service_role key).
 * 스크립트 / cron / 백엔드 admin 작업 전용.
 * RLS 우회 — 절대 클라이언트 노출 금지.
 */
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { serverEnv } from '@/lib/env-server'
import type { Database } from '@/lib/db/types'

export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
