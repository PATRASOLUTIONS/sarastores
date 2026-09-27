import { NextRequest, NextResponse } from 'next/server'
import { rateLimitHit, rateLimitReset, rateLimitResetSeconds } from '@/lib/rate-limit-store'

const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 5 // 5 signup attempts per 15 minutes per IP

const keyFor = (identifier: string) => `auth:attempts:${identifier}`

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip') // Cloudflare
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, get the first one
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP.trim()
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim()
  }
  
  // Fallback to a generic identifier
  return 'unknown'
}

/**
 * Check if request exceeds rate limit
 */
export async function isRateLimited(identifier: string): Promise<boolean> {
  const result = await rateLimitHit(keyFor(identifier), MAX_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW)
  return result.limited
}

/**
 * Get remaining time until rate limit resets
 */
export async function getRateLimitResetTime(identifier: string): Promise<number> {
  return rateLimitResetSeconds(keyFor(identifier))
}

/**
 * Verify honeypot field (should be empty)
 */
export function verifyHoneypot(honeypotValue: any): boolean {
  // Honeypot should be empty or undefined
  return !honeypotValue || honeypotValue === ''
}

/**
 * Verify form submission timing (not too fast)
 */
export function verifyTimestamp(timestamp: number): boolean {
  const now = Date.now()
  const timeDiff = now - timestamp
  
  // Form should take at least 3 seconds to fill
  const MIN_FORM_TIME = 3000 // 3 seconds
  // Form shouldn't be older than 10 minutes
  const MAX_FORM_TIME = 10 * 60 * 1000 // 10 minutes
  
  return timeDiff >= MIN_FORM_TIME && timeDiff <= MAX_FORM_TIME
}

/**
 * Verify Google reCAPTCHA v3 token
 */
export async function verifyRecaptcha(token: string, secretKey: string): Promise<{
  success: boolean
  score?: number
  error?: string
}> {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })
    
    const data = await response.json()
    
    if (!data.success) {
      return {
        success: false,
        error: 'reCAPTCHA verification failed'
      }
    }
    
    // For reCAPTCHA v3, check the score (0.0 to 1.0)
    // 0.0 is very likely a bot, 1.0 is very likely a human
    const score = data.score || 0
    const MINIMUM_SCORE = 0.5 // Adjust based on your needs
    
    if (score < MINIMUM_SCORE) {
      return {
        success: false,
        score,
        error: `reCAPTCHA score too low: ${score}`
      }
    }
    
    return {
      success: true,
      score
    }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error)
    return {
      success: false,
      error: 'Failed to verify reCAPTCHA'
    }
  }
}

/**
 * Comprehensive bot detection middleware
 */
export async function detectBot(request: NextRequest, body: any): Promise<{
  isBot: boolean
  reason?: string
  waitTime?: number
}> {
  // 1. Check rate limit
  const clientIP = getClientIP(request)
  if (await isRateLimited(clientIP)) {
    const waitTime = await getRateLimitResetTime(clientIP)
    return {
      isBot: true,
      reason: 'Rate limit exceeded. Too many registration attempts.',
      waitTime
    }
  }
  
  // 2. Check honeypot
  if (!verifyHoneypot(body.website)) {
    return {
      isBot: true,
      reason: 'Bot detected: Honeypot field filled'
    }
  }
  
  // 3. Check timestamp
  if (body.formTimestamp && !verifyTimestamp(body.formTimestamp)) {
    return {
      isBot: true,
      reason: 'Invalid form submission timing'
    }
  }
  
  // 4. Check User-Agent
  const userAgent = request.headers.get('user-agent') || ''
  const suspiciousAgents = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests']
  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    return {
      isBot: true,
      reason: 'Suspicious user agent detected'
    }
  }
  
  // 5. Verify reCAPTCHA if token is provided
  if (body.recaptchaToken && process.env.RECAPTCHA_SECRET_KEY) {
    const recaptchaResult = await verifyRecaptcha(
      body.recaptchaToken,
      process.env.RECAPTCHA_SECRET_KEY
    )
    
    if (!recaptchaResult.success) {
      return {
        isBot: true,
        reason: recaptchaResult.error || 'reCAPTCHA verification failed'
      }
    }
  }
  
  return { isBot: false }
}

/**
 * Reset rate limit for an identifier (useful after successful signup)
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  await rateLimitReset(keyFor(identifier))
}
