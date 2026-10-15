import { ObjectId } from "mongodb"
import { connectToDatabase } from "@/lib/mongodb"
import type { PricedItem } from "@/lib/order-pricing"
import { sendEmail } from "@/lib/email"
import { emailTemplates } from "@/lib/emailTemplates"

export class SoftwareFulfillmentError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

interface SoftwareOrder {
  _id: ObjectId
  orderId: string
  items: Array<PricedItem & { softwareId?: string }>
  customer?: { email?: string; name?: string }
  paymentVerification?: { verified?: boolean }
  licenseFulfillment?: { status: string; updatedAt: Date }
  licenseKey?: string | null
  licenseKeys?: string[]
}

export async function fulfillSoftwareOrder(id: string, scope: Record<string, unknown> = {}) {
  const { db, client } = await connectToDatabase()
  const orders = db.collection<SoftwareOrder>("orders")
  const session = client.startSession()
  const keys: Array<{ key: string; item: PricedItem }> = []
  let order: SoftwareOrder | null = null
  try {
    await session.withTransaction(async () => {
      keys.length = 0
      order = await orders.findOneAndUpdate({
        ...scope,
        ...(ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { orderId: id }),
        "paymentVerification.verified": true,
        status: { $nin: ["cancelled", "refunded", "returned"] },
        licenseKey: { $in: [null, ""] },
        "licenseKeys.0": { $exists: false },
        $or: [
          { licenseFulfillment: { $exists: false } },
          { "licenseFulfillment.status": { $in: ["needs_inventory", "failed"] } },
        ],
      }, { $set: { licenseFulfillment: { status: "processing", updatedAt: new Date() } } }, {
        session, returnDocument: "after",
      })
      if (!order) throw new SoftwareFulfillmentError("Order is unpaid, missing or already fulfilled", 409)
      if (!order.customer?.email) throw new SoftwareFulfillmentError("Customer email is required for software fulfillment", 409)
      const items = order.items.filter((item) => item.type === "software" && !item.provider)
      if (!items.length) throw new SoftwareFulfillmentError("Order contains no locally fulfilled software", 400)
      if (items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
          typeof (item.id || item.softwareId) !== "string" || !(item.id || item.softwareId)?.trim())) {
        throw new SoftwareFulfillmentError("Stored software identity or quantity requires administrator reconciliation", 409)
      }
      if (items.reduce((sum, item) => sum + item.quantity, 0) > 1000) {
        throw new SoftwareFulfillmentError("Software quantity requires administrator reconciliation", 409)
      }
      for (const item of items) {
        const softwareId = item.id || item.softwareId
        if (!softwareId) throw new SoftwareFulfillmentError("Stored software identity is missing", 409)
        const softwareIds = ObjectId.isValid(softwareId) ? [softwareId, new ObjectId(softwareId)] : [softwareId]
        for (let unit = 0; unit < item.quantity; unit++) {
          let license: { key: string } | null = null
          for (const collectionName of ["license_keys", "software_licenses"]) {
            const collection = db.collection<{ key: string; [field: string]: unknown }>(collectionName)
            license = await collection.findOneAndUpdate({
              softwareId: { $in: softwareIds },
              assigned: { $ne: true },
              status: { $nin: ["assigned", "revoked"] },
              email: { $in: [null, ""] },
              ...(collectionName === "license_keys" && item.validityYears ? { validityYears: Number(item.validityYears) } : {}),
              ...(collectionName === "license_keys" && item.maxDevices ? { maxDevices: { $gte: Number(item.maxDevices) } } : {}),
            }, {
              $set: {
                assigned: true, status: "assigned", email: order.customer.email, orderId: order._id,
                assignedAt: new Date(), updatedAt: new Date(),
              },
            }, { session, returnDocument: "after" })
            if (license) break
          }
          if (!license?.key) throw new SoftwareFulfillmentError("Insufficient matching license inventory; no licenses were assigned", 409)
          keys.push({ key: license.key, item })
        }
      }
      await orders.updateOne({ _id: order._id }, {
        $set: {
          licenseKey: keys[0].key, licenseKeys: keys.map((entry) => entry.key),
          licenseAssignedAt: new Date(), licenseFulfillment: { status: "assigned", updatedAt: new Date() },
          updatedAt: new Date(),
          ...(items.length === order.items.length ? { status: "delivered" } : {}),
        },
      }, { session })
    })
  } finally {
    await session.endSession()
  }
  // Delivery failures do not roll back assigned inventory or invite a second assignment.
  const fulfilled = await orders.findOne({ ...scope, ...(ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { orderId: id }) })
  if (!fulfilled?.customer?.email) throw new SoftwareFulfillmentError("Assigned order could not be loaded", 500)
  const results: Array<{ sent: boolean }> = []
  for (const { key, item } of keys) {
    const result = await sendEmail({
      to: fulfilled.customer.email,
      subject: emailTemplates.SOFTWARE_ACTIVATION_KEY.subject
        .replace("#{softwareName}", item.name).replace("#{orderNumber}", fulfilled.orderId),
      html: emailTemplates.SOFTWARE_ACTIVATION_KEY.html({
        customerName: fulfilled.customer.name || "Customer", orderNumber: fulfilled.orderId,
        softwareName: item.name, licenseKey: key, validity: item.validity || item.validityYears || "",
        maxDevice: Number(item.maxDevices || 1), companyName: "Sara Mobiles and Electronics",
      }),
    })
    results.push({ sent: result.success })
    if (!result.success) console.error("[software-fulfillment] Activation email failed; assigned keys remain available on the order")
  }
  return { licenseKeys: keys.map((entry) => entry.key), results }
}
