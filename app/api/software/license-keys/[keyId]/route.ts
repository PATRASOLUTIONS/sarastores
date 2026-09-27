import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// Handle PATCH /api/software/license-keys/[keyId] (for updating key details)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ keyId: string }> }
) {
  try {
    const { keyId } = await context.params
    const { validityYears, maxDevices } = await request.json()
    
    if (!keyId || validityYears === undefined || maxDevices === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const { db } = await connectToDatabase()
    const result = await db.collection('license_keys').updateOne(
      { _id: new ObjectId(keyId) },
      {
        $set: {
          validityYears: parseInt(validityYears),
          maxDevices: parseInt(maxDevices),
          updatedAt: new Date()
        }
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'License key not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'License key updated successfully'
    })
  } catch (error) {
    console.error('Error updating license key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update license key' },
      { status: 500 }
    )
  }
}

// Handle DELETE /api/software/license-keys/[keyId]
export async function DELETE(
  request: Request,
  context: { params: Promise<{ keyId: string }> }
) {
  try {
    const { keyId } = await context.params
    
    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'Key ID is required' },
        { status: 400 }
      )
    }
    
    const { db } = await connectToDatabase()
    
    // Check if key is assigned
    const key = await db.collection('license_keys').findOne({
      _id: new ObjectId(keyId)
    })
    
    if (!key) {
      return NextResponse.json(
        { success: false, error: 'License key not found' },
        { status: 404 }
      )
    }
    
    if (key.status === 'assigned' || key.assignedTo) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete an assigned license key' },
        { status: 400 }
      )
    }
    
    // Delete the key
    const result = await db.collection('license_keys').deleteOne({
      _id: new ObjectId(keyId)
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete license key' },
        { status: 500 }
      )
    }
    
    // Update software product's key count
    await db.collection('software_products').updateOne(
      { _id: new ObjectId(key.softwareId) },
      { $inc: { totalKeysAvailable: -1 } }
    )
    
    return NextResponse.json({
      success: true,
      message: 'License key deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting license key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete license key' },
      { status: 500 }
    )
  }
}
