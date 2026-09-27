export const PROMO_TEMPLATES = [
  {
    id: 'promo-code',
    name: 'Promotional Code',
    subject: 'Special Promo for you, {{name}} — Use CODE: SAVE25',
    image: '/promo-images/promo-code.jpg',
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Promo</title></head><body style="font-family: Inter, Arial, sans-serif; background:#f4f6fb; ; margin:0"><div style="max-width:680px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(2,6,23,0.08)"><div style="padding:28px;text-align:center;background:linear-gradient(90deg,#0ea5a8,#2563eb);color:white"><h1 style="margin:0;font-size:24px">Exclusive Promo Just For You</h1><p style="margin:8px 0 0">Use code <strong>SAVE25</strong> on checkout</p></div><div style="padding:22px;color:#0f172a"><p>Hi {{name}},</p><p>We have a limited-time discount for you. Apply the promo code at checkout to save on your next purchase.</p><p style="text-align:center;margin:18px 0"><a href="${process.env.NEXTAUTH_URL || 'https://example.com'}/products" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Shop Now</a></p><p style="font-size:13px;color:#6b7280">Offer valid while stocks last. Terms apply.</p></div><div style="padding:18px;background:#f8fafc;text-align:center;color:#6b7280;font-size:12px">Sara Mobiles and Electronics  • Delivering quality electronics</div></div></body></html>`
  },
  {
    id: 'new-products',
    name: 'New Products',
    subject: 'New Arrivals — Curated Picks for {{name}}',
    image: '/promo-images/new-arrivals.jpg',
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family: Inter, Arial, sans-serif; background:#ffffff; "><div style="max-width:700px;margin:0 auto"><div style="text-align:center;padding:24px"><h2 style="margin:0;color:#111827">Just In — New Products</h2><p style="color:#6b7280;margin-top:8px">Hand-picked for you, {{name}}</p></div><div style="display:flex;gap:12px;flex-wrap:wrap;padding:12px"><img src="${process.env.NEXTAUTH_URL || ''}/promo-images/new-arrivals.jpg" alt="New" style="width:100%;max-height:240px;object-fit:cover;border-radius:8px" /></div><div style="padding:18px;color:#111827"><p>Explore our latest collection — additions across categories to power your work and play.</p><p style="margin-top:16px;text-align:center"><a href="${process.env.NEXTAUTH_URL || 'https://example.com'}/products" style="background:#0ea5a8;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Browse New Arrivals</a></p></div></div></body></html>`
  },
  {
    id: 'bumper-offer',
    name: 'Bumper Offer',
    subject: 'Bumper Offer — Big Savings for {{name}}',
    image: '/promo-images/bumper-offer.jpg',
    html: `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; background:#fff; "><div style="max-width:680px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.06)"><div style="padding:22px;text-align:center;background:#111827;color:white"><h1 style="margin:0">Bumper Offer</h1><p style="margin-top:8px">Huge savings across categories</p></div><div style=";color:#111827"><p>Hi {{name}},</p><p>Don't miss our bumper offer with special prices sitewide for a limited window.</p><p style="text-align:center;margin-top:18px"><a href="${process.env.NEXTAUTH_URL || 'https://example.com'}/products" style="background:#111827;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Grab Offer</a></p></div></div></body></html>`
  },
  {
    id: 'festival-sales',
    name: 'Festival Sales',
    subject: 'Festival Sale — Celebrations & Deals for {{name}}',
    image: '/promo-images/festival.jpg',
    html: `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family: Inter, Arial, sans-serif; background:linear-gradient(180deg,#fff,#f8fafc);"><div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(2,6,23,0.08)"><div style="padding:28px;text-align:center;background:linear-gradient(90deg,#fb7185,#f97316);color:white"><h1 style="margin:0">Festival Sale</h1><p style="margin-top:8px">Celebrate with exclusive discounts</p></div><div style="padding:22px;color:#111827"><p>Dear {{name}},</p><p>Enjoy special festival pricing across categories — limited period only.</p><p style="text-align:center;margin-top:16px"><a href="${process.env.NEXTAUTH_URL || 'https://example.com'}/products" style="background:#fb7185;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Shop Festival Deals</a></p></div></div></body></html>`
  },
  {
    id: 'custom',
    name: 'Custom Template',
    subject: '{{name}} — Your Message Here',
    image: '',
    html: `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family: Inter, Arial, sans-serif; background:#f9fafb;"><div style="max-width:700px;margin:0 auto;background:#fff;;border-radius:10px"><h2 style="margin-top:0">Custom Message</h2><p>Hi {{name}},</p><p>Edit this template to add your custom message and images.</p></div></body></html>`
  }
]

export type PromoTemplate = {
  id: string
  name: string
  subject: string
  html: string
}

export default PROMO_TEMPLATES
