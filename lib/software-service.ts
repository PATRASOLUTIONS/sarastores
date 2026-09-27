import { connectToDatabase } from './mongodb'
import type { SoftwareProduct, LicenseKey } from '@/types/software'
import { ObjectId } from 'mongodb'

export async function getAllSoftwareProducts(filter: { status?: string } = {}) {
  const { db } = await connectToDatabase()
  const query: any = {}
  
  if (filter.status) {
    query.status = filter.status
  }
  
  const products = await db
    .collection('software_products')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray()
  
  return products
}

export async function getSoftwareProductById(id: string) {
  const { db } = await connectToDatabase()
  const product = await db
    .collection('software_products')
    .findOne({ _id: new ObjectId(id) })
  
  return product
}

export async function createSoftwareProduct(product: Omit<SoftwareProduct, '_id' | 'createdAt' | 'updatedAt'>) {
  const { db } = await connectToDatabase()
  
  const newProduct = {
    ...product,
    totalKeysAvailable: 0,
    totalKeysAssigned: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  const result = await db.collection('software_products').insertOne(newProduct)
  return { ...newProduct, _id: result.insertedId }
}

export async function updateSoftwareProduct(id: string, updates: Partial<SoftwareProduct>) {
  const { db } = await connectToDatabase()
  
  // Remove immutable fields that shouldn't be updated
  const { _id, createdAt, totalKeysAvailable, totalKeysAssigned, ...updateData } = updates as any
  
  const result = await db.collection('software_products').updateOne(
    { _id: new ObjectId(id) },
    { 
      $set: { 
        ...updateData, 
        updatedAt: new Date() 
      } 
    }
  )
  
  return result.modifiedCount > 0
}

export async function deleteSoftwareProduct(id: string) {
  const { db } = await connectToDatabase()
  
  // Check if there are ANY keys linked to this software
  const totalKeys = await db.collection('license_keys').countDocuments({
    softwareId: id
  })
  
  if (totalKeys > 0) {
    // Check specifically for assigned keys to provide detailed error message
    const assignedKeys = await db.collection('license_keys').countDocuments({
      softwareId: id,
      status: 'assigned'
    })
    
    if (assignedKeys > 0) {
      throw new Error(`Cannot delete software. There are ${assignedKeys} assigned license key(s). Please revoke or wait for them to expire before deleting.`)
    } else {
      throw new Error(`Cannot delete software. There are ${totalKeys} license key(s) linked to this software. Please delete all keys first from the Keys management page.`)
    }
  }
  
  // Delete the product (only if no keys exist)
  const result = await db.collection('software_products').deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount > 0
}

// License Key Management
export async function addLicenseKeys(
  softwareId: string,
  keys: Array<{ key: string; validityYears: number; maxDevices?: number }>
) {
  const { db } = await connectToDatabase()
  
  const software = await getSoftwareProductById(softwareId)
  if (!software) {
    throw new Error('Software product not found')
  }
  
  const newKeys = keys.map(key => ({
    _id: new ObjectId(),
    key: key.key,
    softwareId: new ObjectId(softwareId),
    status: 'available',
    validityYears: Math.min(5, Math.max(1, key.validityYears)), // Ensure validity is between 1-5
    maxDevices: key.maxDevices || 1,
    usedDevices: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }))
  
  const result = await db.collection('license_keys').insertMany(newKeys)
  
  // Update product's total keys count
  await db.collection('software_products').updateOne(
    { _id: new ObjectId(softwareId) },
    { 
      $inc: { totalKeysAvailable: keys.length },
      $set: { updatedAt: new Date() }
    }
  )
  
  return result.insertedCount
}

export async function getAvailableLicenseKeys(
  softwareId: string,
  validityYears: number,
  count: number,
  maxDevices: number = 1
) {
  const { db } = await connectToDatabase()
  
  const availableKeys = await db
    .collection('license_keys')
    .find({
      softwareId: new ObjectId(softwareId),
      validityYears: validityYears,
      status: 'available',
      $expr: { $lt: ['$usedDevices', '$maxDevices'] }
    })
    .limit(count)
    .toArray()
  
  return availableKeys
}

export async function assignLicenseKeys(
  keyIds: string[],
  assignmentData: {
    customerId: string
    customerEmail: string
    customerName: string
    orderId: string
    orderNumber: string
  }
) {
  const { db } = await connectToDatabase()
  
  const now = new Date()
  
  // Get the keys to determine expiry dates
  const keys = await db.collection('license_keys').find({
    _id: { $in: keyIds.map(id => new ObjectId(id)) }
  }).toArray()
  
  // Update each key with assignment info and expiry
  const bulkOps = keys.map(key => {
    const expiresAt = new Date(now)
    expiresAt.setFullYear(expiresAt.getFullYear() + key.validityYears)
    
    return {
      updateOne: {
        filter: { _id: key._id },
        update: {
          $set: {
            status: 'assigned',
            assignedTo: assignmentData,
            assignedAt: now,
            expiresAt,
            updatedAt: now
          },
          $inc: { usedDevices: 1 }
        }
      }
    }
  })
  
  await db.collection('license_keys').bulkWrite(bulkOps)
  
  // Update software product counts
  const softwareId = keys[0]?.softwareId
  if (softwareId) {
    await db.collection('software_products').updateOne(
      { _id: new ObjectId(softwareId) },
      {
        $inc: {
          totalKeysAvailable: -keyIds.length,
          totalKeysAssigned: keyIds.length
        },
        $set: { updatedAt: now }
      }
    )
  }
  
  return keys
}

export async function getLicenseKeysByOrder(orderId: string) {
  const { db } = await connectToDatabase()
  
  const keys = await db
    .collection('license_keys')
    .find({ 'assignedTo.orderId': orderId })
    .toArray()
  
  return keys
}

export async function getLicenseKeysByCustomer(customerEmail: string) {
  const { db } = await connectToDatabase()
  
  const keys = await db
    .collection('license_keys')
    .find({ 'assignedTo.customerEmail': customerEmail })
    .sort({ assignedAt: -1 })
    .toArray()
  
  return keys
}

export async function revokeLicenseKey(keyId: string, reason: string) {
  const { db } = await connectToDatabase()
  
  const result = await db.collection('license_keys').updateOne(
    { _id: new ObjectId(keyId) },
    {
      $set: {
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason,
        updatedAt: new Date()
      },
      $inc: { usedDevices: -1 }
    }
  )
  
  return result.modifiedCount > 0
}

export async function getAllLicenseKeys(filter: {
  softwareId?: string
  status?: string
  customerEmail?: string
} = {}) {
  const { db } = await connectToDatabase()
  const query: any = {}
  
  if (filter.softwareId) {
    query.softwareId = new ObjectId(filter.softwareId)
  }
  if (filter.status) {
    query.status = filter.status
  }
  if (filter.customerEmail) {
    query['assignedTo.customerEmail'] = filter.customerEmail
  }
  
  const keys = await db
    .collection('license_keys')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray()
  
  return keys
}

export async function checkKeyAvailability(
  softwareId: string,
  validityYears: number,
  requiredCount: number
): Promise<boolean> {
  const { db } = await connectToDatabase()
  
  const availableCount = await db.collection('license_keys').countDocuments({
    softwareId,
    validityYears,
    status: 'available'
  })
  
  return availableCount >= requiredCount
}
