/**
 * Example Script: Add License Keys to Database
 * 
 * This script demonstrates how to add license keys for a software product.
 * 
 * Usage:
 * 1. Copy this file and rename it (e.g., add-license-keys.ts)
 * 2. Update the softwareId and keys array
 * 3. Run: npx ts-node scripts/add-license-keys.ts
 */

import { bulkAddLicenses, getAvailableLicenseCount } from '../lib/license-service'

async function main() {
  try {
    // STEP 1: Set your software product ID
    // You can find this in your database or admin panel
    const softwareId = 'YOUR_SOFTWARE_ID_HERE' // e.g., '507f1f77bcf86cd799439011'

    // STEP 2: Add your license keys
    const licenseKeys = [
      'ABCD-1234-EFGH-5678',
      'IJKL-2345-MNOP-6789',
      'QRST-3456-UVWX-7890',
      // Add more keys here...
    ]

    console.log(`📦 Adding ${licenseKeys.length} license keys for software: ${softwareId}`)

    // STEP 3: Insert the keys
    const insertedCount = await bulkAddLicenses(softwareId, licenseKeys)

    console.log(`✅ Successfully added ${insertedCount} license key(s)`)

    // STEP 4: Verify the count
    const availableCount = await getAvailableLicenseCount(softwareId)
    console.log(`📊 Total available licenses: ${availableCount}`)

  } catch (error) {
    console.error('❌ Error adding license keys:', error)
    process.exit(1)
  }
}

// Run the script
main()
  .then(() => {
    console.log('✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
