/**
 * Retroactive License Assignment Script
 * 
 * This script checks all recent orders and assigns license keys to orders
 * that don't have them yet. It also marks orders as delivered and sends
 * activation emails to customers.
 * 
 * Usage: npx ts-node scripts/assign-missing-licenses.ts
 */

import { connectDB } from '../lib/db'
import { ObjectId } from 'mongodb'
import { findAvailableLicense, assignLicense } from '../lib/license-service'
import { sendEmail } from '../lib/email'
import { emailTemplates } from '../lib/emailTemplates'

interface OrderItem {
  id?: string
  softwareId?: string
  name: string
  type: string
  price: number
  quantity: number
  validity?: number
  validityYears?: number
  maxDevices?: number
  maxDevice?: number
}

interface Order {
  _id: ObjectId
  orderNumber?: string
  items: OrderItem[]
  status: string
  licenseKey?: string
  customer?: {
    name?: string
    firstName?: string
    lastName?: string
    email: string
  }
  shippingAddress?: {
    name?: string
    email?: string
  }
  createdAt: Date
}

interface ProcessingStats {
  totalOrders: number
  ordersProcessed: number
  licensesAssigned: number
  emailsSent: number
  ordersMarkedDelivered: number
  errors: Array<{
    orderId: string
    error: string
  }>
}

/**
 * Main function to process orders and assign missing licenses
 */
async function assignMissingLicenses(daysBack: number = 30): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    totalOrders: 0,
    ordersProcessed: 0,
    licensesAssigned: 0,
    emailsSent: 0,
    ordersMarkedDelivered: 0,
    errors: []
  }

  try {
    console.log('🚀 Starting retroactive license assignment process...')
    console.log(`📅 Checking orders from the last ${daysBack} days\n`)

    const db = await connectDB()
    const ordersCollection = db.collection<Order>('orders')

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - daysBack)

    // Find orders that:
    // 1. Have software items
    // 2. Are paid/confirmed
    // 3. Don't have a license key yet
    // 4. Are within the date range
    const ordersQuery: any = {
      'items.type': 'software',
      status: { $in: ['paid', 'confirmed', 'processing'] },
      $or: [
        { licenseKey: { $exists: false } },
        { licenseKey: null },
        { licenseKey: '' }
      ],
      createdAt: { $gte: dateThreshold }
    }

    const orders = await ordersCollection
      .find(ordersQuery)
      .sort({ createdAt: -1 })
      .toArray()

    stats.totalOrders = orders.length
    console.log(`📊 Found ${stats.totalOrders} order(s) requiring license assignment\n`)

    if (stats.totalOrders === 0) {
      console.log('✅ No orders need license assignment. All caught up!')
      return stats
    }

    // Process each order
    for (const order of orders) {
      const orderId = order._id.toString()
      const orderNumber = order.orderNumber || orderId

      console.log(`\n${'='.repeat(60)}`)
      console.log(`📦 Processing Order: ${orderNumber}`)
      console.log(`${'='.repeat(60)}`)

      try {
        // Get customer email
        const customerEmail = order.customer?.email || order.shippingAddress?.email
        if (!customerEmail) {
          const error = 'No customer email found'
          console.error(`❌ ${error}`)
          stats.errors.push({ orderId: orderNumber, error })
          continue
        }

        console.log(`👤 Customer: ${customerEmail}`)

        // Get customer name
        const customerName =
          order.customer?.name ||
          `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
          order.shippingAddress?.name ||
          'Valued Customer'

        // Find software items in the order
        const softwareItems = order.items.filter(item => item.type === 'software')
        console.log(`🔍 Found ${softwareItems.length} software item(s)`)

        let orderLicenseAssigned = false

        // Process each software item
        for (const item of softwareItems) {
          const softwareId = item.id || item.softwareId

          if (!softwareId) {
            console.warn(`⚠️  Skipping item "${item.name}" - no software ID`)
            continue
          }

          console.log(`\n  📀 Processing: ${item.name}`)
          console.log(`     Software ID: ${softwareId}`)

          try {
            // Find available license
            const availableLicense = await findAvailableLicense(softwareId)

            if (!availableLicense) {
              const error = `No available license for ${item.name}`
              console.error(`  ❌ ${error}`)
              stats.errors.push({ orderId: orderNumber, error })

              // Send admin alert
              try {
                const { sendNoLicenseAlert } = await import('../lib/admin-alerts')
                await sendNoLicenseAlert(softwareId, item.name, orderId, customerEmail)
                console.log(`  📧 Admin alert sent`)
              } catch (alertError) {
                console.error(`  ⚠️  Failed to send admin alert:`, alertError)
              }

              continue
            }

            console.log(`  🔑 Found available license: ${availableLicense.key}`)

            // Assign the license
            const assignedLicense = await assignLicense(
              availableLicense._id!.toString(),
              {
                email: customerEmail,
                orderId: orderId
              }
            )

            if (!assignedLicense) {
              const error = `Failed to assign license for ${item.name}`
              console.error(`  ❌ ${error}`)
              stats.errors.push({ orderId: orderNumber, error })
              continue
            }

            console.log(`  ✅ License assigned successfully`)
            stats.licensesAssigned++

            // Update order with license key
            await ordersCollection.updateOne(
              { _id: order._id },
              {
                $set: {
                  licenseKey: assignedLicense.key,
                  licenseAssignedAt: new Date(),
                  updatedAt: new Date()
                }
              }
            )

            console.log(`  💾 Order updated with license key`)
            orderLicenseAssigned = true

            // Send activation email
            try {
              const emailData = {
                customerName: customerName,
                orderNumber: orderNumber,
                softwareName: item.name,
                licenseKey: assignedLicense.key,
                validity: (item.validity || item.validityYears || 365).toString(),
                maxDevice: item.maxDevices || item.maxDevice || 1,
                companyName: 'Sara Mobiles and Electronics '
              }

              await sendEmail({
                to: customerEmail,
                subject: emailTemplates.SOFTWARE_ACTIVATION_KEY.subject
                  .replace('#{softwareName}', item.name)
                  .replace('#{orderNumber}', orderNumber),
                html: emailTemplates.SOFTWARE_ACTIVATION_KEY.html(emailData)
              })

              console.log(`  📧 Activation email sent to ${customerEmail}`)
              stats.emailsSent++
            } catch (emailError) {
              const error = `Email send failed: ${emailError}`
              console.error(`  ❌ ${error}`)
              stats.errors.push({ orderId: orderNumber, error })
              // Don't stop processing - license is already assigned
            }

          } catch (itemError) {
            const error = `Error processing ${item.name}: ${itemError}`
            console.error(`  ❌ ${error}`)
            stats.errors.push({ orderId: orderNumber, error })
          }
        }

        // Mark order as delivered if license was assigned
        if (orderLicenseAssigned && order.status !== 'delivered') {
          try {
            await ordersCollection.updateOne(
              { _id: order._id },
              {
                $set: {
                  status: 'delivered',
                  updatedAt: new Date()
                },
                $push: {
                  timeline: {
                    status: 'delivered',
                    timestamp: new Date(),
                    note: 'License key assigned and delivered via email'
                  }
                } as any
              }
            )

            console.log(`  📬 Order marked as delivered`)
            stats.ordersMarkedDelivered++

            // Send order delivered email
            try {
              await sendEmail({
                to: customerEmail,
                subject: emailTemplates.ORDER_DELIVERED.subject.replace('#{orderNumber}', orderNumber),
                html: emailTemplates.ORDER_DELIVERED.html({
                  orderNumber: orderNumber,
                  customerName: customerName,
                  status: 'delivered',
                  orderDetails: {
                    total: softwareItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    items: softwareItems.map(item => ({
                      name: item.name,
                      quantity: item.quantity,
                      price: item.price
                    }))
                  }
                })
              })

              console.log(`  📧 Delivery confirmation email sent`)
            } catch (emailError) {
              console.error(`  ⚠️  Failed to send delivery email:`, emailError)
            }
          } catch (statusError) {
            console.error(`  ⚠️  Failed to update order status:`, statusError)
          }
        }

        stats.ordersProcessed++
        console.log(`\n✅ Order ${orderNumber} processed successfully`)

      } catch (orderError) {
        const error = `Order processing failed: ${orderError}`
        console.error(`❌ ${error}`)
        stats.errors.push({ orderId: orderNumber, error })
      }
    }

    return stats

  } catch (error) {
    console.error('\n❌ Fatal error in license assignment process:', error)
    throw error
  }
}

/**
 * Print summary statistics
 */
function printSummary(stats: ProcessingStats) {
  console.log('\n\n' + '='.repeat(60))
  console.log('📊 PROCESSING SUMMARY')
  console.log('='.repeat(60))
  console.log(`\n📦 Total Orders Found:        ${stats.totalOrders}`)
  console.log(`✅ Orders Processed:          ${stats.ordersProcessed}`)
  console.log(`🔑 Licenses Assigned:         ${stats.licensesAssigned}`)
  console.log(`📧 Emails Sent:               ${stats.emailsSent}`)
  console.log(`📬 Orders Marked Delivered:   ${stats.ordersMarkedDelivered}`)
  console.log(`❌ Errors Encountered:        ${stats.errors.length}`)

  if (stats.errors.length > 0) {
    console.log('\n⚠️  ERRORS:')
    stats.errors.forEach((err, index) => {
      console.log(`  ${index + 1}. Order ${err.orderId}: ${err.error}`)
    })
  }

  console.log('\n' + '='.repeat(60))

  if (stats.ordersProcessed === stats.totalOrders && stats.errors.length === 0) {
    console.log('🎉 All orders processed successfully!')
  } else if (stats.ordersProcessed > 0) {
    console.log('⚠️  Some orders processed with errors. Review the log above.')
  } else {
    console.log('❌ No orders were processed successfully.')
  }

  console.log('='.repeat(60) + '\n')
}

/**
 * Main execution
 */
async function main() {
  try {
    // Get days back from command line argument or default to 30
    const daysBack = parseInt(process.argv[2]) || 30

    console.log('\n' + '='.repeat(60))
    console.log('🔑 RETROACTIVE LICENSE ASSIGNMENT TOOL')
    console.log('='.repeat(60) + '\n')

    // Confirm before proceeding
    console.log(`⚠️  This will process orders from the last ${daysBack} days`)
    console.log('⚠️  Licenses will be assigned and emails will be sent')
    console.log('\nStarting in 3 seconds... (Press Ctrl+C to cancel)\n')

    await new Promise(resolve => setTimeout(resolve, 3000))

    // Run the assignment process
    const stats = await assignMissingLicenses(daysBack)

    // Print summary
    printSummary(stats)

    // Exit with appropriate code
    process.exit(stats.errors.length > 0 ? 1 : 0)

  } catch (error) {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}

export { assignMissingLicenses }
export type { ProcessingStats }
