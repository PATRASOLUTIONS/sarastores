export interface SoftwareProduct {
  _id?: string
  name: string
  description: string
  shortDescription: string
  category: string
  image: string
  images?: string[]
  features: string[]
  systemRequirements: {
    os: string[]
    processor: string
    ram: string
    storage: string
    other?: string[]
  }
  pricing: {
    pack1: number  // 1 license
    pack2: number  // 2 licenses
    pack3: number  // 3 licenses
    pack4: number  // 4 licenses
    pack5: number  // 5 licenses
  }
  validityPeriods: {
    oneYear: number    // Price for 1 year
    twoYear: number    // Price for 2 years
    threeYear: number  // Price for 3 years
    fourYear: number   // Price for 4 years
    fiveYear: number   // Price for 5 years
  }
  status: 'active' | 'inactive' | 'out-of-stock'
  totalKeysAvailable: number
  totalKeysAssigned: number
  createdAt: Date
  updatedAt: Date
}

export interface LicenseKey {
  _id?: string
  softwareId: string
  softwareName: string
  key: string
  status: 'available' | 'assigned' | 'expired' | 'revoked'
  validityYears: 1 | 2 | 3 | 4 | 5
  assignedTo?: {
    customerId: string
    customerEmail: string
    customerName: string
    orderId: string
    orderNumber: string
  }
  assignedAt?: Date
  expiresAt?: Date
  activatedAt?: Date
  revokedAt?: Date
  revokedReason?: string
  createdAt: Date
  updatedAt: Date
}

export interface SoftwareOrder {
  softwareId: string
  softwareName: string
  packSize: 1 | 2 | 3 | 4 | 5
  validityYears: 1 | 2 | 3 | 4 | 5
  price: number
  licenseKeys?: string[]  // Assigned keys
}

export interface SoftwareCartItem {
  _id: string
  name: string
  image: string
  packSize: 1 | 2 | 3 | 4 | 5
  validityYears: 1 | 2 | 3 | 4 | 5
  price: number
  type: 'software'
}
