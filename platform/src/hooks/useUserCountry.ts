import { useState, useEffect } from "react"
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client"

const CACHE_KEY_COUNTRY = "billai_country"
const CACHE_KEY_TS      = "billai_country_ts"
const CACHE_TTL_MS      = 24 * 60 * 60 * 1000  // 24 hours

interface UseUserCountryResult {
  country: string | null
  isLoading: boolean
}

export function useUserCountry(): UseUserCountryResult {
  const [country, setCountry] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      // 1. Check localStorage cache (valid for 24h)
      const cached   = localStorage.getItem(CACHE_KEY_COUNTRY)
      const cachedTs = Number(localStorage.getItem(CACHE_KEY_TS) ?? 0)

      if (cached && Date.now() - cachedTs < CACHE_TTL_MS) {
        if (!cancelled) {
          setCountry(cached)
          setIsLoading(false)
        }
        return
      }

      // 2. Fetch from ipapi.co (free, no auth required)
      try {
        const res = await fetch("https://ipapi.co/country/", { signal: AbortSignal.timeout(5000) })
        if (!res.ok) throw new Error("geo fetch failed")
        const code = (await res.text()).trim().toUpperCase()

        if (!cancelled && code.length === 2) {
          // Store in cache
          localStorage.setItem(CACHE_KEY_COUNTRY, code)
          localStorage.setItem(CACHE_KEY_TS, String(Date.now()))
          setCountry(code)

          // Persist to DB if logged in (best-effort)
          if (isSupabaseConfigured) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from("user_geo_cache")
                .upsert({ user_id: user.id, country: code, cached_at: new Date().toISOString() })
            }
          }
        }
      } catch {
        // Network failure — leave country as null (no restriction applied)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [])

  return { country, isLoading }
}
