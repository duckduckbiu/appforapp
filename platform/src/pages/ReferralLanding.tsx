import { useEffect } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

const REFERRAL_TTL_DAYS = 30

/**
 * /r/:code — Referral landing page (no MainLayout)
 *
 * Stores the referral code in localStorage then redirects the user to the
 * appropriate destination:
 *   /r/ABC123            → /store
 *   /r/ABC123?app=slug   → /app/slug
 *   /r/ABC123?channel=id → /channel/id
 */
const ReferralLanding = () => {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (code) {
      localStorage.setItem(
        "billai_referral",
        JSON.stringify({ code, ts: Date.now() })
      )
    }

    // Determine redirect target
    const appSlug = searchParams.get("app")
    const channelId = searchParams.get("channel")

    if (appSlug) {
      navigate(`/app/${appSlug}`, { replace: true })
    } else if (channelId) {
      navigate(`/channel/${channelId}`, { replace: true })
    } else {
      navigate("/store", { replace: true })
    }
  }, [code, searchParams, navigate])

  return null
}

export { REFERRAL_TTL_DAYS }
export default ReferralLanding
