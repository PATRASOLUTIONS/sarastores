export const COMPLAINT_TYPES = {
  DEFECTIVE: 'defective',
  BREAKAGE: 'breakage',
  RETURN: 'return',
  ENQUIRY: 'enquiry',
  WRONG_ITEM: 'wrong_item',
  MISSING_ITEM: 'missing_item',
  OTHER: 'other'
} as const

export const COMPLAINT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  REFUND_INITIATED: 'refund_initiated',
  NO_REFUND: 'no_refund',
  RESOLVED: 'resolved',
  REVOKED: 'revoked'
} as const

export const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  defective: 'Defective Product',
  breakage: 'Product Breakage',
  return: 'Return Request',
  enquiry: 'General Enquiry',
  wrong_item: 'Wrong Item Received',
  missing_item: 'Missing Item',
  other: 'Other Issue'
}

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  refund_initiated: 'Refund Initiated',
  no_refund: 'No Refund',
  resolved: 'Resolved',
  revoked: 'Revoked'
}

export const COMPLAINT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  refund_initiated: 'bg-purple-100 text-purple-800',
  no_refund: 'bg-red-100 text-red-800',
  resolved: 'bg-green-100 text-green-800',
  revoked: 'bg-gray-100 text-gray-800'
}

export type ComplaintType = typeof COMPLAINT_TYPES[keyof typeof COMPLAINT_TYPES]
export type ComplaintStatus = typeof COMPLAINT_STATUS[keyof typeof COMPLAINT_STATUS]
