import { sendEmail } from './email'
import { getAvailableLicenseCount } from './license-service'

/**
 * Send alert to admin when license inventory is low
 */
export async function sendLowLicenseAlert(
  softwareId: string,
  softwareName: string,
  availableCount: number,
  threshold: number = 5
) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'sales.systechdigital@gmail.com'

    const subject = `⚠️ Low License Inventory Alert: ${softwareName}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
          .alert-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .stats { background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 20px; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Low License Inventory</h1>
          </div>
          
          <div class="content">
            <p>Hello Admin,</p>
            
            <p>This is an automated alert to inform you that the license inventory for <strong>${softwareName}</strong> is running low.</p>
            
            <div class="alert-box">
              <h3 style="margin: 0 0 10px 0; color: #92400e;">Current Status</h3>
              <p style="margin: 0; font-size: 18px;">
                <strong style="color: #f59e0b; font-size: 24px;">${availableCount}</strong> 
                license(s) remaining
              </p>
            </div>
            
            <div class="stats">
              <h4 style="margin: 0 0 10px 0;">Details</h4>
              <p style="margin: 5px 0;"><strong>Software ID:</strong> ${softwareId}</p>
              <p style="margin: 5px 0;"><strong>Software Name:</strong> ${softwareName}</p>
              <p style="margin: 5px 0;"><strong>Available Licenses:</strong> ${availableCount}</p>
              <p style="margin: 5px 0;"><strong>Alert Threshold:</strong> ${threshold}</p>
            </div>
            
            <p><strong>Action Required:</strong></p>
            <ul>
              <li>Add more license keys to the inventory</li>
              <li>Check with your software vendor for additional licenses</li>
              <li>Monitor sales to avoid running out of licenses</li>
            </ul>
            
            <p style="margin-top: 20px;">
              <strong>To add license keys:</strong><br>
              Use the admin panel or run the bulk import script with new license keys.
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated alert from Sara Mobiles and Electronics  License Management System</p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `

    await sendEmail({
      to: adminEmail,
      subject,
      html
    })

    console.log(`📧 Low license alert sent to admin: ${adminEmail}`)
    return true
  } catch (error) {
    console.error('❌ Failed to send low license alert:', error)
    return false
  }
}

/**
 * Send alert to admin when no licenses are available for a purchase
 */
export async function sendNoLicenseAlert(
  softwareId: string,
  softwareName: string,
  orderId: string,
  customerEmail: string
) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'sales.systechdigital@gmail.com'

    const subject = `🚨 URGENT: No License Available for Order #${orderId}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
          .alert-box { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .order-info { background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 20px; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🚨 URGENT: License Shortage</h1>
          </div>
          
          <div class="content">
            <p>Hello Admin,</p>
            
            <div class="alert-box">
              <h3 style="margin: 0 0 10px 0; color: #991b1b;">⚠️ Critical Issue</h3>
              <p style="margin: 0;">
                A customer has purchased <strong>${softwareName}</strong> but <strong>NO LICENSE KEYS ARE AVAILABLE</strong> to fulfill the order.
              </p>
            </div>
            
            <div class="order-info">
              <h4 style="margin: 0 0 10px 0;">Order Information</h4>
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
              <p style="margin: 5px 0;"><strong>Customer Email:</strong> ${customerEmail}</p>
              <p style="margin: 5px 0;"><strong>Software ID:</strong> ${softwareId}</p>
              <p style="margin: 5px 0;"><strong>Software Name:</strong> ${softwareName}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p><strong style="color: #ef4444;">IMMEDIATE ACTION REQUIRED:</strong></p>
            <ol>
              <li><strong>Add license keys immediately</strong> to fulfill this order</li>
              <li><strong>Contact the customer</strong> at ${customerEmail} to inform them of the delay</li>
              <li><strong>Manually assign a license</strong> once keys are available</li>
              <li><strong>Consider offering compensation</strong> for the inconvenience</li>
            </ol>
            
            <p style="background-color: #fef3c7; padding: 15px; border-radius: 4px; margin-top: 20px;">
              <strong>Note:</strong> The order was successfully created and payment was processed, but the license key could not be assigned automatically. The customer has NOT received their activation key yet.
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated critical alert from Sara Mobiles and Electronics  License Management System</p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `

    await sendEmail({
      to: adminEmail,
      subject,
      html
    })

    console.log(`📧 No license alert sent to admin: ${adminEmail}`)
    return true
  } catch (error) {
    console.error('❌ Failed to send no license alert:', error)
    return false
  }
}

/**
 * Check license inventory and send alert if low
 */
export async function checkAndAlertLowInventory(
  softwareId: string,
  softwareName: string,
  threshold: number = 5
): Promise<boolean> {
  try {
    const availableCount = await getAvailableLicenseCount(softwareId)

    if (availableCount <= threshold && availableCount > 0) {
      await sendLowLicenseAlert(softwareId, softwareName, availableCount, threshold)
      return true
    }

    return false
  } catch (error) {
    console.error('Error checking license inventory:', error)
    return false
  }
}
