import { getCollection } from "./db-service"

const PREFIX = "SARAECOM-"
const COUNTER_NAME = "order_number"
const START_NUMBER = 100001 // First order = SARAECOM-00100001

export async function generateOrderId(): Promise<string> {
  const counters = await getCollection("counters")

  const result = await counters.findOneAndUpdate(
    { _id: COUNTER_NAME } as any,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  )

  const seq = result?.seq ?? START_NUMBER
  return `${PREFIX}${String(seq).padStart(8, "0")}`
}

export function formatOrderIdDisplay(orderId: string): string {
  return orderId
}

export function isSaraOrderId(id: string): boolean {
  return id.startsWith(PREFIX)
}
