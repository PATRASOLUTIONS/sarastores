import nodemailer from "nodemailer"
import jsPDF from "jspdf"

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number.parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log(`[EMAIL_SEND_ATTEMPT] Preparing to send email:`)
      console.log(`  Subject: ${subject}`)
      console.log(`  HTML size: ${html.length} characters`)
      console.log(`  Attachments: ${attachments ? attachments.length : 0}`)
    }
    
    const mailOptions: any = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments
    }

    const result = await transporter.sendMail(mailOptions)
    
    return { success: true, result }
  } catch (error) {
    console.error(`[EMAIL_SEND_ERROR] Failed to send email:`)
    console.error(`[EMAIL_ERROR_DETAILS]`, error instanceof Error ? error.message : String(error))
    if (process.env.NODE_ENV === "development") {
      console.error(`[EMAIL_ERROR_STACK]`, error)
      console.error(`[EMAIL_CONFIG_CHECK]`)
      console.error(`  SMTP_HOST: ${process.env.SMTP_HOST ? 'set' : 'NOT SET'}`)
      console.error(`  SMTP_PORT: ${process.env.SMTP_PORT ? 'set' : 'NOT SET'}`)
      console.error(`  SMTP_USER: ${process.env.SMTP_USER ? 'set' : 'NOT SET'}`)
      console.error(`  SMTP_PASS: ${process.env.SMTP_PASS ? 'set' : 'NOT SET'}`)
      console.error(`  EMAIL_FROM: ${process.env.EMAIL_FROM ? 'set' : 'NOT SET'}`)
    }
    
    return { success: false, error }
  }
}

export function getRegistrationEmailTemplate(name: string) {
  const safeName = escapeHtml(name)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>Welcome to Sara Mobiles and Electronics </title>
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
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; font-weight: bold;">🎉 Welcome to Sara Mobiles and Electronics !</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your shopping journey begins here</p>
        </div>
        
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 24px;">Hello ${safeName}! 👋</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Thank you for joining the Sara Mobiles and Electronics  family! Your account has been successfully created and you're now ready to explore our amazing collection of products.
          </p>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">🚀 What you can do now:</h3>
            <ul style="margin: 15px 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">🛍️ Browse our wide selection of premium products</li>
              <li style="margin-bottom: 8px;">❤️ Add your favorite items to wishlist</li>
              <li style="margin-bottom: 8px;">🛒 Add products to cart and checkout securely</li>
              <li style="margin-bottom: 8px;">📦 Track your orders in real-time</li>
              <li style="margin-bottom: 8px;">🎁 Enjoy exclusive offers and discounts</li>
              <li style="margin-bottom: 8px;">⭐ Rate and review products</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}" 
               style="background: linear-gradient(135deg, #1e40af, #3b82f6); 
                      color: white; 
                      padding: 15px 35px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block; 
                      font-weight: bold; 
                      font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                      transition: all 0.3s ease;">
              🛍️ Start Shopping Now
            </a>
          </div>
          
          <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="color: #0277bd; margin-top: 0;">💡 Pro Tips:</h4>
            <p style="margin: 10px 0; font-size: 14px;">
              • Sign in before adding items to cart for a seamless experience<br>
              • Check out our daily deals and special offers<br>
              • Follow us on social media for the latest updates
            </p>
          </div>
          
          <p style="font-size: 16px; margin: 25px 0;">
            If you have any questions or need assistance, our friendly support team is here to help. Just reply to this email or contact us through our website.
          </p>
          
          <p style="font-size: 16px; margin: 25px 0 0 0;">
            Happy Shopping! 🛒<br>
            <strong>The Sara Mobiles and Electronics  Team</strong>
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            This email was sent to ${safeName} because you created an account on Sara Mobiles and Electronics .<br>
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function getOrderConfirmationEmailTemplate(order: any) {
  const itemsHtml = order.items
    .map(
      (item: any) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <img src="${escapeHtml(String(item.image || ''))}" alt="${escapeHtml(item.name)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toLocaleString("en-IN")}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price * item.quantity).toLocaleString("en-IN")}</td>
    </tr>
  `,
    )
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>Order Confirmation - ${order.id}</title>
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
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Order Confirmed!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Order #${order.id}</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #059669;">Thank you for your order, ${escapeHtml(order.customer.firstName)}!</h2>
          <p>Your order has been confirmed and will be processed shortly.</p>
          
          <h3>Order Details:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="padding: 10px; text-align: left;">Image</th>
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Summary:</h3>
            <div style="display: flex; justify-content: space-between; margin: 10px 0;">
              <span>Subtotal:</span>
              <span>₹${order.subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 10px 0;">
              <span>Tax (18% GST):</span>
              <span>₹${order.tax.toLocaleString("en-IN")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 10px 0;">
              <span>Shipping:</span>
              <span>₹${order.shipping.toLocaleString("en-IN")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 10px 0; font-weight: bold; font-size: 18px; border-top: 2px solid #059669; padding-top: 10px;">
              <span>Total:</span>
              <span>₹${order.total.toLocaleString("en-IN")}</span>
            </div>
          </div>
          
          <h3>Shipping Address:</h3>
          <div style="background: white; padding: 15px; border-radius: 5px;">
            <p>${escapeHtml(order.customer.firstName)} ${escapeHtml(order.customer.lastName)}<br>
            ${escapeHtml(order.customer.address)}<br>
            ${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.state)} ${escapeHtml(order.customer.zipCode)}<br>
            ${escapeHtml(order.customer.country)}</p>
          </div>
          
          <p style="margin-top: 30px;">We'll send you another email when your order ships.</p>
          <p>Thank you for shopping with Sara Mobiles and Electronics !</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function getVendorOrderNotificationTemplate(order: any) {
  const itemsHtml = order.items
    .map(
      (item: any) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toLocaleString("en-IN")}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price * item.quantity).toLocaleString("en-IN")}</td>
    </tr>
  `,
    )
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>New Order Received - ${order.id}</title>
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
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">New Order Received!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Order #${order.id}</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #dc2626;">Order Details:</h2>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Customer Information:</h3>
            <p><strong>Name:</strong> ${escapeHtml(order.customer.firstName)} ${escapeHtml(order.customer.lastName)}<br>
            <strong>Email:</strong> ${escapeHtml(order.customer.email)}<br>
            <strong>Phone:</strong> ${escapeHtml(order.customer.phone || "Not provided")}</p>
            
            <h3>Shipping Address:</h3>
            <p>${escapeHtml(order.customer.address)}<br>
            ${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.state)} ${escapeHtml(order.customer.zipCode)}<br>
            ${escapeHtml(order.customer.country)}</p>
          </div>
          
          <h3>Items Ordered:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Summary:</h3>
            <div style="display: flex; justify-content: space-between; margin: 10px 0; font-weight: bold; font-size: 18px;">
              <span>Total Amount:</span>
              <span>₹${order.total.toLocaleString("en-IN")}</span>
            </div>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Payment Status:</strong> ${order.paymentDetails?.status || "Completed"}</p>
          </div>
          
          <p style="color: #dc2626; font-weight: bold;">Please process this order as soon as possible.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function generateInvoicePDF(order: any): Buffer {
  const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        .container {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .logo {
          width: 100px;
          height: 100px;
          border: 1px solid #000;
        }
        .details {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .address {
          margin-bottom: 10px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .items-table th, .items-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #000;
        }
        .items-table th {
          background-color: #e5e7eb;
        }
        .items-table tr:nth-child(even) {
          background-color: #f5f5f5;
        }
        .summary {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          margin-top: 20px;
        }
        .summary-item {
          margin-bottom: 10px;
        }
        .summary-item span {
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/sara-logo.png" alt="SARA" width="140">
          </div>
          <div class="details">
            <div class="address">
              <p>Shipto Inc.</p>
              <p>123 Main Street</p>
              <p>City, State, ZIP</p>
            </div>
            <div>
              <p>Order #${order.id}</p>
              <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        <table class="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item: any) => `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toLocaleString("en-IN")}</td>
                <td>₹${(item.price * item.quantity).toLocaleString("en-IN")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="summary">
          <div class="summary-item">
            <span>Subtotal:</span>
            <span>₹${order.subtotal.toLocaleString("en-IN")}</span>
          </div>
          <div class="summary-item">
            <span>Tax:</span>
            <span>₹${order.taxAmount.toLocaleString("en-IN")}</span>
          </div>
          <div class="summary-item">
            <span>Total Amount:</span>
            <span>₹${order.total.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </body>
    </html>`;

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.html(html, {
    callback: function (doc) {
      doc.save("invoice.pdf");
    },
    x: 10,
    y: 10,
    width: pageWidth - 20,
  });

  // Apply some professional styling
  doc.setLineWidth(1)
  doc.line(20, 70, pageWidth - 20, 70)
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.setFillColor(240, 240, 240)
  doc.setTextColor(20, 20, 20)
  doc.rect(20, 67, pageWidth - 40, 25, "F")
  doc.text("INVOICE", 25, 77)

  // Simple header - matches email template style
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("INVOICE", 20, 30)

  // Company info - simple and clean
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Sara Mobiles and Electronics ", 20, 45)
  doc.text("123 Business Street, Mumbai, Maharashtra 400001", 20, 55)
  doc.text("India | Phone: +91 78920 51553 | Email: sales.systechdigital@gmail.com", 20, 65)

  // Invoice details - right aligned, simple
  doc.setFontSize(10)
  doc.text(`Invoice #: ${order.id}`, pageWidth - 20, 45, { align: "right" })
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, pageWidth - 20, 55, { align: "right" })
  doc.text(`Status: ${order.status}`, pageWidth - 20, 65, { align: "right" })

  // Customer info section
  let y = 85
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("Bill To:", 20, y)
  y += 15

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`${escapeHtml(order.customer.firstName)} ${escapeHtml(order.customer.lastName)}`, 20, y)
  y += 12
  doc.text(escapeHtml(order.customer.email), 20, y)
  y += 12
  if (order.customer.phone) {
    doc.text(`Phone: ${escapeHtml(order.customer.phone)}`, 20, y)
    y += 12
  }
  doc.text(escapeHtml(order.customer.address), 20, y)
  y += 12
  doc.text(`${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.state)} ${escapeHtml(order.customer.zipCode)}`, 20, y)
  y += 12
  doc.text(escapeHtml(order.customer.country), 20, y)
  y += 20

  // Order items - simple list format
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("Order Items:", 20, y)
  y += 15

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  order.items.forEach((item: any, index: number) => {
    doc.text(`${index + 1}. ${escapeHtml(item.name)}`, 20, y)
    doc.text(`Qty: ${item.quantity} × ₹${item.price.toLocaleString("en-IN")}`, 20, y + 5)
    doc.text(`₹${(item.price * item.quantity).toLocaleString("en-IN")}`, pageWidth - 20, y, { align: "right" })
    y += 15
  })

  y += 10

  // Summary - simple and clean
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const summaryX = pageWidth - 80
  doc.text(`Subtotal: ₹${order.subtotal.toLocaleString("en-IN")}`, summaryX, y)
  y += 12
  doc.text(`Tax (18% GST): ₹${order.tax.toLocaleString("en-IN")}`, summaryX, y)
  y += 12
  doc.text(`Shipping: ₹${order.shipping.toLocaleString("en-IN")}`, summaryX, y)
  y += 15

  // Total - highlighted simply
  doc.setFillColor(240, 240, 240)
  doc.rect(summaryX - 5, y - 3, 75, 12, 'F')

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(`Total: ₹${order.total.toLocaleString("en-IN")}`, summaryX, y + 4)

  // Footer - simple and centered
  y += 30
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("Thank you for your business!", 20, y)
  doc.text("For any queries, please contact us at sales.systechdigital@gmail.com", 20, y + 10)

  return Buffer.from(doc.output('arraybuffer'))
}
