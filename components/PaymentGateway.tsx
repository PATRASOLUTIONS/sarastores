"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { CreditCard, AlertCircle, Check, ArrowLeft, ArrowRight } from "lucide-react"
import type { IncomingItem } from "@/lib/order-pricing"
import { RazorpayOrderResponseSchema, RazorpayVerificationResponseSchema, type RazorpayCheckoutOptions } from "@/types/razorpay"

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => { open: () => void }
  }
}

export interface CheckoutPaymentDetails {
  method: string
  status: string
  paymentId?: string
  orderId?: string
  transactionId?: string
  checkoutToken?: string
  employeeId?: string
  verifiedEmail?: string
  approvalId?: string
  approvalToken?: string
}

interface PaymentOrderDetails {
  total?: number
  items?: Array<IncomingItem & { name?: string }>
  customer?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    zipCode?: string
    country?: string
  }
  coupon?: { code: string } | null
  redeemPoints?: number
  fulfilment?: { method: string; storeId?: string }
}

interface PaymentGatewayProps {
  paymentMethod: string
  amount: number
  onSuccess: (paymentDetails: CheckoutPaymentDetails) => void | Promise<void>
  onCancel: () => void
  orderDetails?: PaymentOrderDetails
  beforePayment?: () => Promise<boolean>
  compact?: boolean
  preferredMethod?: string
  onProcessingChange?: (processing: boolean) => void
}

export default function PaymentGateway({
  paymentMethod,
  amount,
  onSuccess,
  onCancel,
  orderDetails,
  beforePayment,
  compact = false,
  preferredMethod,
  onProcessingChange,
}: PaymentGatewayProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)
  const submitting = useRef(false)
  useEffect(() => { onProcessingChange?.(isProcessing) }, [isProcessing, onProcessingChange])

  useEffect(() => {
    if (paymentMethod === "cash-on-delivery") return
    // Load Razorpay script
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => setRazorpayLoaded(true)
    script.onerror = () => {
      console.error("Failed to load Razorpay script")
      setErrors({ form: "Failed to load payment gateway. Please refresh this page to try again." })
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [paymentMethod])

  const handleRazorpayPayment = async () => {
    if (!razorpayLoaded) {
      setErrors({ form: "Payment gateway is still loading. Please wait." })
      setIsProcessing(false)
      return
    }

    setIsProcessing(true)
    setErrors({})

    try {
      // Prepare comprehensive notes for Razorpay
      const itemNames = orderDetails?.items?.map((item) => item.name).join(", ") || ""
      const itemTypes = orderDetails?.items?.map((item) => item.type || "hardware").join(", ") || ""

      const razorpayNotes = {
        customer_name: orderDetails?.customer?.firstName + " " + orderDetails?.customer?.lastName || "",
        customer_email: orderDetails?.customer?.email || "",
        customer_phone: orderDetails?.customer?.phone || "",
        customer_address: orderDetails?.customer?.address || "",
        customer_city: orderDetails?.customer?.city || "",
        customer_state: orderDetails?.customer?.state || "",
        customer_zipcode: orderDetails?.customer?.pincode || orderDetails?.customer?.zipCode || "",
        customer_country: orderDetails?.customer?.country || "India",
        order_amount: amount.toString(),
        order_items_count: orderDetails?.items?.length?.toString() || "0",
        item_names: itemNames.substring(0, 255), // Razorpay has 255 char limit per field
        item_types: itemTypes,
        payment_method: "razorpay",
      }

      // Create order on backend. The server re-prices the cart and decides the amount.
      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: (orderDetails?.items || []).map((item) => ({
            id: item.id || item.productId,
            productId: item.productId,
            sku: item.sku,
            quantity: item.quantity,
            type: item.type,
            color: item.color,
            size: item.size,
          })),
          couponCode: orderDetails?.coupon?.code ?? null,
          redeemPoints: orderDetails?.redeemPoints ?? 0,
          fulfilment: orderDetails?.fulfilment,
          currency: "INR",
          receipt: `order_${Date.now()}`,
          notes: razorpayNotes,
        }),
      })

      if (!orderResponse.ok) {
        const failure = await orderResponse.json().catch(() => null)
        throw new Error(failure?.error || "Failed to create payment order")
      }

      const orderData = RazorpayOrderResponseSchema.parse(await orderResponse.json())
      const options: RazorpayCheckoutOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Sara Mobiles and Electronics ",
        description: "Purchase from Sara Mobiles and Electronics ",
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            // Verify payment on backend and update notes
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                checkoutToken: orderData.checkoutToken,
              }),
            })

            if (!verifyResponse.ok) {
              throw new Error("Payment verification failed")
            }

            const verifyData = RazorpayVerificationResponseSchema.parse(await verifyResponse.json())

            // Payment successful
            const paymentDetails = {
              method: "razorpay",
              paymentId: verifyData.paymentId,
              orderId: verifyData.orderId,
              transactionId: response.razorpay_payment_id,
              status: "completed",
              checkoutToken: orderData.checkoutToken,
            }

            await onSuccess(paymentDetails)
            setIsProcessing(false)
          } catch (error) {
            console.error("Payment verification error:", error)
            setErrors({ form: "Payment verification failed. Please contact support." })
            setIsProcessing(false)
          }
        },
        prefill: {
          name: orderDetails?.customer?.firstName + " " + orderDetails?.customer?.lastName || "",
          email: orderDetails?.customer?.email || "",
          contact: orderDetails?.customer?.phone || "",
        },
        notes: {
          customer_name: orderDetails?.customer?.firstName + " " + orderDetails?.customer?.lastName || "",
          customer_email: orderDetails?.customer?.email || "",
          customer_phone: orderDetails?.customer?.phone || "",
          customer_address: orderDetails?.customer?.address || "",
          customer_city: orderDetails?.customer?.city || "",
          customer_state: orderDetails?.customer?.state || "",
          customer_zipcode: orderDetails?.customer?.pincode || orderDetails?.customer?.zipCode || "",
          customer_country: orderDetails?.customer?.country || "India",
          order_amount: amount.toString(),
          order_items_count: orderDetails?.items?.length?.toString() || "0",
          item_names: itemNames.substring(0, 255),
          item_types: itemTypes,
          payment_method: "razorpay",
        },
        theme: {
          color: "#1e40af",
        },
        ...(preferredMethod && {
          config: { display: {
            blocks: { preferred: { name: "Selected payment option", instruments: [{ method: preferredMethod }] } },
            sequence: ["block.preferred"],
            preferences: { show_default_blocks: true },
          } },
        }),
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
            onCancel()
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (error) {
      console.error("Payment error:", error)
      setErrors({ form: error instanceof Error ? error.message : "Failed to initiate payment. Please try again." })
      setIsProcessing(false)
    }
  }

  const handleCashOnDelivery = async () => {
    setIsProcessing(true)

    try {
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const paymentDetails = {
        method: "cash-on-delivery",
        transactionId: `COD${Date.now()}`,
        status: "pending",
      }

      await onSuccess(paymentDetails)
      setIsProcessing(false)
    } catch (error) {
      console.error("COD processing error:", error)
      setErrors({ form: "Failed to process cash on delivery order." })
      setIsProcessing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isProcessing || submitting.current) return
    submitting.current = true
    setIsProcessing(true)
    setErrors({})
    try {
      if (beforePayment && !await beforePayment()) {
        setIsProcessing(false)
        return
      }
      if (paymentMethod === "cash-on-delivery") await handleCashOnDelivery()
      else await handleRazorpayPayment()
    } catch (error) {
      console.error("Checkout validation failed:", error)
      setErrors({ form: "Could not validate checkout. Please try again." })
      setIsProcessing(false)
    } finally {
      submitting.current = false
    }
  }

  return (
    <div>
      {errors.form && (
        <div role="alert" className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {!compact && (paymentMethod === "cash-on-delivery" ? (
          <div className="p-4 bg-gray-50 rounded-md mb-4">
            <h3 className="font-medium mb-2">Cash on Delivery</h3>
            <p className="text-gray-600 mb-2">You will pay when your order is delivered.</p>
            <p className="text-gray-600">Please keep the exact amount ready to ensure a smooth delivery experience.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-md mb-4 flex items-center">
              <CreditCard className="h-5 w-5 text-gray-500 mr-2" />
              <span className="text-gray-700">Click &quot;Pay Now&quot; to proceed with secure online payment via Razorpay</span>
            </div>

            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="font-medium text-blue-800 mb-2">Secure Payment</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Credit/Debit Cards</li>
                <li>• Net Banking</li>
                <li>• UPI</li>
                <li>• Digital Wallets</li>
              </ul>
            </div>
          </div>
        ))}

        <div className={compact ? "mt-4" : "mt-6 flex justify-between"}>
          {/* <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </button> */}

          <button
            type="submit"
            disabled={isProcessing || (paymentMethod !== "cash-on-delivery" && !razorpayLoaded)}
            className={compact ? "w-full rounded-md bg-[#0054F0] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center" : "px-6 py-2 bg-brand-accent text-white rounded-md hover:bg-brand-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center font-semibold active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-accent/40"}
          >
            {isProcessing ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                Processing...
              </>
            ) : (
              <>
                {!compact && <Check className="mr-2 h-4 w-4" />}
                {paymentMethod === "cash-on-delivery"
                  ? `Place Order ₹${amount.toLocaleString("en-IN")}`
                  : `Pay Now ₹${amount.toLocaleString("en-IN")}`}
                {compact && <ArrowRight className="ml-2 h-4 w-4" />}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
