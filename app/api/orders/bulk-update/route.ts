import { NextRequest, NextResponse } from "next/server"
import { getCollection, createObjectId, normalizeId } from "@/lib/db-service"
import { getEmailTemplate, getEmailSubject, getEmailTemplateId } from "@/lib/emailTemplates"
import { sendEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/auth"

type BulkRow = {
  orderId: string
  status: string
  trackingNumber?: string
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { rows } = await request.json()

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Invalid rows data" }, { status: 400 })
    }

    const collection = await getCollection("orders")
    const success: BulkRow[] = []
    const failed: { row: BulkRow; error: string }[] = []

    for (const row of rows) {
      try {
        const { orderId, status, trackingNumber } = row

        if (!orderId || !status) {
          failed.push({ row, error: "Missing orderId or status" })
          continue
        }

        // Validate status
        const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
        if (!validStatuses.includes(status.toLowerCase())) {
          failed.push({ row, error: `Invalid status: ${status}` })
          continue
        }

        let objectId
        try {
          objectId = createObjectId(orderId)
        } catch {
          failed.push({ row, error: "Invalid order ID format" })
          continue
        }

        // Check if order exists
        const existingOrder = await collection.findOne({ _id: objectId })
        if (!existingOrder) {
          failed.push({ row, error: "Order not found" })
          continue
        }

        // Prepare update data
        const updateData: any = {
          status: status.toLowerCase(),
          updatedAt: new Date(),
        }

        // Add tracking number if provided and status is shipped
        if (trackingNumber && status.toLowerCase() === "shipped") {
          updateData.trackingNumber = trackingNumber.trim()
        }

        // Update timeline
        const existingTimeline = existingOrder.timeline || []
        const statusDescriptions: Record<string, string> = {
          pending: "Your order is being processed",
          confirmed: "Your order has been confirmed",
          processing: "Your order is being prepared",
          shipped: "Your order has been shipped",
          delivered: "Your order has been delivered",
          cancelled: "Your order has been cancelled",
        }

        existingTimeline.unshift({
          date: new Date().toISOString(),
          status: status.charAt(0).toUpperCase() + status.slice(1),
          description: statusDescriptions[status.toLowerCase()] || "Order status updated",
        })

        updateData.timeline = existingTimeline

        // Update the order
        await collection.updateOne({ _id: objectId }, { $set: updateData })

        // Get updated order for email
        const updatedOrder = await collection.findOne({ _id: objectId })
        const normalizedOrder = normalizeId(updatedOrder)

        // Send email notification
        if (normalizedOrder.customer?.email) {
          try {
            const emailTemplateId = getEmailTemplateId(status.toLowerCase())
            
            const emailData = {
              orderNumber: normalizedOrder.id,
              customerName: normalizedOrder.customer.name,
              status: status.toLowerCase(),
              trackingNumber,
              orderDetails: {
                total: normalizedOrder.total,
                items: normalizedOrder.items,
                shippingAddress: normalizedOrder.customer.address,
              },
            }
            const emailResult = await sendEmail({
              to: normalizedOrder.customer.email,
              subject: getEmailSubject(emailTemplateId, normalizedOrder.id),
              html: getEmailTemplate(emailTemplateId, emailData),
            })
            if (!emailResult.success) throw new Error("Email provider rejected the notification")
          } catch (emailError) {
            console.error(`Failed to send email for order ${orderId}:`, emailError)
            // Don't fail the update if email fails
          }
        }

        success.push(row)
      } catch (error) {
        console.error(`Error processing row:`, error)
        failed.push({ row, error: error instanceof Error ? error.message : "Unknown error" })
      }
    }

    return NextResponse.json({
      success,
      failed,
      message: `Processed ${success.length} orders successfully, ${failed.length} failed`,
    })
  } catch (error) {
    console.error("Bulk update error:", error)
    return NextResponse.json({ error: "Failed to process bulk update" }, { status: 500 })
  }
}
