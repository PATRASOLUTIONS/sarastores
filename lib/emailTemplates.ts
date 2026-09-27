export interface EmailData {
  orderNumber: string;
  customerName: string;
  status?: string;
  trackingNumber?: string;
  orderDetails?: {
    total: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      type?: string;
    }>;
    shippingAddress?: string;
    softwareLicenses?: Array<{
      softwareName: string;
      keys: Array<{
        key: string;
        validityYears: number;
        expiresAt: Date;
      }>;
    }>;
  };
  reason?: string;
  note?: string;
  activationCodes?: Array<{
    softwareName: string;
    activationCode: string;
    validity: string;
    expiresAt: string;
  }>;
  orderDate?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export const emailTemplates = {
  ORDER_PENDING: {
    subject: "Order Confirmed! #{orderNumber} ✅",
    html: (data: EmailData) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light">
        <title>Order Confirmation - ${data.orderNumber}</title>
        <style>
          :root {
            color-scheme: light only;
            supported-color-schemes: light;
          }
          body {
            color-scheme: light only !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;"></div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Thank you for your purchase</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
              Hello <strong>${data.customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
              Thank you for your order! We've received your order <strong style="color: #10b981;">#${data.orderNumber}</strong> and will start processing it shortly.
            </p>
            
            <!-- Order Summary Box -->
            <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #065f46; font-size: 18px; font-weight: 600;">📋 Order Summary</h3>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="color: #4b5563; font-size: 15px;">Order Number:</span>
                <span style="color: #1f2937; font-weight: 600; font-size: 15px;">#${data.orderNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #6ee7b7;">
                <span style="color: #4b5563; font-size: 15px;">Order Total:</span>
                <span style="color: #059669; font-weight: 700; font-size: 20px;">₹${data.orderDetails?.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <!-- Items List -->
            ${data.orderDetails?.items && data.orderDetails.items.length > 0 ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">🛍️ Order Items</h3>
                ${data.orderDetails.items.map(item => `
                  <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="color: #1f2937; font-weight: 600; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
                        <div style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</div>
                      </div>
                      <div style="color: #059669; font-weight: 600; font-size: 16px;">₹${(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <!-- What's Next -->
            <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">📌 What Happens Next?</h3>
              <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.8;">
                <li>We'll review and confirm your order</li>
                <li>Your order will be processed within 24 hours</li>
                <li>You'll receive an email when we start preparing your items</li>
                <li>Track your order status anytime in your account</li>
              </ul>
            </div>
            
            <!-- Shipping Address -->
            ${data.orderDetails?.shippingAddress ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">📍 Shipping Address</h3>
                <div style="background: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; color: #4b5563; line-height: 1.6;">
                  ${data.orderDetails.shippingAddress}
                </div>
              </div>
            ` : ''}
            
            <!-- Support Info -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Need help with your order?</p>
              <p style="margin: 0; color: #10b981; font-weight: 600; font-size: 15px;">
                📧 sales.systechdigital@gmail.com | 📞 +91 78920 51553
              </p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 25px 0 0 0;">
              Thank you for choosing Sara Mobiles and Electronics ! We're excited to serve you.
            </p>
            
            <p style="font-size: 15px; color: #1f2937; margin: 20px 0 0 0; font-weight: 500;">
              Best regards,<br>
              <strong style="color: #10b981;">The Sara Mobiles and Electronics  Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 13px;">
              © ${new Date().getFullYear()} Sara Mobiles and Electronics . All rights reserved.
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.5;">
              This email was sent to ${data.customerName} regarding order #${data.orderNumber}<br>
              If you have any questions, please don't hesitate to contact us.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  ORDER_PROCESSING: {
    subject: "Your Order #{orderNumber} is Being Processed! 📦",
    html: (data: EmailData) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light">
        <title>Order Processing - ${data.orderNumber}</title>
        <style>
          :root {
            color-scheme: light only;
            supported-color-schemes: light;
          }
          body {
            color-scheme: light only !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 0;">
            <div style="font-size: 48px; margin-bottom: 10px;">⚙️</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Order Processing</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">We're preparing your order</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
              Hello <strong>${data.customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
              Great news! Your order <strong style="color: #3b82f6;">#${data.orderNumber}</strong> is now being processed by our team. We're carefully preparing your items for shipment.
            </p>
            
            <!-- Order Summary Box -->
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px; font-weight: 600;">📋 Order Summary</h3>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="color: #4b5563; font-size: 15px;">Order Number:</span>
                <span style="color: #1f2937; font-weight: 600; font-size: 15px;">#${data.orderNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #bfdbfe;">
                <span style="color: #4b5563; font-size: 15px;">Order Total:</span>
                <span style="color: #059669; font-weight: 700; font-size: 20px;">₹${data.orderDetails?.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <!-- Items List -->
            ${data.orderDetails?.items && data.orderDetails.items.length > 0 ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">📦 Items Being Prepared</h3>
                ${data.orderDetails.items.map(item => `
                  <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="color: #1f2937; font-weight: 600; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
                        <div style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</div>
                      </div>
                      <div style="color: #059669; font-weight: 600; font-size: 16px;">₹${(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <!-- What's Next -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">⏱️ What's Next?</h3>
              <ul style="margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
                <li>Our team is carefully picking and packing your items</li>
                <li>Quality check will be performed before shipping</li>
                <li>You'll receive a shipping confirmation email with tracking details</li>
                <li>Estimated processing time: 1-2 business days</li>
              </ul>
            </div>
            
            <!-- Shipping Address -->
            ${data.orderDetails?.shippingAddress ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">📍 Shipping Address</h3>
                <div style="background: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; color: #4b5563; line-height: 1.6;">
                  ${data.orderDetails.shippingAddress}
                </div>
              </div>
            ` : ''}
            
            <!-- Support Info -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Need help with your order?</p>
              <p style="margin: 0; color: #3b82f6; font-weight: 600; font-size: 15px;">
                📧 sales.systechdigital@gmail.com | 📞 +91 78920 51553
              </p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 25px 0 0 0;">
              Thank you for choosing Sara Mobiles and Electronics ! We appreciate your business and look forward to serving you.
            </p>
            
            <p style="font-size: 15px; color: #1f2937; margin: 20px 0 0 0; font-weight: 500;">
              Best regards,<br>
              <strong style="color: #3b82f6;">The Sara Mobiles and Electronics  Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center; border-radius: 0;">
            <p style="margin: 0 0 10px 0; font-size: 13px;">
              © ${new Date().getFullYear()} Sara Mobiles and Electronics . All rights reserved.
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.5;">
              This email was sent to ${data.customerName} regarding order #${data.orderNumber}<br>
              If you have any questions, please don't hesitate to contact us.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  ORDER_SHIPPED: {
    subject: "Your Order #{orderNumber} Has Shipped! 🚚",
    html: (data: EmailData) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light">
        <title>Order Shipped - ${data.orderNumber}</title>
        <style>
          :root {
            color-scheme: light only;
            supported-color-schemes: light;
          }
          body {
            color-scheme: light only !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🚚</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Your Order Has Shipped!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Your package is on its way</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
              Hello <strong>${data.customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
              Great news! Your order <strong style="color: #8b5cf6;">#${data.orderNumber}</strong> has been shipped and is on its way to you!
            </p>
            
            <!-- Tracking Info Box -->
            <div style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #6b21a8; font-size: 18px; font-weight: 600;">📦 Tracking Information</h3>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="color: #4b5563; font-size: 15px;">Order Number:</span>
                <span style="color: #1f2937; font-weight: 600; font-size: 15px;">#${data.orderNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #c4b5fd;">
                <span style="color: #4b5563; font-size: 15px;">Tracking Number:</span>
                <span style="color: #8b5cf6; font-weight: 700; font-size: 18px;">${data.trackingNumber || 'N/A'}</span>
              </div>
            </div>
            
            <!-- Items List -->
            ${data.orderDetails?.items && data.orderDetails.items.length > 0 ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">📦 Shipped Items</h3>
                ${data.orderDetails.items.map(item => `
                  <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="color: #1f2937; font-weight: 600; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
                        <div style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</div>
                      </div>
                      <div style="color: #059669; font-weight: 600; font-size: 16px;">₹${(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <!-- Delivery Info -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">🚚 Delivery Information</h3>
              <ul style="margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
                <li>Estimated delivery: 7 - 8 business days</li>
                <li>You can track your package using the tracking number above</li>
                <li>You'll receive an email when your order is delivered</li>
                <li>Someone should be available to receive the package</li>
              </ul>
            </div>
            
            <!-- Shipping Address -->
            ${data.orderDetails?.shippingAddress ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">📍 Shipping To</h3>
                <div style="background: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; color: #4b5563; line-height: 1.6;">
                  ${data.orderDetails.shippingAddress}
                </div>
              </div>
            ` : ''}
            
            <!-- CTA Button - Only for Shipped Status -->
           <div style="text-align: center; margin: 35px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/orders" 
                 style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3);">
                 Track Your Order
               </a>
            </div>
            
            <!-- Support Info -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Need help with your delivery?</p>
              <p style="margin: 0; color: #8b5cf6; font-weight: 600; font-size: 15px;">
                📧 sales.systechdigital@gmail.com | 📞 +91 78920 51553
              </p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 25px 0 0 0;">
              Thank you for shopping with Sara Mobiles and Electronics ! We hope you enjoy your purchase.
            </p>
            
            <p style="font-size: 15px; color: #1f2937; margin: 20px 0 0 0; font-weight: 500;">
              Best regards,<br>
              <strong style="color: #8b5cf6;">The Sara Mobiles and Electronics  Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 13px;">
              © ${new Date().getFullYear()} Sara Mobiles and Electronics . All rights reserved.
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.5;">
              This email was sent to ${data.customerName} regarding order #${data.orderNumber}<br>
              If you have any questions, please don't hesitate to contact us.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  ORDER_DELIVERED: {
    subject: "Order #{orderNumber} Delivered Successfully! 🎉",
    html: (data: EmailData) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light">
        <title>Order Delivered - ${data.orderNumber}</title>
        <style>
          :root {
            color-scheme: light only;
            supported-color-schemes: light;
          }
          body {
            color-scheme: light only !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Order Delivered!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Your package has arrived</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
              Hello <strong>${data.customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
              Wonderful news! Your order <strong style="color: #10b981;">#${data.orderNumber}</strong> has been successfully delivered. We hope you love your purchase!
            </p>
            
            <!-- Delivery Confirmation Box -->
            <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <div style="font-size: 64px; margin-bottom: 10px;">✓</div>
              <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 20px; font-weight: 600;">Delivery Confirmed</h3>
              <p style="margin: 0; color: #047857; font-size: 15px;">Order #${data.orderNumber}</p>
            </div>
            
            <!-- Items List -->
            ${data.orderDetails?.items && data.orderDetails.items.length > 0 ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">📦 Delivered Items</h3>
                ${data.orderDetails.items.map(item => `
                  <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="color: #1f2937; font-weight: 600; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
                        <div style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</div>
                      </div>
                      <div style="color: #059669; font-weight: 600; font-size: 16px;">₹${(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <!-- Review Request -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">⭐ We'd Love Your Feedback!</h3>
              <p style="margin: 0; color: #78350f; line-height: 1.6;">
                Your opinion matters to us! Please take a moment to rate your purchase and share your experience. Your feedback helps us serve you better.
              </p>
            </div>
            
            <!-- Support Info -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Have any issues with your order?</p>
              <p style="margin: 0; color: #10b981; font-weight: 600; font-size: 15px;">
                📧 sales.systechdigital@gmail.com | 📞 +91 78920 51553
              </p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 25px 0 0 0;">
              Thank you for choosing Sara Mobiles and Electronics ! We appreciate your business and look forward to serving you again.
            </p>
            
            <p style="font-size: 15px; color: #1f2937; margin: 20px 0 0 0; font-weight: 500;">
              Best regards,<br>
              <strong style="color: #10b981;">The Sara Mobiles and Electronics  Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 13px;">
              © ${new Date().getFullYear()} Sara Mobiles and Electronics . All rights reserved.
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.5;">
              This email was sent to ${data.customerName} regarding order #${data.orderNumber}<br>
              If you have any questions, please don't hesitate to contact us.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  ORDER_CANCELLED: {
    subject: "Order #{orderNumber} Cancelled ❌",
    html: (data: EmailData) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light">
        <title>Order Cancelled - ${data.orderNumber}</title>
        <style>
          :root {
            color-scheme: light only;
            supported-color-schemes: light;
          }
          body {
            color-scheme: light only !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Order Cancelled</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Your order has been cancelled</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
              Hello <strong>${data.customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
              We're writing to inform you that your order <strong style="color: #ef4444;">#${data.orderNumber}</strong> has been cancelled.
            </p>
            
            <!-- Cancellation Info Box -->
            <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #991b1b; font-size: 18px; font-weight: 600;">📋 Cancellation Details</h3>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="color: #4b5563; font-size: 15px;">Order Number:</span>
                <span style="color: #1f2937; font-weight: 600; font-size: 15px;">#${data.orderNumber}</span>
              </div>
              ${data.reason ? `
                <div style="padding-top: 12px; border-top: 1px solid #fca5a5;">
                  <div style="color: #4b5563; font-size: 14px; margin-bottom: 5px;">Cancellation Reason:</div>
                  <div style="color: #991b1b; font-weight: 600; font-size: 15px;">${data.reason}</div>
                </div>
              ` : ''}
              ${data.note ? `
                <div style="padding-top: 12px; border-top: 1px solid #fca5a5; margin-top: 10px;">
                  <div style="color: #4b5563; font-size: 14px; margin-bottom: 5px;">Additional Notes:</div>
                  <div style="color: #6b7280; font-size: 14px; line-height: 1.6;">${data.note}</div>
                </div>
              ` : ''}
            </div>
            
            <!-- Items List -->
            ${data.orderDetails?.items && data.orderDetails.items.length > 0 ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">📦 Cancelled Items</h3>
                ${data.orderDetails.items.map(item => `
                  <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="color: #1f2937; font-weight: 600; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
                        <div style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</div>
                      </div>
                      <div style="color: #6b7280; font-weight: 600; font-size: 16px;">₹${(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <!-- Refund Info -->
            <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">💳 Refund Information</h3>
              <p style="margin: 0; color: #1e3a8a; line-height: 1.6;">
                If you've already made a payment, a full refund will be processed to your original payment method within 7-8 business days.
              </p>
            </div>
            
            <!-- Support Info -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Have questions about this cancellation?</p>
              <p style="margin: 0; color: #ef4444; font-weight: 600; font-size: 15px;">
                📧 sales.systechdigital@gmail.com | 📞 +91 78920 51553
              </p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 25px 0 0 0;">
              We're sorry to see this order cancelled. If you have any questions or concerns, please don't hesitate to reach out to our support team. We're here to help!
            </p>
            
            <p style="font-size: 15px; color: #1f2937; margin: 20px 0 0 0; font-weight: 500;">
              Best regards,<br>
              <strong style="color: #ef4444;">The Sara Mobiles and Electronics  Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 13px;">
              © ${new Date().getFullYear()} Sara Mobiles and Electronics . All rights reserved.
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.5;">
              This email was sent to ${data.customerName} regarding order #${data.orderNumber}<br>
              If you have any questions, please don't hesitate to contact us.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  SOFTWARE_LICENSE_KEYS: {
    subject: "Your Software License Keys - Order #{orderNumber}",
    html: (data: any) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light">
        <title>Your Software License Keys - Order #${data.orderNumber}</title>
        <style>
          :root { color-scheme: light only; }
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .activation-code { 
            background: #fff; 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin: 10px 0; 
            border-radius: 5px;
            font-family: monospace;
            word-break: break-all;
          }
          .footer { 
            margin-top: 20px; 
            padding: 10px; 
            text-align: center; 
            font-size: 12px; 
            color: #666; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Software License Keys</h1>
            <p>Order #${data.orderNumber} • ${data.orderDate}</p>
          </div>
          
          <div class="content">
            <p>Dear ${data.customerName},</p>
            
            <p>Thank you for your purchase! Below are your software license keys:</p>
            
            ${data.activationCodes.map((item: any) => `
              <div style="margin: 20px 0;">
                <h3>${item.softwareName}</h3>
                <div class="activation-code">
                  <strong>Activation Code:</strong> ${item.activationCode}<br>
                  <strong>Validity:</strong> ${item.validity}<br>
                  <strong>Expires:</strong> ${item.expiresAt}
                </div>
              </div>
            `).join('')}
            
            <p><strong>How to Activate:</strong></p>
            <ol>
              <li>Download and install the software from our website</li>
              <li>Launch the application</li>
              <li>Enter the activation code when prompted</li>
              <li>Complete the activation process</li>
            </ol>
            
            <p>If you need any assistance, please contact our support team at ${data.supportEmail} or call us at ${data.supportPhone}.</p>
            
            <p>Thank you for choosing us!</p>
            
            <p>Best regards,<br>Customer Support Team</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  SOFTWARE_ACTIVATION_KEY: {
    subject: "Your Activation Key for #{softwareName} - Order #{orderNumber}",
    html: (data: {
      customerName: string
      orderNumber: string
      softwareName: string
      licenseKey: string
      validity: string
      maxDevice: number
      companyName?: string
    }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light">
        <title>Your Activation Key - ${data.softwareName}</title>
        <style>
          :root {
            color-scheme: light only;
            supported-color-schemes: light;
          }
          body {
            color-scheme: light only !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🔑</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Your Activation Key is Ready!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Software license delivered instantly</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
              Hi <strong>${data.customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
              Thank you for purchasing <strong style="color: #667eea;">${data.softwareName}</strong>.
            </p>
            
            <!-- License Key Box -->
            <div style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-left: 4px solid #667eea; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #5b21b6; font-size: 18px; font-weight: 600; text-align: center;">
                🎯 Your Activation Key
              </h3>
              
              <div style="background: white; padding: 20px; border-radius: 6px; text-align: center;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">License Key</div>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #1f2937; letter-spacing: 2px; word-break: break-all; border: 2px dashed #667eea;">
                  ${data.licenseKey}
                </div>
              </div>
              
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #c4b5fd;">
                <div style="display: flex; justify-content: space-around; text-align: center;">
                  <div>
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">Validity</div>
                    <div style="font-size: 16px; font-weight: 600; color: #5b21b6;">${data.validity} days</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">Max Devices</div>
                    <div style="font-size: 16px; font-weight: 600; color: #5b21b6;">${data.maxDevice}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Order Info -->
            <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 25px 0; border: 1px solid #e5e7eb;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6b7280; font-size: 14px;">Order Number:</span>
                <span style="color: #1f2937; font-weight: 600; font-size: 14px;">#${data.orderNumber}</span>
              </div>
            </div>
            
            <!-- How to Activate -->
            <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">🚀 How to Activate</h3>
              <ol style="margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.8;">
                <li>Download and install the software from our website</li>
                <li>Launch the application</li>
                <li>Enter your activation key when prompted</li>
                <li>Complete the activation process</li>
              </ol>
            </div>
            
            <!-- Important Notice -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">⚠️ Important</h3>
              <ul style="margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
                <li>This key is valid for <strong>${data.validity} days</strong></li>
                <li>Supports up to <strong>${data.maxDevice} device(s)</strong></li>
                <li>Keep this key secure and do not share it</li>
                <li>Save this email for your records</li>
              </ul>
            </div>
            
            <!-- Support Info -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Need help with activation?</p>
              <p style="margin: 0; color: #667eea; font-weight: 600; font-size: 15px;">
                📧 sales.systechdigital@gmail.com | 📞 +91 78920 51553
              </p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 25px 0 0 0;">
              Thank you for choosing ${data.companyName || 'Sara Mobiles and Electronics '}! We hope you enjoy your software.
            </p>
            
            <p style="font-size: 15px; color: #1f2937; margin: 20px 0 0 0; font-weight: 500;">
              Best regards,<br>
              <strong style="color: #667eea;">The ${data.companyName || 'Sara Mobiles and Electronics '} Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 13px;">
              © ${new Date().getFullYear()} ${data.companyName || 'Sara Mobiles and Electronics '}. All rights reserved.
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.5;">
              This email contains your software activation key for order #${data.orderNumber}<br>
              Please keep this email for your records.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  CART_ABANDONMENT: {
    subject: "You forgot something amazing in your cart! 🛒",
    html: (data: { customerName: string; cartUrl: string; items: Array<{ name: string; image: string; price: number; quantity: number }> }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Items in your cart</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🛒</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Did you forget something?</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Your items are waiting for you</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
              Hi <strong>${data.customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
              We noticed you left some great items in your cart. They're selling out fast, so grab them while you can!
            </p>
            
            <!-- Items List -->
            <div style="margin: 25px 0;">
              <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">📦 Your Cart Items</h3>
              ${data.items.map(item => `
                <div style="background: #fff; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 15px;">
                  <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                  <div style="flex: 1;">
                    <div style="color: #1f2937; font-weight: 600; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
                    <div style="color: #6b7280; font-size: 14px;">Qty: ${item.quantity} × ₹${item.price.toLocaleString('en-IN')}</div>
                  </div>
                  <div style="color: #d97706; font-weight: 600; font-size: 16px;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
                </div>
              `).join('')}
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${data.cartUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3); transition: transform 0.2s;">
                 Complete Your Purchase
               </a>
            </div>
            
            <div style="background: #fffbeb; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; text-align: center; color: #92400e; font-size: 14px;">
              🛡️ Checkout is secure and takes less than a minute.
            </div>
            
            <p style="font-size: 15px; color: #1f2937; margin: 30px 0 0 0; text-align: center;">
              Best regards,<br>
              <strong>The Sara Mobiles and Electronics Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
            <p style="margin: 0; font-size: 12px; line-height: 1.5;">
              If you have any questions, reply to this email or visit our help center.<br>
              © ${new Date().getFullYear()} Sara Mobiles and Electronics.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

export type EmailTemplateId = keyof typeof emailTemplates

export const getEmailTemplate = (templateId: EmailTemplateId, data: EmailData) => {
  const template = emailTemplates[templateId];
  if (!template) {
    throw new Error(`Email template ${templateId} not found`);
  }
  return template.html(data);
};

export const getEmailSubject = (templateId: EmailTemplateId, orderNumber: string) => {
  const template = emailTemplates[templateId];
  if (!template) {
    throw new Error(`Email template ${templateId} not found`);
  }
  return template.subject.replace('#{orderNumber}', orderNumber);
};

export const getEmailTemplateId = (status: string): EmailTemplateId => {
  switch (status) {
    case 'pending':
      return 'ORDER_PENDING'
    case 'processing':
      return 'ORDER_PROCESSING'
    case 'shipped':
      return 'ORDER_SHIPPED'
    case 'delivered':
      return 'ORDER_DELIVERED'
    case 'cancelled':
      return 'ORDER_CANCELLED'
    default:
      return 'ORDER_PROCESSING'
  }
}

export function getSoftwareLicenseEmailTemplate(data: {
  customerName: string
  orderNumber: string
  softwareLicenses: Array<{
    softwareName: string
    keys: Array<{
      key: string
      validityYears: number
      expiresAt: Date
    }>
  }>
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>Your Software License Keys</title>
      <style>
        :root {
          color-scheme: light only;
          supported-color-schemes: light;
        }
        body {
          color-scheme: light only !important;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">🔑</div>
          <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Your License Keys Are Ready!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Software licenses delivered instantly</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
            Hello <strong>${data.customerName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
            Thank you for your software purchase! Your license keys for order <strong style="color: #667eea;">#${data.orderNumber}</strong> are ready to use.
          </p>
          
          ${data.softwareLicenses.map(software => `
            <!-- Software License Section -->
            <div style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #5b21b6; font-size: 18px; font-weight: 600;">
                📦 ${software.softwareName}
              </h3>
              
              ${software.keys.map((keyData, idx) => `
                <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: ${idx < software.keys.length - 1 ? '10px' : '0'};">
                  <div style="margin-bottom: 10px;">
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">LICENSE KEY ${idx + 1}:</div>
                    <div style="background: #f3f4f6; padding: 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; font-weight: 600; color: #1f2937; letter-spacing: 1px; word-break: break-all;">
                      ${keyData.key}
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280;">
                    <span>⏱️ Validity: <strong>${keyData.validityYears} Year(s)</strong></span>
                    <span>📅 Expires: <strong>${new Date(keyData.expiresAt).toLocaleDateString()}</strong></span>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
          
          <!-- Important Instructions -->
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">⚠️ Important Instructions</h3>
            <ul style="margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
              <li>Save these license keys in a secure location</li>
              <li>Do not share your keys with unauthorized users</li>
              <li>Keys are valid from the date of activation</li>
              <li>Contact support if you face any activation issues</li>
            </ul>
          </div>
          
          <!-- How to Activate -->
          <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">🚀 How to Activate</h3>
            <ol style="margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.8;">
              <li>Download and install the software</li>
              <li>Launch the application</li>
              <li>Enter your license key when prompted</li>
              <li>Complete the activation process</li>
            </ol>
          </div>
          
          <!-- Support Info -->
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Need help with activation?</p>
            <p style="margin: 0; color: #667eea; font-weight: 600; font-size: 15px;">
              📧 sales.systechdigital@gmail.com | 📞 +91 78920 51553
            </p>
          </div>
          
          <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 25px 0 0 0;">
            Thank you for choosing Sara Mobiles and Electronics ! We hope you enjoy your software.
          </p>
          
          <p style="font-size: 15px; color: #1f2937; margin: 20px 0 0 0; font-weight: 500;">
            Best regards,<br>
            <strong style="color: #667eea;">The Sara Mobiles and Electronics  Team</strong>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 13px;">
            © ${new Date().getFullYear()} Sara Mobiles and Electronics . All rights reserved.
          </p>
          <p style="margin: 0; font-size: 12px; line-height: 1.5;">
            This email contains your software license keys for order #${data.orderNumber}<br>
            Please keep this email for your records.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}