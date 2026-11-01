import { redirect } from "next/navigation"
import { requireFullAdmin } from "@/lib/auth"
import { pageMetadata } from "@/lib/seo-page"
import DatabaseCloneClient from "./database-clone-client"

export const generateMetadata = pageMetadata({ path: "/admin/database-clone", title: "Manual Database Clone", description: "Private manual database clone preview and verification.", noIndex: true })
export default async function DatabaseClonePage() {
  const guard = await requireFullAdmin()
  if (!guard.ok) redirect("/admin/dashboard")
  return <DatabaseCloneClient />
}
