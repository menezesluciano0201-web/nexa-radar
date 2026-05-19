// src/lib/supabase/client.ts
// Browser client — used in Client Components ('use client')
// Uses anon key. RLS is active — user sees only their own data.
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
