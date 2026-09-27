import { NextResponse } from "next/server"
import crypto from "crypto"
import { connectDB } from "@/lib/db"
import { ObjectId } from "mongodb"
import { getRazorpayClient } from "@/lib/razorpay"
import { getSession } from "@/lib/auth"
import { getPartnerById } from '@/lib/partner/service'
import { decrypt } from '@/lib/encryption'
import { findAvailableLicense, assignLicense } from "@/lib/license-service"
import { sendEmail } from "@/lib/email"
import { emailTemplates } from "@/lib/emailTemplates"
import { generateOrderId } from "@/lib/order-id"

export async function POST(request: Request) {
  // Guests can check out, so no session is required here. The Razorpay
  // signature below is what authenticates the operation.
  const session = await getSession()
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails, notes, partnerId, environment } = await request.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment verification data" }, { status: 400 })
    }

    // Ownership comes from the session only. A client-supplied userId would let
    // one account attribute its payments to another.
    const sessionUserId = session?.user?.id
    const safeUserId =
      typeof sessionUserId === "string" && ObjectId.isValid(sessionUserId) ? sessionUserId : null

    // Verify the payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id

    // Determine secret to verify signature: partner-specific (if provided) or global env
    let secretToUse = process.env.RAZORPAY_KEY_SECRET || ''
    let client: any = null
    if (partnerId && environment) {
      const partner = await getPartnerById(partnerId)
      if (partner && (partner as any).razorpayIntegration && (partner as any).razorpayIntegration.credentials) {
        const creds = (partner as any).razorpayIntegration.credentials[environment]
        if (creds && creds.keySecretEnc && creds.keySecretIv && creds.keySecretTag) {
          const secret = decrypt(creds.keySecretEnc, creds.keySecretIv, creds.keySecretTag)
          if (secret) {
            secretToUse = secret
            try {
              client = getRazorpayClient({ keyId: creds.keyId, keySecret: secret })
            } catch (e) {
              client = null
            }
          }
        }
      }
    }

    const expectedSignature = crypto
      .createHmac("sha256", secretToUse)
      .update(body.toString())
      .digest("hex")

    const isAuthentic = expectedSignature === razorpay_signature

    if (isAuthentic) {
      // Authoritative amount comes from Razorpay (what was actually charged),
      // not from the client payload — prevents price/amount tampering.
      let verifiedAmount: number | undefined = undefined
      try {
        const rp = client || getRazorpayClient()
        const order = await rp.orders.fetch(razorpay_order_id)
        if (order && typeof order.amount !== "undefined") {
          verifiedAmount = Number(order.amount) / 100 // paise -> rupees
        }
        if (process.env.NODE_ENV === "development") {
          const payment = await rp.payments.fetch(razorpay_payment_id)
          console.log("Payment verified:", payment.id)
        }
      } catch (fetchError: any) {
        console.error("Failed to fetch Razorpay order amount:", fetchError?.message || fetchError)
      }

      // Fall back to the client amount only if Razorpay lookup failed.
      const recordedAmount = typeof verifiedAmount === "number" ? verifiedAmount : orderDetails?.amount
      if (
        typeof verifiedAmount === "number" &&
        typeof orderDetails?.amount === "number" &&
        Math.abs(verifiedAmount - orderDetails.amount) > 1
      ) {
        console.warn(
          `Order amount mismatch: client=${orderDetails.amount} razorpay=${verifiedAmount} (order ${razorpay_order_id})`,
        )
        return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 })
      }

      const db = await connectDB()
      const paymentsCollection = db.collection("payments")
      const ordersCollection = db.collection("orders")

      await paymentsCollection.insertOne({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "completed",
        method: "razorpay",
        amount: recordedAmount,
        userId: safeUserId ? new ObjectId(safeUserId) : null,
        createdAt: new Date(),
      })

      let insertedOrderId: ObjectId | null = null

      if (orderDetails) {
        const orderId = await generateOrderId()
        const result = await ordersCollection.insertOne({
          orderId,
          userId: safeUserId ? new ObjectId(safeUserId) : null,
          items: orderDetails.items || [],
          totalAmount: recordedAmount,
          paymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          status: "paid",
          shippingAddress: orderDetails.shippingAddress || null,
          customer: orderDetails.customer || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        insertedOrderId = result.insertedId

        // Handle software license assignment for paid orders
        const softwareItems = (orderDetails.items || []).filter((item: any) => item.type === 'software')

        if (softwareItems.length > 0 && insertedOrderId) {
          console.log(`🔑 Processing license assignment for ${softwareItems.length} software item(s)`)

          for (const softwareItem of softwareItems) {
            try {
              // Find available license
              const availableLicense = await findAvailableLicense(softwareItem.id || softwareItem.softwareId)

              if (!availableLicense) {
                console.error(`⚠️ No available license found for software: ${softwareItem.name}`)

                // Send alert to admin
                try {
                  const { sendNoLicenseAlert } = await import('@/lib/admin-alerts')
                  const customerEmail = orderDetails.customer?.email || orderDetails.email
                  await sendNoLicenseAlert(
                    softwareItem.id || softwareItem.softwareId,
                    softwareItem.name,
                    insertedOrderId.toString(),
                    customerEmail
                  )
                } catch (alertError) {
                  console.error('Failed to send admin alert:', alertError)
                }

                continue
              }

              // Assign the license
              const assignedLicense = await assignLicense(
                availableLicense._id!.toString(),
                {
                  email: orderDetails.customer?.email || orderDetails.email,
                  orderId: insertedOrderId.toString()
                }
              )

              if (assignedLicense) {
                // Update order with license key information
                await ordersCollection.updateOne(
                  { _id: insertedOrderId },
                  {
                    $set: {
                      licenseKey: assignedLicense.key,
                      licenseAssignedAt: new Date(),
                      updatedAt: new Date()
                    }
                  }
                )

                console.log(`✅ License assigned: ${assignedLicense.key} for order ${insertedOrderId}`)

                // Send email with activation key
                try {
                  const customerEmail = orderDetails.customer?.email || orderDetails.email
                  const customerName = orderDetails.customer?.name || orderDetails.customer?.firstName || 'Customer'

                  if (customerEmail) {
                    const emailData = {
                      customerName: customerName,
                      orderNumber: insertedOrderId.toString(),
                      softwareName: softwareItem.name,
                      licenseKey: assignedLicense.key,
                      validity: softwareItem.validity?.toString() || softwareItem.validityYears?.toString() || '365',
                      maxDevice: softwareItem.maxDevice || softwareItem.maxDevices || 1,
                      companyName: 'Sara Mobiles and Electronics '
                    }

                    await sendEmail({
                      to: customerEmail,
                      subject: emailTemplates.SOFTWARE_ACTIVATION_KEY.subject
                        .replace('#{softwareName}', softwareItem.name)
                        .replace('#{orderNumber}', insertedOrderId.toString()),
                      html: emailTemplates.SOFTWARE_ACTIVATION_KEY.html(emailData)
                    })

                    console.log(`📧 Activation key email sent to ${customerEmail}`)
                  }
                } catch (emailError) {
                  console.error('❌ Failed to send activation key email:', emailError)
                  // Don't fail the order if email fails
                }
              }
            } catch (licenseError) {
              console.error(`❌ Error processing license for ${softwareItem.name}:`, licenseError)
              // Continue with other items even if one fails
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Payment verified successfully",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      })
    } else {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error verifying payment:", error)
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
  }
}
