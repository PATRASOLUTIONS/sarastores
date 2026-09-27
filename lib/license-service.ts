import { connectDB } from './db'
import { ObjectId } from 'mongodb'

/**
 * Software License Management Service
 * Manages the software_licenses collection for automatic license assignment
 */

export interface SoftwareLicense {
  _id?: ObjectId
  softwareId: ObjectId | string
  key: string
  assigned: boolean
  email: string | null
  orderId: ObjectId | string | null
  assignedAt: Date | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Find an available license key for a specific software
 * @param softwareId - The ID of the software product
 * @returns Available license or null if none found
 */
export async function findAvailableLicense(softwareId: string): Promise<SoftwareLicense | null> {
  try {
    const db = await connectDB()
    const collection = db.collection<SoftwareLicense>('software_licenses')
    
    // Find one unassigned license for this software
    const license = await collection.findOne({
      softwareId: new ObjectId(softwareId),
      $or: [
        { assigned: false },
        { email: null }
      ]
    })
    
    return license
  } catch (error) {
    console.error('Error finding available license:', error)
    throw error
  }
}

/**
 * Assign a license key to a customer
 * @param licenseId - The ID of the license to assign
 * @param orderData - Order and customer information
 * @returns Updated license document
 */
export async function assignLicense(
  licenseId: string | ObjectId,
  orderData: {
    email: string
    orderId: string
  }
): Promise<SoftwareLicense | null> {
  try {
    const db = await connectDB()
    const collection = db.collection<SoftwareLicense>('software_licenses')
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(licenseId) },
      {
        $set: {
          assigned: true,
          email: orderData.email,
          orderId: new ObjectId(orderData.orderId),
          assignedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )
    
    return result || null
  } catch (error) {
    console.error('Error assigning license:', error)
    throw error
  }
}

/**
 * Get all licenses for a specific order
 * @param orderId - The order ID
 * @returns Array of licenses
 */
export async function getLicensesByOrderId(orderId: string): Promise<SoftwareLicense[]> {
  try {
    const db = await connectDB()
    const collection = db.collection<SoftwareLicense>('software_licenses')
    
    const licenses = await collection.find({
      orderId: new ObjectId(orderId)
    }).toArray()
    
    return licenses
  } catch (error) {
    console.error('Error fetching licenses by order:', error)
    throw error
  }
}

/**
 * Get all licenses for a specific customer email
 * @param email - Customer email
 * @returns Array of licenses
 */
export async function getLicensesByEmail(email: string): Promise<SoftwareLicense[]> {
  try {
    const db = await connectDB()
    const collection = db.collection<SoftwareLicense>('software_licenses')
    
    const licenses = await collection.find({
      email: email,
      assigned: true
    }).toArray()
    
    return licenses
  } catch (error) {
    console.error('Error fetching licenses by email:', error)
    throw error
  }
}

/**
 * Check if there are available licenses for a software product
 * @param softwareId - The software product ID
 * @returns Number of available licenses
 */
export async function getAvailableLicenseCount(softwareId: string): Promise<number> {
  try {
    const db = await connectDB()
    const collection = db.collection<SoftwareLicense>('software_licenses')
    
    const count = await collection.countDocuments({
      softwareId: new ObjectId(softwareId),
      $or: [
        { assigned: false },
        { email: null }
      ]
    })
    
    return count
  } catch (error) {
    console.error('Error counting available licenses:', error)
    throw error
  }
}

/**
 * Revoke/unassign a license (for refunds or cancellations)
 * @param licenseId - The license ID to revoke
 * @returns Success status
 */
export async function revokeLicense(licenseId: string | ObjectId): Promise<boolean> {
  try {
    const db = await connectDB()
    const collection = db.collection<SoftwareLicense>('software_licenses')
    
    const result = await collection.updateOne(
      { _id: new ObjectId(licenseId) },
      {
        $set: {
          assigned: false,
          email: null,
          orderId: null,
          assignedAt: null,
          updatedAt: new Date()
        }
      }
    )
    
    return result.modifiedCount > 0
  } catch (error) {
    console.error('Error revoking license:', error)
    throw error
  }
}

/**
 * Bulk add license keys for a software product
 * @param softwareId - The software product ID
 * @param keys - Array of license key strings
 * @returns Number of keys inserted
 */
export async function bulkAddLicenses(
  softwareId: string,
  keys: string[]
): Promise<number> {
  try {
    const db = await connectDB()
    const collection = db.collection<SoftwareLicense>('software_licenses')
    
    const licenses: SoftwareLicense[] = keys.map(key => ({
      softwareId: new ObjectId(softwareId),
      key: key,
      assigned: false,
      email: null,
      orderId: null,
      assignedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
    
    const result = await collection.insertMany(licenses)
    return result.insertedCount
  } catch (error) {
    console.error('Error bulk adding licenses:', error)
    throw error
  }
}
