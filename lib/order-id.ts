import { getCollection } from "./db-service"

const PREFIX = "SARAECOM-"
const COUNTER_NAME = "order_number"
const START_NUMBER = 100001 // First order = SARAECOM-00100001

interface OrderCounter {
  _id: string
  seq: number
}

export async function generateOrderId(): Promise<string> {
  const counters = await getCollection<OrderCounter>("counters")

  const result = await counters.findOneAndUpdate(
    { _id: COUNTER_NAME },
    [{ $set: { seq: { $add: [{ $ifNull: ["$seq", START_NUMBER - 1] }, 1] } } }],
    { upsert: true, returnDocument: "after" }
  )

  const seq = result?.seq
  if (!Number.isSafeInteger(seq) || seq === undefined || seq < 1) {
    throw new Error("Order counter did not return a valid sequence")
  }
  return `${PREFIX}${String(seq).padStart(8, "0")}`
}

export function formatOrderIdDisplay(orderId: string): string {
  return orderId
}

export function isSaraOrderId(id: string): boolean {
  return id.startsWith(PREFIX)
}
