/** Shared canvas contract. Stages describe observed milestones, not an assumed funnel. */
export const FLOW_STAGES = [
  ['visitor', 'Website Visitor', 'blue', 0, 0, 'Globe'],
  ['guest', 'Guest Visitor', 'blue', 170, -90, 'UserRound'],
  ['registered', 'Existing Customer', 'blue', 170, 90, 'UserCheck'],
  ['browse', 'Browse Products', 'purple', 340, 0, 'Search'],
  ['product', 'Product Viewed', 'purple', 510, 0, 'Package'],
  ['cart', 'Added to Cart', 'purple', 680, 0, 'ShoppingCart'],
  ['login', 'Login / Registration', 'blue', 850, -80, 'LogIn'],
  ['guest_checkout', 'Guest Checkout', 'blue', 850, 90, 'UserRound'],
  ['cart_confirmed', 'Cart Confirmed', 'purple', 1020, 0, 'Check'],
  ['checkout', 'Checkout Started', 'orange', 1190, 0, 'ShoppingBag'],
  ['address', 'Address Completed', 'orange', 1360, 0, 'MapPin'],
  ['payment', 'Payment Initiated', 'orange', 1530, 0, 'CreditCard'],
  ['payment_success', 'Payment Successful', 'green', 1710, 0, 'CheckCheck'],
  ['payment_failed', 'Payment Failed', 'red', 1710, -190, 'X'],
  ['payment_pending', 'Payment Pending', 'grey', 1710, 190, 'Clock'],
  ['order', 'Order Created', 'green', 1890, 0, 'Receipt'],
  ['processing', 'Processing', 'green', 2060, 0, 'PackageCheck'],
  ['shipped', 'Shipped', 'green', 2230, 0, 'Truck'],
  ['out_for_delivery', 'Out for Delivery', 'green', 2400, 0, 'MapPin'],
  ['delivered', 'Delivered', 'green', 2570, 0, 'CircleCheck'],
  ['visitor_exited', 'Visitor Exited', 'red', 170, -310, 'LogOut'],
  ['product_abandoned', 'Product Abandoned', 'red', 510, -230, 'PackageX'],
  ['cart_abandoned', 'Cart Abandoned', 'red', 680, 250, 'ShoppingCart'],
  ['login_failed', 'Login Failed', 'red', 850, -300, 'LockKeyhole'],
  ['checkout_abandoned', 'Checkout Abandoned', 'red', 1360, 250, 'ShoppingBag'],
  ['payment_retried', 'Payment Retried', 'orange', 1530, -350, 'RotateCcw'],
  ['cancelled', 'Order Cancelled', 'red', 2060, -240, 'Ban'],
  ['delivery_failed', 'Delivery Failed', 'red', 2400, -240, 'Truck'],
  ['returned', 'Returned', 'red', 2570, 220, 'Undo2'],
  ['refunded', 'Refunded', 'grey', 2400, 400, 'Wallet'],
] as const
export type StageId = typeof FLOW_STAGES[number][0]
export const FLOW_LINKS: [StageId, StageId][] = [
  ['visitor','guest'], ['visitor','registered'], ['visitor','visitor_exited'],
  ['guest','browse'], ['registered','browse'], ['browse','product'], ['product','cart'],
  ['product','product_abandoned'], ['cart','login'], ['cart','guest_checkout'], ['cart','cart_abandoned'],
  ['login','cart_confirmed'], ['guest_checkout','cart_confirmed'], ['login','login_failed'],
  ['registered','cart_confirmed'], ['cart_confirmed','checkout'], ['checkout','address'],
  ['checkout','checkout_abandoned'], ['address','payment'], ['address','checkout_abandoned'],
  ['payment','payment_success'], ['payment','payment_failed'], ['payment','payment_pending'],
  ['payment_failed','payment_retried'], ['payment_retried','payment'], ['payment_pending','payment_success'],
  ['payment_success','order'], ['payment_pending','order'], ['order','processing'], ['order','cancelled'],
  ['processing','shipped'], ['processing','cancelled'], ['shipped','out_for_delivery'],
  ['out_for_delivery','delivered'], ['out_for_delivery','delivery_failed'], ['delivery_failed','out_for_delivery'],
  ['delivered','returned'], ['returned','refunded'], ['cancelled','refunded'],
]
export const FLOW_COLORS = { blue:'#3b82f6', purple:'#8b5cf6', orange:'#f59e0b', green:'#10b981', red:'#ef6464', grey:'#94a3b8' }
export const FLOW_EVENT_STAGES: Record<string, StageId[]> = {
  page_view: ['visitor'], browse_products: ['browse'], view_item: ['product'], add_to_cart: ['cart'],
  login: ['login'], sign_up: ['login'], guest_checkout: ['guest_checkout'], cart_confirmed: ['cart_confirmed'],
  begin_checkout: ['checkout'], address_completed: ['address'], add_payment_info: ['payment'],
  login_failed: ['login_failed'], payment_failed: ['payment_failed'], payment_retried: ['payment_retried'],
}
export interface FlowFilters {
  start: string; end: string; kind: string; device: string; source: string; gateway: string; product: string; orderStatus: string
}
export interface FlowCustomer {
  id: string; name: string; email: string; phone: string; kind: string; lastActivity: string;
  currentStage: string; productsViewed: number; cartValue: number | null; orderId: string;
  orderAmount: number | null; paymentStatus: string; orderStatus: string; device: string;
  trafficSource: string; firstVisit: string | null;
}
export interface FlowGraph {
  total: number; counts: Record<string, number>; edges: Record<string, number>; generatedAt: string;
  coverage: { anonymousEventsExcluded: number; guestOrdersExcluded: number; notes: string[] };
}
export interface FlowTable { rows: FlowCustomer[]; total: number; page: number; limit: number }
export interface FlowDetail { customer: FlowCustomer; events: { stage: string; at: string; evidence: string; productIds: string[]; orderId: string }[]; total: number; page: number }
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
