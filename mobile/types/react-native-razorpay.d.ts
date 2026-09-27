/**
 * react-native-razorpay ships no types. Declared to the shape we actually use;
 * the SDK accepts more options than this.
 */
declare module "react-native-razorpay" {
  export interface RazorpayOptions {
    key: string
    order_id: string
    amount: number
    currency: string
    name: string
    description?: string
    image?: string
    prefill?: { email?: string; contact?: string; name?: string }
    notes?: Record<string, string>
    theme?: { color?: string }
  }

  export interface RazorpaySuccessResponse {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }

  export interface RazorpayErrorResponse {
    code: number
    description: string
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>
  }

  export default RazorpayCheckout
}
