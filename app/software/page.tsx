import { getPublicPageSoftware } from "@/lib/public-page-data"
import SoftwareClient from "./SoftwareClient"
export const dynamic = "force-dynamic"
export default async function SoftwarePage() {
  return <SoftwareClient initialProducts={await getPublicPageSoftware()} />
}
