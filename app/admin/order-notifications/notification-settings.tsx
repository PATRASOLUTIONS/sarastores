"use client"

import Link from "next/link"
import OrderNotificationEmails from "@/components/admin/OrderNotificationEmails"

export default function NotificationSettings() {
  return <div className="mx-auto max-w-2xl space-y-6">
    <Link href="/admin/orders" className="text-primary underline">Admin / Orders</Link>
    <h1 className="text-2xl font-bold">Order notifications</h1>
    <p className="text-gray-600">Send an additional email when an order is confirmed by a verified payment or an administrator. Customer emails continue; staff copies respect store permissions.</p>
    <div className="rounded-xl border bg-white p-6">
      <OrderNotificationEmails />
    </div>
  </div>
}
