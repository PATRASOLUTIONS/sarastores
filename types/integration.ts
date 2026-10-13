export interface IntegrationVariant {
  variantID?: string
  id?: string
  variantName?: string
  variantDisplayName?: string
  name?: string
  price?: number | string
  mrp?: number | string
  faceValue?: number | string
  margin?: number | string
  stock?: number | string
}

export interface IntegrationProduct {
  productID?: string
  productId?: string
  id?: string
  _id?: string
  productName?: string
  productDisplayName?: string
  name?: string
  title?: string
  category?: string
  categoryName?: string
  segment?: string
  descriptionText?: string
  description?: string
  attachments?: string[]
  images?: Array<string | { url: string }>
  categories?: Array<{ categoryName?: string; name?: string }>
  variants?: IntegrationVariant[]
  items?: IntegrationVariant[]
  products?: IntegrationVariant[]
  variantCount?: number
  variants_count?: number
  faceValue?: number | string
  price?: number | string
  mrp?: number | string
  active?: boolean
  status?: string
  availability?: string
  redemptionInstructions?: string
  redeemInstructions?: string
  termsAndConditions?: string
  terms?: string
}

export interface IntegrationProductList {
  data?: IntegrationProduct[]
  products?: IntegrationProduct[]
  items?: IntegrationProduct[]
  paginationInfo?: IntegrationPagination
  meta?: IntegrationPagination
}

export interface IntegrationPagination {
  nextCursor?: string
  next_cursor?: string
  hasMore?: boolean
  has_more?: boolean
}
