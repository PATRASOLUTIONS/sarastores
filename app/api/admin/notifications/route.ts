import { NextResponse } from "next/server"
import { getSession, requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"

export const dynamic = "force-dynamic"

type NotificationItem = {
  id: string
  label: string
  description: string
  count: number
  href: string
  tone: "amber" | "blue" | "red"
}

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const isFullAdmin = session.user.role === "admin" || session.user.role === "superadmin"
    const allowedPages = new Set(session.user.allowedPages || [])
    const canView = (href: string) => isFullAdmin || allowedPages.has(href)

    const [orders, complaints, inquiries, campaigns] = await Promise.all([
      getCollection("orders"),
      getCollection("complaints"),
      getCollection("contact_inquiries"),
      getCollection("campaign_history"),
    ])

    const [pendingOrders, openComplaints, newInquiries, failedCampaigns] = await Promise.all([
      canView("/admin/orders")
        ? orders.countDocuments({ status: { $in: ["pending", "processing"] } })
        : Promise.resolve(0),
      canView("/admin/complaints")
        ? complaints.countDocuments({ status: { $in: ["pending", "processing", "refund_initiated"] } })
        : Promise.resolve(0),
      canView("/admin/contact-inquiries")
        ? inquiries.countDocuments({ status: { $in: ["new", "contacted"] } })
        : Promise.resolve(0),
      canView("/admin/customer-centric")
        ? campaigns.countDocuments({ failed: { $gt: 0 }, sentAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
        : Promise.resolve(0),
    ])

    const candidates: NotificationItem[] = [
      {
        id: "orders",
        label: "Orders need attention",
        description: "Pending or currently processing",
        count: pendingOrders,
        href: "/admin/orders",
        tone: "amber",
      },
      {
        id: "complaints",
        label: "Open complaints",
        description: "Customer cases awaiting resolution",
        count: openComplaints,
        href: "/admin/complaints",
        tone: "red",
      },
      {
        id: "inquiries",
        label: "Contact inquiries",
        description: "New or contacted leads to follow up",
        count: newInquiries,
        href: "/admin/contact-inquiries",
        tone: "blue",
      },
      {
        id: "campaigns",
        label: "Campaigns with failures",
        description: "Review recent email delivery results",
        count: failedCampaigns,
        href: "/admin/customer-centric",
        tone: "red",
      },
    ]

    const items = candidates.filter((item) => canView(item.href) && item.count > 0)
    return NextResponse.json({ items, total: items.reduce((sum, item) => sum + item.count, 0) })
  } catch (error) {
    console.error("Failed to build admin notifications", error)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }
}
