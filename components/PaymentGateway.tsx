"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { CreditCard, AlertCircle, Check, ArrowLeft } from "lucide-react"

declare global {
  interface Window {
    Razorpay: any
  }
}

interface PaymentGatewayProps {
  paymentMethod: string
  amount: number
  onSuccess: (paymentDetails: any) => void
  onCancel: () => void
  orderDetails?: any
}

export default function PaymentGateway({
  paymentMethod,
  amount,
  onSuccess,
  onCancel,
  orderDetails,
}: PaymentGatewayProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => setRazorpayLoaded(true)
    script.onerror = () => {
      console.error("Failed to load Razorpay script")
      setErrors({ form: "Failed to load payment gateway. Please try again." })
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const handleRazorpayPayment = async () => {
    if (!razorpayLoaded) {
      setErrors({ form: "Payment gateway is still loading. Please wait." })
      return
    }

    setIsProcessing(true)
    setErrors({})

    try {
      // Prepare comprehensive notes for Razorpay
      const itemNames = orderDetails?.items?.map((item: any) => item.name).join(", ") || ""
      const itemTypes = orderDetails?.items?.map((item: any) => item.type || "hardware").join(", ") || ""

      const razorpayNotes = {
        customer_name: orderDetails?.customer?.firstName + " " + orderDetails?.customer?.lastName || "",
        customer_email: orderDetails?.customer?.email || "",
        customer_phone: orderDetails?.customer?.phone || "",
        customer_address: orderDetails?.customer?.address || "",
        customer_city: orderDetails?.customer?.city || "",
        customer_state: orderDetails?.customer?.state || "",
        customer_zipcode: orderDetails?.customer?.zipCode || "",
        customer_country: orderDetails?.customer?.country || "India",
        order_amount: amount.toString(),
        order_items_count: orderDetails?.items?.length?.toString() || "0",
        item_names: itemNames.substring(0, 255), // Razorpay has 255 char limit per field
        item_types: itemTypes,
        payment_method: "razorpay",
      }

      console.log("📝 Sending notes to Razorpay:", razorpayNotes)

      // Create order on backend. The server re-prices the cart and decides the amount.
      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: (orderDetails?.items || []).map((item: any) => ({
            id: item.id || item.productId,
            productId: item.productId,
            sku: item.sku,
            quantity: item.quantity,
            type: item.type,
          })),
          couponCode: orderDetails?.coupon?.code ?? null,
          redeemPoints: orderDetails?.redeemPoints ?? 0,
          currency: "INR",
          receipt: `order_${Date.now()}`,
          notes: razorpayNotes,
        }),
      })

      if (!orderResponse.ok) {
        const failure = await orderResponse.json().catch(() => null)
        throw new Error(failure?.error || "Failed to create payment order")
      }

      const orderData = await orderResponse.json()
      console.log("✅ Razorpay order created:", orderData.orderId)
      console.log("📝 Notes confirmed in order:", orderData.notes)

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Sara Mobiles and Electronics ",
        description: "Purchase from Sara Mobiles and Electronics ",
        order_id: orderData.orderId,
        handler: async (response: any) => {
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
                notes: razorpayNotes, // Send notes to be updated in Razorpay payment
              }),
            })

            if (!verifyResponse.ok) {
              throw new Error("Payment verification failed")
            }

            const verifyData = await verifyResponse.json()

            // Payment successful
            const paymentDetails = {
              method: "razorpay",
              paymentId: verifyData.paymentId,
              orderId: verifyData.orderId,
              transactionId: response.razorpay_payment_id,
              status: "completed",
            }

            onSuccess(paymentDetails)
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
          customer_zipcode: orderDetails?.customer?.zipCode || "",
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
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (error) {
      console.error("Payment error:", error)
      setErrors({ form: "Failed to initiate payment. Please try again." })
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

      onSuccess(paymentDetails)
    } catch (error) {
      console.error("COD processing error:", error)
      setErrors({ form: "Failed to process cash on delivery order." })
      setIsProcessing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (paymentMethod === "cash-on-delivery") {
      await handleCashOnDelivery()
    } else {
      await handleRazorpayPayment()
    }
  }

  return (
    <div>
      {errors.form && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {paymentMethod === "cash-on-delivery" ? (
          <div className="p-4 bg-gray-50 rounded-md mb-4">
            <h3 className="font-medium mb-2">Cash on Delivery</h3>
            <p className="text-gray-600 mb-2">You will pay when your order is delivered.</p>
            <p className="text-gray-600">Please keep the exact amount ready to ensure a smooth delivery experience.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-md mb-4 flex items-center">
              <CreditCard className="h-5 w-5 text-gray-500 mr-2" />
              <span className="text-gray-700">Click "Pay Now" to proceed with secure online payment via Razorpay</span>
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
        )}

        <div className="mt-6 flex justify-between">
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
            className="px-6 py-2 bg-brand-accent text-white rounded-md hover:bg-brand-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center font-semibold active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                Processing...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {paymentMethod === "cash-on-delivery"
                  ? `Place Order ₹${amount.toLocaleString("en-IN")}`
                  : `Pay Now ₹${amount.toLocaleString("en-IN")}`}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
