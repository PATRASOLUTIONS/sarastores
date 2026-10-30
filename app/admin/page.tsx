import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { staffLandingPage } from "@/lib/admin-access"

export default async function AdminPage() {
  const session = await getSession()
  redirect(session?.user ? staffLandingPage(session.user) : "/login?redirect=/admin")
}
