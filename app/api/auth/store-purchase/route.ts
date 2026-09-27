import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.SMTP_PASS
  }
})

const otpStore: Record<string, { otp: string; timestamp: number }> = {}

export async function POST(req: Request) {
  try {
    const { email, employeeId, action, otp } = await req.json()

    if (action === "verify") {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()

      otpStore[email] = {
        otp: generatedOtp,
        timestamp: Date.now() + 5 * 60 * 1000
      }

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: 'In-store Purchase Verification',
          html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Store Purchase Verification</title>
              <style>
                body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
                .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                .header { background-color: #1a1a1a; padding: 30px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px; }
                .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
                .otp-box { background-color: #f8f9fa; border: 2px dashed #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
                .otp-code { font-size: 32px; font-weight: 700; color: #1a1a1a; letter-spacing: 8px; display: inline-block; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
                .info-item { margin-bottom: 10px; }
                .label { font-weight: 600; color: #555555; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Sara Electronics</h1>
                </div>
                <div class="content">
                  <h2 style="color: #1a1a1a; margin-top: 0;">Verification Required</h2>
                  <p>Hello,</p>
                  <p>You are initiating an in-store purchase that requires authorization. Please use the following One-Time Password (OTP) to complete the verification process.</p>
                  
                  <div class="otp-box">
                    <span class="otp-code">${generatedOtp}</span>
                  </div>
                  
                  <div class="info-item">
                    <span class="label">Employee ID:</span> ${employeeId}
                  </div>
                  <div class="info-item">
                    <span class="label">Time:</span> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                  
                  <p style="margin-top: 30px; font-size: 14px; color: #666;">
                    For security reasons, this OTP is valid for only <strong>5 minutes</strong>. Do not share this code with anyone.
                  </p>
                </div>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Sara Electronics. All rights reserved.</p>
                  <p>This is an automated message, please do not reply.</p>
                </div>
              </div>
            </body>
            </html>
          `
        })

        return NextResponse.json({
          success: true,
          message: "OTP sent successfully"
        })
      } catch (emailError) {
        console.error("Email sending error:", emailError instanceof Error ? emailError.message : String(emailError))
        return NextResponse.json({
          success: false,
          message: "Failed to send OTP email"
        }, { status: 500 })
      }
    }

    if (action === "validate") {
      const storedData = otpStore[email]

      if (!storedData || !storedData.otp) {
        return NextResponse.json({
          success: false,
          message: "No OTP found. Please request a new OTP."
        }, { status: 400 })
      }

      if (Date.now() > storedData.timestamp) {
        delete otpStore[email]
        return NextResponse.json({
          success: false,
          message: "OTP expired. Please request a new OTP."
        }, { status: 400 })
      }

      if (storedData.otp !== otp) {
        return NextResponse.json({
          success: false,
          message: "Invalid OTP. Please check and try again."
        }, { status: 400 })
      }

      delete otpStore[email]

      return NextResponse.json({
        success: true,
        message: "OTP verified successfully"
      })
    }

    return NextResponse.json({
      success: false,
      message: "Invalid action"
    }, { status: 400 })

  } catch (error) {
    console.error("Store purchase auth error:", error)
    return NextResponse.json({
      success: false,
      message: "Server error"
    }, { status: 500 })
  }
}
