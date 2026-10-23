import { sendEmail, escapeHtml } from "@/lib/email"
import { sendWhatsAppTemplate, type WhatsAppNotificationResult } from "@/lib/whatsapp-template"

// ==================== EMAIL TEMPLATES ====================

export function getOtpEmailTemplate(name: string, otp: string): string {
  const safeName = escapeHtml(name)
  const safeOtp = escapeHtml(otp)
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
          <h2 style="color: #7c3aed; margin-top: 0; font-size: 22px;">Hello ${safeName}! 👋</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Your One-Time Password (OTP) for the Spin the Wheel campaign is:
          </p>
          
          <div style="background: linear-gradient(135deg, #f5f3ff, #fdf2f8); padding: 30px; border-radius: 12px; margin: 25px 0; text-align: center; border: 2px solid #7c3aed;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP</p>
            <div style="background: #7c3aed; color: white; padding: 15px 25px; border-radius: 8px; display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
              ${safeOtp}
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
  const safeName = escapeHtml(name)
  const safePrize = escapeHtml(prize)
  const safeCouponCode = escapeHtml(couponCode)
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
          <h2 style="color: #7c3aed; margin-top: 0; font-size: 24px;">Hello ${safeName}! 🎊</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            We are thrilled to announce that you have won in our <strong>Spin the Wheel Campaign</strong>!
          </p>
          
          <div style="background: linear-gradient(135deg, #f5f3ff, #fdf2f8); padding: 30px; border-radius: 12px; margin: 25px 0; text-align: center; border: 2px solid #7c3aed;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Prize</p>
            <h3 style="color: #7c3aed; margin: 0 0 20px 0; font-size: 28px;">🏆 ${safePrize}</h3>
            
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Coupon Code</p>
            <div style="background: #7c3aed; color: white; padding: 15px 25px; border-radius: 8px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${safeCouponCode}
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

export async function sendOtpEmail(email: string, name: string, otp: string) {
  return sendEmail({
    to: email,
    subject: `🔐 Your OTP: ${otp} - Spin the Wheel Campaign`,
    html: getOtpEmailTemplate(name, otp),
  })
}

export async function sendSpinWheelEmail(email: string, name: string, prize: string, couponCode: string) {
  return sendEmail({
    to: email,
    subject: `🎉 Congratulations ${name}! You won ${prize} - Spin the Wheel Campaign`,
    html: getSpinWheelWinnerEmailTemplate(name, prize, couponCode),
  })
}

export type { WhatsAppNotificationResult }

export function sendWhatsAppOTP(phone: string, otp: string, senderOverride?: string) {
  return sendWhatsAppTemplate(phone, {
    language: { policy: "deterministic", code: "en" },
    name: "spin_win_auth",
    components: [
      { type: "body", parameters: [{ type: "text", text: otp }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] },
    ],
  }, senderOverride, "Spin WhatsApp")
}

export function sendWhatsAppWinNotification(phone: string, name: string, prize: string, couponCode: string, senderOverride?: string) {
  return sendWhatsAppTemplate(phone, {
    language: { policy: "deterministic", code: "en" },
    name: "spin_win_confirm",
    components: [{ type: "body", parameters: [name, prize, couponCode].map(text => ({ type: "text", text })) }],
  }, senderOverride, "Spin WhatsApp")
}
