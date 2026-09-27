import { NextResponse } from 'next/server'

// Razorpay API credentials from environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

export async function GET() {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials not configured')
      return NextResponse.json(
        { error: 'Razorpay credentials not configured' },
        { status: 500 }
      )
    }

    // Razorpay Offers API endpoint
    const razorpayUrl = 'https://api.razorpay.com/v1/offers'
    
    // Create Basic Auth header
    const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
    
    const response = await fetch(razorpayUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data
    })

    if (!response.ok) {
      console.error('Razorpay API error:', response.status, response.statusText)
      
      // If API fails, return fallback offers
      return NextResponse.json({
        items: getFallbackOffers(),
        count: getFallbackOffers().length,
        source: 'fallback'
      })
    }

    const data = await response.json()
    
    // Transform Razorpay offers to our format
    const transformedOffers = data.items?.map((offer: any) => ({
      id: offer.id,
      name: offer.name || 'Special Offer',
      description: offer.terms || offer.display_text || 'Limited time offer',
      bank: extractBankName(offer.name || offer.display_text || ''),
      discount_percentage: offer.discount_percentage || null,
      discount_amount: offer.discount_amount ? offer.discount_amount / 100 : null, // Convert paise to rupees
      min_amount: offer.min_amount ? offer.min_amount / 100 : null,
      max_discount: offer.max_discount ? offer.max_discount / 100 : null,
      payment_method: offer.payment_method || 'card',
      active: offer.active,
      starts_at: offer.starts_at,
      ends_at: offer.ends_at,
      type: offer.type || 'instant',
    })) || []

    return NextResponse.json({
      items: transformedOffers.length > 0 ? transformedOffers : getFallbackOffers(),
      count: transformedOffers.length || getFallbackOffers().length,
      source: transformedOffers.length > 0 ? 'razorpay' : 'fallback'
    })

  } catch (error) {
    console.error('Error fetching Razorpay offers:', error)
    
    // Return fallback offers on error
    return NextResponse.json({
      items: getFallbackOffers(),
      count: getFallbackOffers().length,
      source: 'fallback'
    })
  }
}

// Extract bank name from offer text
function extractBankName(text: string): string {
  const bankKeywords = ['HDFC', 'ICICI', 'AXIS', 'SBI', 'KOTAK', 'PAYTM', 'PHONEPE', 'GPAY', 'AMAZON PAY']
  const upperText = text.toUpperCase()
  
  for (const bank of bankKeywords) {
    if (upperText.includes(bank)) {
      return bank
    }
  }
  
  return 'BANK'
}

// Fallback offers if Razorpay API is unavailable
function getFallbackOffers() {
  return [
    {
      id: 'fallback_1',
      name: 'HDFC Bank Offer',
      description: 'Up to ₹1,500 on HDFC Bank Credit Cards',
      bank: 'HDFC',
      discount_percentage: 10,
      discount_amount: null,
      min_amount: 5000,
      max_discount: 1500,
      payment_method: 'card',
      active: true,
      type: 'instant',
    },
    {
      id: 'fallback_2',
      name: 'ICICI Bank Cashback',
      description: 'Max ₹1,000 on ICICI Credit/Debit Cards',
      bank: 'ICICI',
      discount_percentage: 5,
      discount_amount: null,
      min_amount: 3000,
      max_discount: 1000,
      payment_method: 'card',
      active: true,
      type: 'instant',
    },
    {
      id: 'fallback_3',
      name: 'Axis Bank Discount',
      description: 'On orders above ₹5,000 with Axis Bank',
      bank: 'AXIS',
      discount_percentage: null,
      discount_amount: 500,
      min_amount: 5000,
      max_discount: 500,
      payment_method: 'card',
      active: true,
      type: 'instant',
    },
    {
      id: 'fallback_4',
      name: 'SBI No Cost EMI',
      description: '3/6/9 months EMI on SBI Credit Cards',
      bank: 'SBI',
      discount_percentage: null,
      discount_amount: null,
      min_amount: 5000,
      max_discount: null,
      payment_method: 'card',
      active: true,
      type: 'emi',
    },
    {
      id: 'fallback_5',
      name: 'Kotak Bank Offer',
      description: 'Up to ₹750 on Kotak Bank Cards',
      bank: 'KOTAK',
      discount_percentage: 7.5,
      discount_amount: null,
      min_amount: 4000,
      max_discount: 750,
      payment_method: 'card',
      active: true,
      type: 'instant',
    },
    {
      id: 'fallback_6',
      name: 'Paytm Cashback',
      description: 'On orders above ₹3,000 via Paytm',
      bank: 'PAYTM',
      discount_percentage: null,
      discount_amount: 300,
      min_amount: 3000,
      max_discount: 300,
      payment_method: 'wallet',
      active: true,
      type: 'instant',
    },
  ]
}
