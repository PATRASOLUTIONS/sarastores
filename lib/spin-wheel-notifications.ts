import { sendEmail } from "@/lib/email"

// ==================== EMAIL TEMPLATES ====================

export function getOtpEmailTemplate(name: string, otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <title>🔐 OTP Verification - Spin the Wheel</title>
      <style>
        :root { color-scheme: light only; }
        body { color-scheme: light only !important; }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #7c3aed, #a855f7, #ec4899); color: white; padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🔐 OTP Verification</h1>
          <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Spin the Wheel Campaign</p>
        </div>
        
        <div style="padding: 40px 30px;">
          <h2 style="color: #7c3aed; margin-top: 0; font-size: 22px;">Hello ${name}! 👋</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Your One-Time Password (OTP) for the Spin the Wheel campaign is:
          </p>
          
          <div style="background: linear-gradient(135deg, #f5f3ff, #fdf2f8); padding: 30px; border-radius: 12px; margin: 25px 0; text-align: center; border: 2px solid #7c3aed;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP</p>
            <div style="background: #7c3aed; color: white; padding: 15px 25px; border-radius: 8px; display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
              ${otp}
            </div>
          </div>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              ⏱️ This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin: 25px 0 0 0;">
            If you didn't request this OTP, please ignore this email.<br>
            <strong>Sara Mobiles & Electronics Team</strong>
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            This is an automated email from the Spin the Wheel Campaign.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function getSpinWheelWinnerEmailTemplate(
  name: string,
  prize: string,
  couponCode: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <title>🎉 You Won - Spin the Wheel!</title>
      <style>
        :root { color-scheme: light only; }
        body { color-scheme: light only !important; }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #7c3aed, #a855f7, #ec4899); color: white; padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; font-weight: bold;">🎉 Congratulations!</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">You're a Winner!</p>
        </div>
        
        <div style="padding: 40px 30px;">
          <h2 style="color: #7c3aed; margin-top: 0; font-size: 24px;">Hello ${name}! 🎊</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            We are thrilled to announce that you have won in our <strong>Spin the Wheel Campaign</strong>!
          </p>
          
          <div style="background: linear-gradient(135deg, #f5f3ff, #fdf2f8); padding: 30px; border-radius: 12px; margin: 25px 0; text-align: center; border: 2px solid #7c3aed;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Prize</p>
            <h3 style="color: #7c3aed; margin: 0 0 20px 0; font-size: 28px;">🏆 ${prize}</h3>
            
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Coupon Code</p>
            <div style="background: #7c3aed; color: white; padding: 15px 25px; border-radius: 8px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${couponCode}
            </div>
          </div>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h4 style="color: #92400e; margin-top: 0;">📋 How to Claim:</h4>
            <ul style="margin: 10px 0; padding-left: 20px; color: #92400e;">
              <li style="margin-bottom: 8px;">Please share this coupon code at the <strong>billing counter</strong> of the store.</li>
              <li style="margin-bottom: 8px;">This campaign is valid only for <strong>selected offline stores</strong>.</li>
              <li style="margin-bottom: 8px;">Carry a valid <strong>government ID</strong> for verification.</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; margin: 25px 0 0 0;">
            Thank you for participating! 🎉<br>
            <strong>The Sara Mobiles & Electronics Team</strong>
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            This email was sent because you participated in the Spin the Wheel Campaign.<br>
            If you didn't participate, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// ==================== EMAIL FUNCTIONS ====================

export async function sendOtpEmail(email: string, name: string, otp: string) {
  const html = getOtpEmailTemplate(name, otp)
  return sendEmail({
    to: email,
    subject: `🔐 Your OTP: ${otp} - Spin the Wheel Campaign`,
    html
  })
}

export async function sendSpinWheelEmail(
  email: string,
  name: string,
  prize: string,
  couponCode: string
) {
  try {
    console.log(`[EMAIL_SEND_START] Preparing winner email for ${name} (${email}). Prize: ${prize}, Coupon: ${couponCode}`)
    
    const html = getSpinWheelWinnerEmailTemplate(name, prize, couponCode)
    
    console.log(`[EMAIL_TEMPLATE_READY] Email template generated. Characters: ${html.length}`)
    
    const result = await sendEmail({
      to: email,
      subject: `🎉 Congratulations ${name}! You won ${prize} - Spin the Wheel Campaign`,
      html
    })
    
    console.log(`[EMAIL_SEND_SUCCESS] Winner email sent to ${email}. Response:`, result)
    return result
  } catch (error) {
    console.error(`[EMAIL_SEND_ERROR] Failed to send winner email to ${email}:`, error instanceof Error ? error.message : String(error))
    console.error(`[EMAIL_SEND_ERROR_DETAILS]`, error)
    throw error
  }
}

// ==================== WHATSAPP (AskEva) FUNCTIONS ====================

export async function sendWhatsAppOTP(phone: string, otp: string, senderOverride?: string) {
  const apiKey = process.env.ASKEVA_API_KEY
  const apiUrl = process.env.ASKEVA_API_URL
  const senderNumber = senderOverride || process.env.ASKEVA_SENDER_NUMBER

  if (!apiKey || !apiUrl) {
    console.log(`[WhatsApp OTP - Placeholder] To: +91${phone}`)
    console.log(`[WhatsApp OTP - Placeholder] OTP: ${otp}`)
    return { success: true, placeholder: true }
  }

  try {
    console.log(`[WHATSAPP_OTP_VALIDATION] Starting WhatsApp OTP notification:`)
    console.log(`  - Phone: ${phone}`)
    console.log(`  - OTP: ${otp}`)
    console.log(`  - Sender: ${senderNumber}`)
    console.log(`  - API URL: ${apiUrl}`)
    
    // Validate phone format (should be 10 digits)
    if (!/^\d{10}$/.test(phone)) {
      console.error(`[WHATSAPP_OTP_VALIDATION_ERROR] Invalid phone format. Expected 10 digits, got: "${phone}"`)
      return { success: false, error: "Invalid phone format" }
    }

    // OTP payload structure
    const payload: any = {
      to: `91${phone}`,
      type: "template",
      template: {
        language: {
          policy: "deterministic",
          code: "en"
        },
        name: "spin_win_auth",  // Keep original OTP template name
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: otp
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: otp
              }
            ]
          }
        ]
      }
    }

    if (senderNumber) {
      payload.sender = senderNumber
    }

    console.log(`[WHATSAPP_OTP_PAYLOAD] Full payload being sent to AskEva:`)
    console.log(`  To: ${payload.to}`)
    console.log(`  Template Name: ${payload.template.name}`)
    console.log(`  OTP Parameter: ${payload.template.components[0].parameters[0].text}`)
    console.log(`  Sender: ${payload.sender}`)
    console.log(`  Full Payload JSON:`, JSON.stringify(payload, null, 2))

    // Use Authorization header for OTP (this was working before)
    console.log(`[WHATSAPP_OTP_REQUEST] Sending request to AskEva API with Authorization header: ${apiUrl}`)

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })

    console.log(`[WHATSAPP_OTP_RESPONSE_STATUS] HTTP Status: ${response.status} ${response.statusText}`)

    const textData = await response.text()
    let data;
    try {
      data = JSON.parse(textData)
    } catch {
      data = textData.length > 200 ? textData.substring(0, 200) + '... (truncated HTTP response)' : textData
    }

    console.log(`[WHATSAPP_OTP_RESPONSE_DATA] Response from AskEva:`, data)
    
    // Check if response contains messaging_product and messages
    if (data?.messaging_product === 'whatsapp' && data?.messages && data.messages.length > 0) {
      console.log(`[WHATSAPP_OTP_SUCCESS_DETAILED] Message delivered:`)
      data.messages.forEach((msg: any, idx: number) => {
        console.log(`  Message [${idx}] Status: ${msg.message_status}`)
      })
    }

    const isSuccess = response.ok || data?.messaging_product === 'whatsapp'
    
    if (!isSuccess) {
      console.error(`[WHATSAPP_OTP_API_ERROR] Request failed. Status: ${response.status}`)
      console.error(`[WHATSAPP_OTP_API_ERROR_DETAILS]`, data)
      
      if (data?.error) {
        console.error(`[WHATSAPP_OTP_ERROR_REASON]`, data.error)
      }
      if (data?.errors) {
        console.error(`[WHATSAPP_OTP_ERROR_DETAILS]`, data.errors)
      }
    } else {
      console.log(`[WHATSAPP_OTP_SUCCESS] OTP sent successfully to +91${phone}`)
    }

    return { success: isSuccess, data }
  } catch (error) {
    console.error("[WhatsApp OTP] Error:", error)
    return { success: false, error }
  }
}

/**
 * Send winning notification via WhatsApp using AskEva API
 */
export async function sendWhatsAppWinNotification(
  phone: string,
  name: string,
  prize: string,
  couponCode: string,
  senderOverride?: string
) {
  const apiKey = process.env.ASKEVA_API_KEY
  const apiUrl = process.env.ASKEVA_API_URL
  const senderNumber = senderOverride || process.env.ASKEVA_SENDER_NUMBER

  if (!apiKey || !apiUrl) {
    console.log(`[WhatsApp Win - Placeholder] To: +91${phone}`)
    console.log(`[WhatsApp Win - Placeholder] Prize: ${prize}, Coupon: ${couponCode}`)
    return { success: true, placeholder: true }
  }

  try {
    // Validate and log input parameters
    console.log(`[WHATSAPP_WIN_VALIDATION] Starting WhatsApp win notification:`)
    console.log(`  - Phone: ${phone} (format: 10 digits?)`)
    console.log(`  - Name: ${name}`)
    console.log(`  - Prize: ${prize}`)
    console.log(`  - Coupon: ${couponCode}`)
    console.log(`  - Sender: ${senderNumber}`)
    console.log(`  - API URL: ${apiUrl}`)
    
    // Validate phone format (should be 10 digits)
    if (!/^\d{10}$/.test(phone)) {
      console.error(`[WHATSAPP_WIN_VALIDATION_ERROR] Invalid phone format. Expected 10 digits, got: "${phone}"`)
      return { success: false, error: "Invalid phone format" }
    }

    const payload: any = {
      to: `91${phone}`,
      type: "template",
      template: {
        language: {
          policy: "deterministic",
          code: "en"
        },
        name: "spin_win_confirm", // Winning message template
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: name // Variable 1: {{name}}
              },
              {
                type: "text",
                text: prize // Variable 2: {{prize}}
              },
              {
                type: "text",
                text: couponCode // Variable 3: {{CouponCode}}
              }
            ]
          }
        ]
      }
    }

    if (senderNumber) {
      payload.sender = senderNumber
    }

    console.log(`[WHATSAPP_WIN_PAYLOAD] Full payload being sent to AskEva:`)
    console.log(`  To: ${payload.to}`)
    console.log(`  Template Name: ${payload.template.name}`)
    console.log(`  Parameters:`)
    payload.template.components[0].parameters.forEach((param: any, idx: number) => {
      console.log(`    [${idx}] ${param.text}`)
    })
    console.log(`  Sender: ${payload.sender}`)
    console.log(`  Full Payload JSON:`, JSON.stringify(payload, null, 2))

    // Use Authorization header (same method as OTP which works)
    console.log(`[WHATSAPP_WIN_REQUEST] Sending request to AskEva API with Authorization header: ${apiUrl}`)
    console.log(`[WHATSAPP_WIN_REQUEST_DETAILS] Method: POST, Headers will include Authorization Bearer token`)
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })

    console.log(`[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: ${response.status} ${response.statusText}`)

    const textData = await response.text()
    let data;
    try {
      data = JSON.parse(textData)
    } catch {
      data = textData.length > 200 ? textData.substring(0, 200) + '... (truncated HTTP response)' : textData
    }

    console.log(`[WHATSAPP_WIN_RESPONSE_DATA] Response from AskEva:`, data)
    
    // Check if response contains messaging_product and messages
    if (data?.messaging_product === 'whatsapp' && data?.messages && data.messages.length > 0) {
      console.log(`[WHATSAPP_WIN_SUCCESS_DETAILED] Message object:`)
      data.messages.forEach((msg: any, idx: number) => {
        console.log(`  Message [${idx}]:`, JSON.stringify(msg, null, 2))
      })
      if (data.contacts && data.contacts.length > 0) {
        console.log(`[WHATSAPP_WIN_CONTACT_INFO] Contact:`, JSON.stringify(data.contacts, null, 2))
      }
    }

    // More detailed success check
    const isSuccess = response.ok || data?.messaging_product === 'whatsapp'
    
    if (!isSuccess) {
      console.error(`[WHATSAPP_WIN_API_ERROR] Request failed. Status: ${response.status}`)
      console.error(`[WHATSAPP_WIN_API_ERROR_DETAILS]`, data)
      
      // Check for specific error reasons
      if (data?.error) {
        console.error(`[WHATSAPP_WIN_ERROR_REASON] Error details:`, data.error)
      }
      if (data?.errors) {
        console.error(`[WHATSAPP_WIN_ERROR_DETAILS] Errors:`, data.errors)
      }
    }

    return { success: isSuccess, data }
  } catch (error) {
    console.error("[WhatsApp Win] Error:", error)
    return { success: false, error }
  }
}
