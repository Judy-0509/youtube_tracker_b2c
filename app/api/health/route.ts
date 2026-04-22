import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, unknown> = {
    env_loaded: true,
    supabase_url: env.NEXT_PUBLIC_SUPABASE_URL,
    timestamp: new Date().toISOString(),
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.getSession()
    checks.supabase_connected = !error
    if (error) checks.supabase_error = error.message
  } catch (e) {
    checks.supabase_connected = false
    checks.supabase_error = e instanceof Error ? e.message : String(e)
  }

  const ok = checks.supabase_connected === true
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', checks },
    { status: ok ? 200 : 503 },
  )
}
