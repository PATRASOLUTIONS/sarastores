import type { Metadata } from "next"
import LuckyDrawScreen from "./LuckyDrawScreen"

export const dynamic = "force-dynamic"

// The token is a shareable secret, so keep the screen out of search results.
export const metadata: Metadata = {
  title: "Lucky Draw",
  robots: { index: false, follow: false },
}

export default async function LuckyDrawDrawPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <LuckyDrawScreen token={token} />
}
