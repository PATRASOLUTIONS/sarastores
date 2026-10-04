/**
 * Checkout with Razorpay's native SDK.
 *
 * The server endpoints are unchanged from the web flow — they only care about
 * the order id, the payment id and the signature, not how the payment UI was
 * presented. The client never sends prices: `create-order` re-derives the
 * amount from the catalogue, so anything the app computed is display-only.
 */

import { Platform } from "react-native"
import { api } from "@/api/client"
import type { CartItem } from "@/api/types"

/**
 * Loaded on demand: `react-native-razorpay` is a native module with no web
 * binding, so importing it at module scope breaks any bundle that includes
 * this file on an unsupported platform.
 */
async function loadRazorpay() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("Online payment is only available in the mobile app.")
  }
  const module = await import("react-native-razorpay")
  return module.default
}

interface CreateOrderResponse {
  orderId: string
  amount: number
  currency: string
  keyId: string
  notes?: Record<string, string>
}

export interface CheckoutCustomer {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
}

export interface PlaceOrderInput {
  items: CartItem[]
  customer: CheckoutCustomer
  couponCode?: string
  redeemPoints?: number
  paymentMethod: "online" | "cash"
}

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment was cancelled")
    this.name = "PaymentCancelledError"
  }
}

/** Only identifiers travel to the server; it prices the order itself. */
function toLineItems(items: CartItem[]) {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
  }))
}

export async function placeOrder(input: PlaceOrderInput): Promise<{ orderId: string }> {
  const lineItems = toLineItems(input.items)

  if (input.paymentMethod === "cash") {
    return api.post<{ orderId: string }>(
      "/api/orders",
      {
        items: lineItems,
        customer: input.customer,
        paymentMethod: "cash",
        coupon: input.couponCode ? { code: input.couponCode } : undefined,
        redeemPoints: input.redeemPoints,
      },
      { auth: true },
    )
  }

  const order = await api.post<CreateOrderResponse>(
    "/api/payment/create-order",
    {
      items: lineItems,
      couponCode: input.couponCode,
      redeemPoints: input.redeemPoints,
      currency: "INR",
    },
    { auth: true },
  )

  let payment: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
  try {
    const RazorpayCheckout = await loadRazorpay()
    payment = await RazorpayCheckout.open({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Sara Electronics",
      description: "Order payment",
      prefill: {
        email: input.customer.email,
        contact: input.customer.phone,
        name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
      },
      theme: { color: "#0F2557" },
    })
  } catch {
    // The SDK rejects on user dismissal as well as on failure; both mean no
    // order should be created.
    throw new PaymentCancelledError()
  }

  await api.post(
    "/api/payment/verify",
    {
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    },
    { auth: true },
  )

  return api.post<{ orderId: string }>(
    "/api/orders",
    {
      items: lineItems,
      customer: input.customer,
      paymentMethod: "online",
      paymentDetails: {
        // `/api/orders` reads `paymentId` — sending only the snake_case keys
        // makes it treat a paid order as having no payment reference and 400.
        paymentId: payment.razorpay_payment_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_signature: payment.razorpay_signature,
      },
      coupon: input.couponCode ? { code: input.couponCode } : undefined,
      redeemPoints: input.redeemPoints,
    },
    { auth: true },
  )
}
