import { pageMetadata } from "@/lib/seo-page"
import LuckyDrawScreen from "./LuckyDrawScreen"

export const dynamic = "force-dynamic"

// The token is a shareable secret, so keep the screen out of search results.
export const generateMetadata = pageMetadata({
  path: "/lucky-draw", title: brand => `Private Lucky Draw | ${brand}`,
  description: "Open your private SARA lucky-draw link. Draw tokens and participant details are not included in search or sharing previews.",
  noIndex: true,
})

export default async function LuckyDrawDrawPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <LuckyDrawScreen token={token} />
}
