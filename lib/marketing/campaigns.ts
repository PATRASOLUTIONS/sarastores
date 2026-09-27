/**
 * Campaign catalogue.
 *
 * One definition drives both channels: the email body and the WhatsApp template
 * parameters come from the same entry, so a campaign cannot drift between the two.
 * `segments` declares who the campaign is written for, which is what lets the UI
 * suggest the right template once an audience is chosen.
 */

import { renderEmail, THEMES } from "./email-layout"

export type CampaignCategory = "lifecycle" | "festival" | "promotion" | "transactional-adjacent"

export type CampaignTemplate = {
  id: string
  name: string
  category: CampaignCategory
  /** Segment keys from lib/marketing/segments.ts this campaign is written for. */
  segments: string[]
  /** Occasion key from lib/marketing/occasions.ts, for festival campaigns. */
  occasion?: string
  subject: string
  preheader: string
  html: string
  /**
   * WhatsApp counterpart. `templateName` must exist and be APPROVED in AskEva —
   * WhatsApp does not allow free-form marketing sends to cold contacts.
   */
  whatsapp: {
    templateName: string
    /** Ordered body parameters. Placeholders resolve per recipient at send time. */
    bodyParams: string[]
    /** Optional dynamic suffix appended to the button URL. */
    buttonUrlParam?: string
    /** Plain-text rendering used for previews and for the approval submission. */
    preview: string
  }
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://sarastores.com"

type Spec = {
  id: string
  name: string
  category: CampaignCategory
  segments: string[]
  occasion?: string
  theme: keyof typeof THEMES
  eyebrow?: string
  subject: string
  preheader: string
  headline: string
  subhead?: string
  body: string
  cta: string
  ctaPath?: string
  bullets?: string[]
  footnote?: string
  wa: { templateName: string; bodyParams: string[]; preview: string; buttonUrlParam?: string }
}

const DEFAULT_BULLETS = ["✓ Free delivery over ₹1,000", "✓ Installation support", "✓ Brand warranty"]

const SPECS: Spec[] = [
  // ─────────────────────────── Lifecycle ───────────────────────────
  {
    id: "welcome-new-customer", name: "Welcome — first order", category: "lifecycle",
    segments: ["new_customer"], theme: "fresh", eyebrow: "Welcome to the family",
    subject: "Welcome to Sara Electronics, {{name}} 🎉",
    preheader: "Your first order is confirmed — here is what happens next.",
    headline: "Thanks for choosing us", subhead: "You're now part of 25 years of trusted service",
    body: "Your first order is on its way. Every product we sell is brand-warranty backed, and our team installs and services what we sell — so you have one number to call if you ever need help.",
    cta: "Explore more products",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_welcome_customer", bodyParams: ["{{name}}"], preview: "Hi {{name}}, welcome to Sara Electronics!" },
  },
  {
    id: "champion-vip", name: "Champion — VIP early access", category: "lifecycle",
    segments: ["champion", "tier_platinum", "frequent"], theme: "premium", eyebrow: "Platinum access",
    subject: "{{name}}, your VIP early access is open",
    preheader: "24 hours before everyone else. Because you have earned it.",
    headline: "You get first pick", subhead: "Early access opens 24 hours before the public sale",
    body: "You are one of our most valued customers, so you shop the new sale before anyone else. Stock on the best deals runs out fast — this window is yours.",
    cta: "Shop early access",
    bullets: ["✓ Priority delivery", "✓ Dedicated support line", "✓ Free installation"],
    wa: { templateName: "sara_vip_early_access", bodyParams: ["{{name}}"], preview: "Hi {{name}}, your VIP early access is live. Shop 24h before everyone else." },
  },
  {
    id: "loyal-thankyou", name: "Loyal — thank you reward", category: "lifecycle",
    segments: ["loyal", "repeat", "tier_gold"], theme: "brand", eyebrow: "Thank you",
    subject: "A thank-you from all of us, {{name}}",
    preheader: "You keep coming back. Here is something for that.",
    headline: "Thank you for staying with us", subhead: "A reward for our returning customers",
    body: "You have shopped with us more than once, and that means a lot in a market where it is easy to go elsewhere. Here is a reward to use whenever you are ready.",
    cta: "Use my reward",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_loyalty_reward", bodyParams: ["{{name}}", "₹15, 000"], preview: "Hi {{name}}, thank you for shopping with us again!" },
  },
  {
    id: "promising-second-order", name: "Promising — nudge to second order", category: "lifecycle",
    segments: ["promising", "one_time"], theme: "calm", eyebrow: "Complete your home",
    subject: "{{name}}, what's next for your home?",
    preheader: "Customers who bought what you did usually add this next.",
    headline: "One purchase in, plenty to go", subhead: "Hand-picked to go with what you already own",
    body: "You bought from us once — here is what customers with a similar setup added next. Same warranty, same installation support, same team.",
    cta: "See recommendations",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_second_order", bodyParams: ["{{name}}"], preview: "Hi {{name}}, ready for your next upgrade?" },
  },
  {
    id: "at-risk-winback", name: "At risk — we miss you", category: "lifecycle",
    segments: ["at_risk", "dormant"], theme: "calm", eyebrow: "It has been a while",
    subject: "We haven't seen you in a while, {{name}}",
    preheader: "A lot has changed. Here is what's new.",
    headline: "Come back and see what's new", subhead: "New brands, new models, better prices",
    body: "It has been a few months since your last order. We have added new models across televisions, refrigerators and washing machines — and prices have moved a long way since you last looked.",
    cta: "See what's new",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_winback", bodyParams: ["{{name}}", "14"], preview: "Hi {{name}}, we miss you! Valid for 14 days only." },
  },
  {
    id: "lapsed-reactivation", name: "Lapsed — strong reactivation", category: "lifecycle",
    segments: ["lapsed"], theme: "urgent", eyebrow: "Exclusive return offer",
    subject: "{{name}}, this offer is only for customers like you",
    preheader: "Our best reactivation offer. Not available publicly.",
    headline: "We want you back", subhead: "An offer we do not advertise",
    body: "You have not shopped with us in a long time. Rather than guess why, here is our strongest offer — better than anything on the public site — to make coming back worth it.",
    cta: "Claim my offer",
    bullets: ["✓ Free delivery", "✓ Free installation", "✓ Easy EMI available"],
    wa: { templateName: "sara_reactivation", bodyParams: ["{{name}}", "₹25, 000"], preview: "Hi {{name}}, here is ₹2,000 off just for you. on orders above ₹25,000." },
  },
  {
    id: "lost-last-chance", name: "Lost — final touch", category: "lifecycle",
    segments: ["lost"], theme: "premium", eyebrow: "One last note",
    subject: "Should we stop emailing you, {{name}}?",
    preheader: "Tell us to stop, or take this offer. Either is fine.",
    headline: "We'd rather ask than guess", subhead: "One click either way",
    body: "You have not opened or ordered in over a year. We would rather you tell us to stop than keep landing in an inbox you do not want. If we got it wrong, here is a reason to stay.",
    cta: "I still want offers",
    footnote: "If you would rather not hear from us, use the unsubscribe link below — no hard feelings.",
    wa: { templateName: "sara_last_chance", bodyParams: ["{{name}}"], preview: "Hi {{name}}, we'd love to keep you." },
  },
  {
    id: "abandoned-cart", name: "Cart abandonment", category: "lifecycle",
    segments: ["abandoned_cart"], theme: "urgent", eyebrow: "Still deciding?",
    subject: "{{name}}, your cart is waiting",
    preheader: "We saved it. Stock is not guaranteed though.",
    headline: "You left something behind", subhead: "Your cart is saved and ready",
    body: "The items in your cart are still there. We cannot hold stock indefinitely, so if you were waiting for a reason to finish — here is ₹500 off.",
    cta: "Complete my order", ctaPath: "/cart",
    bullets: ["✓ Secure checkout", "✓ EMI from ₹999/mo", "✓ Free delivery over ₹1,000"],
    wa: { templateName: "sara_cart_reminder", bodyParams: ["{{name}}", "48"], preview: "Hi {{name}}, your cart is waiting! Offer expires in 48 hours." },
  },
  {
    id: "wishlist-nudge", name: "Wishlist — price drop", category: "lifecycle",
    segments: ["wishlist_active"], theme: "fresh", eyebrow: "Price drop",
    subject: "Good news, {{name}} — a wishlist item dropped in price",
    preheader: "The product you saved is cheaper now.",
    headline: "Your wishlist just got cheaper", subhead: "Prices move. Yours moved down.",
    body: "Something you saved is now available at a lower price. Wishlist prices change without notice and stock moves quickly at these levels.",
    cta: "View my wishlist", ctaPath: "/dashboard/wishlist",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_wishlist_drop", bodyParams: ["{{name}}"], preview: "Hi {{name}}, an item on your wishlist just dropped in price. Check it before stock runs out." },
  },
  {
    id: "no-purchase-first-order", name: "Registered, never bought", category: "lifecycle",
    segments: ["no_purchase"], theme: "calm", eyebrow: "Your first order",
    subject: "{{name}}, here's ₹500 to get started",
    preheader: "You signed up but never ordered. Let's fix that.",
    headline: "Your account is ready — your first order isn't", subhead: "₹500 off to make the first one easy",
    body: "You created an account but never placed an order. If price was the reason, this should help. If it was something else, reply and tell us — we read every response.",
    cta: "Start shopping",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_first_order", bodyParams: ["{{name}}"], preview: "Hi {{name}}, welcome!" },
  },
  {
    id: "tier-upgrade", name: "Tier upgrade congratulations", category: "lifecycle",
    segments: ["tier_gold", "tier_platinum"], theme: "premium", eyebrow: "Tier unlocked",
    subject: "{{name}}, you've unlocked a new tier",
    preheader: "Better perks, effective immediately.",
    headline: "You've moved up", subhead: "New benefits are already active on your account",
    body: "Your spending over the last year has moved you into a higher tier. Priority delivery, free installation and early sale access are now active on your account.",
    cta: "See my benefits", ctaPath: "/dashboard",
    bullets: ["✓ Priority delivery", "✓ Early sale access", "✓ Free installation"],
    wa: { templateName: "sara_tier_upgrade", bodyParams: ["{{name}}"], preview: "Congratulations {{name}}! You've unlocked a higher tier at Sara Electronics with priority delivery and early sale access." },
  },
  {
    id: "post-purchase-crosssell", name: "Post-purchase cross-sell", category: "lifecycle",
    segments: ["active", "repeat"], theme: "fresh", eyebrow: "Goes well with yours",
    subject: "{{name}}, complete your setup",
    preheader: "Accessories and add-ons for what you just bought.",
    headline: "Get the most out of your purchase", subhead: "Add-ons chosen for what you own",
    body: "Your new appliance works better with the right accessories — stabilisers, stands, filters and extended warranty. All fitted and supported by the same team.",
    cta: "See add-ons",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_cross_sell", bodyParams: ["{{name}}"], preview: "Hi {{name}}, complete your setup with accessories picked for your recent purchase at Sara Electronics." },
  },

  // ─────────────────────────── Category affinity ───────────────────────────
  {
    id: "cat-tv-upgrade", name: "TV owners — upgrade", category: "promotion",
    segments: ["cat_television"], theme: "premium", eyebrow: "Screen upgrade",
    subject: "{{name}}, ready for a bigger screen?",
    preheader: "New QLED and 4K models, with no-cost EMI.",
    headline: "Upgrade your screen", subhead: "No-cost EMI on every television",
    body: "New QLED and 4K models are in. Spread the cost over up to 24 months with no-cost EMI, and we will wall-mount it and set it up for you at home.",
    cta: "Shop televisions", ctaPath: "/products?search=television",
    bullets: ["✓ No-cost EMI", "✓ Free wall mounting", "✓ Demo at home"],
    wa: { templateName: "sara_category_offer", bodyParams: ["{{name}}", "televisions"], preview: "Hi {{name}}, upgrade your televisions at Sara Electronics with no-cost EMI and free installation." },
  },
  {
    id: "cat-cooling-season", name: "Cooling buyers — season push", category: "promotion",
    segments: ["cat_air_conditioner"], theme: "fresh", eyebrow: "Beat the heat",
    subject: "{{name}}, get your cooling sorted before summer",
    preheader: "Service, upgrade or add a second unit — before the rush.",
    headline: "Cooling season is coming", subhead: "Book before the queue builds",
    body: "Summer demand makes installation slots scarce and prices firm. Booking now gets you a better price and a slot that suits you rather than whatever is left.",
    cta: "Shop cooling",
    bullets: ["✓ Same-week installation", "✓ Copper condenser models", "✓ EMI available"],
    wa: { templateName: "sara_category_offer", bodyParams: ["{{name}}", "air conditioners"], preview: "Hi {{name}}, book your air conditioners early this season at Sara Electronics — better prices and faster installation." },
  },
  {
    id: "cat-kitchen-bundle", name: "Kitchen buyers — bundle", category: "promotion",
    segments: ["cat_kitchen"], theme: "brand", eyebrow: "Kitchen bundle",
    subject: "{{name}}, build out your kitchen for less",
    preheader: "Bundle pricing on built-in appliances.",
    headline: "Finish the kitchen", subhead: "Bundle two or more and save",
    body: "Built-in ovens, hobs, chimneys and dishwashers are cheaper together than apart. Our team designs and installs the whole set so it fits properly first time.",
    cta: "Shop kitchen",
    bullets: ["✓ Free design consult", "✓ Certified installation", "✓ Bundle pricing"],
    wa: { templateName: "sara_category_offer", bodyParams: ["{{name}}", "kitchen appliances"], preview: "Hi {{name}}, save more when you bundle kitchen appliances at Sara Electronics. Free design consultation included." },
  },

  // ─────────────────────────── Festivals ───────────────────────────
  ...([
    ["diwali", "Diwali", "festive", "Diwali Dhamaka — up to 50% off", "The festival of lights, lit up with our biggest prices of the year.", "Up to 50% off + bank cashback"],
    ["dhanteras", "Dhanteras", "festive", "Dhanteras — the most auspicious day to buy", "Tradition says buy something new today. We made that easier.", "Extra 15% off on Dhanteras"],
    ["navratri", "Navratri", "festive", "Nine nights, nine days of offers", "A new deal every day of Navratri.", "New offer daily"],
    ["dussehra", "Dussehra", "festive", "Vijayadashami special", "An auspicious day for a new beginning at home.", "10% off sitewide"],
    ["durga-puja", "Durga Puja", "festive", "Pujo shopping starts here", "Shubho Bijoya — festive prices across every category.", "12% off + free delivery"],
    ["ganesh-chaturthi", "Ganesh Chaturthi", "festive", "Ganpati Bappa Morya", "Welcome Bappa with a home that shines.", "11% off this festive week"],
    ["onam", "Onam", "fresh", "Onam Ashamsakal", "Onam special pricing for Kerala.", "10% off + free delivery"],
    ["holi", "Holi", "festive", "Holi hai! Colourful savings inside", "Play with colours, save on appliances.", "Up to 20% off"],
    ["raksha-bandhan", "Raksha Bandhan", "brand", "The gift your sibling actually wants", "Skip the sweets. Give something that lasts.", "10% off gifting range"],
    ["eid", "Eid", "fresh", "Eid Mubarak from all of us", "Celebrate with something new at home.", "12% off this Eid"],
    ["pongal-sankranti", "Pongal / Sankranti", "festive", "Harvest festival home refresh", "New season, new appliances.", "10% off + free installation"],
    ["gudi-padwa-ugadi", "Gudi Padwa / Ugadi", "festive", "A new year deserves a new start", "Auspicious buying, better prices.", "10% off sitewide"],
    ["baisakhi", "Baisakhi / Vishu", "fresh", "Celebrate the new year with us", "Regional new year offers across categories.", "10% off"],
    ["akshaya-tritiya", "Akshaya Tritiya", "premium", "The most auspicious day to buy", "Buy today for lasting prosperity.", "12% off + gold-rate EMI"],
    ["karwa-chauth", "Karwa Chauth", "brand", "A gift for the one who waits for you", "Make the day special.", "10% off gifting"],
    ["bhai-dooj", "Bhai Dooj", "brand", "Celebrate your sibling bond", "A gift better than a card.", "10% off"],
    ["republic-day", "Republic Day", "calm", "Republic Day Sale — 26% off select models", "Celebrating the republic with real discounts.", "Up to 26% off"],
    ["independence-day", "Independence Day", "urgent", "Freedom from high prices", "Independence Day — our biggest mid-year sale.", "Up to 15% extra off"],
    ["childrens-day", "Children's Day", "fresh", "Make family time better", "Entertainment upgrades the whole family will use.", "10% off TVs and audio"],
    ["christmas", "Christmas", "urgent", "Merry Christmas — gifts that last", "Christmas pricing across the store.", "15% off"],
    ["new-year", "New Year", "premium", "New year, new home", "Start the year with an upgrade.", "Up to 20% off"],
    ["year-end", "Year-End Sale", "urgent", "Last prices of the year", "Everything must move before stock-take.", "Up to 25% off"],
    ["valentines", "Valentine's Day", "brand", "For the one who shares your sofa", "A gift you will both use.", "14% off"],
    ["summer-sale", "Summer Sale", "fresh", "Beat the heat sale", "ACs, coolers and refrigerators at season pricing.", "15% off cooling"],
    ["monsoon-sale", "Monsoon Sale", "calm", "Monsoon indoor upgrades", "Rainy season, better indoors.", "12% off"],
    ["wedding-season", "Wedding Season", "premium", "Setting up a new home?", "Complete home packages for newlyweds.", "10% off home bundles"],
    ["black-friday", "Black Friday", "urgent", "Black Friday, Indian prices", "One week. Lowest prices of the season.", "Up to 30% off"],
    ["financial-year-end", "Year-End Clearance", "urgent", "Financial year-end clearance", "Stock clearance before the books close.", "Up to 20% off clearance"],
  ] as const).map(([occasion, label, theme, headline, body, note]) => ({
    id: `festival-${occasion}`,
    name: `${label} campaign`,
    category: "festival" as CampaignCategory,
    segments: ["all", "active", "dormant", "high_spenders"],
    occasion,
    theme: theme as keyof typeof THEMES,
    eyebrow: label,
    subject: `${headline} — for you, {{name}}`,
    preheader: body,
    headline,
    subhead: note,
    body,
    cta: "Shop the sale",
    bullets: DEFAULT_BULLETS,
    wa: {
      templateName: "sara_festival_offer",
      bodyParams: ["{{name}}", label, note],
      preview: `Hi {{name}}, ${label} offers are live at Sara Electronics — ${note}.`,
    },
  })),

  // ─────────────────────────── Promotional pushes ───────────────────────────
  {
    id: "flash-sale", name: "Flash sale — 24 hours", category: "promotion",
    segments: ["all", "active", "high_spenders"], theme: "urgent", eyebrow: "24 hours only",
    subject: "⚡ 24-hour flash sale starts now, {{name}}",
    preheader: "Ends tomorrow. No extensions.",
    headline: "Flash sale — 24 hours", subhead: "Ends tomorrow at midnight",
    body: "A one-day price drop across every category. When the clock runs out, prices go back — we do not extend flash sales.",
    cta: "Shop the flash sale",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_flash_sale", bodyParams: ["{{name}}", "24"], preview: "Hi {{name}}, our flash sale is live! Only 24 hours left." },
  },
  {
    id: "bank-offer", name: "Bank / card offer", category: "promotion",
    segments: ["all", "high_spenders", "tier_gold", "tier_platinum"], theme: "calm", eyebrow: "Bank offer",
    subject: "{{name}}, extra 10% with your bank card",
    preheader: "Instant discount at checkout on select cards.",
    headline: "Extra 10% instant discount", subhead: "On select credit and debit cards",
    body: "Pay with a participating bank card and the discount comes off instantly at checkout — no cashback wait, no claim form.",
    cta: "Shop with bank offer",
    bullets: ["✓ Instant discount", "✓ No-cost EMI", "✓ All major banks"],
    wa: { templateName: "sara_bank_offer", bodyParams: ["{{name}}", "10%"], preview: "Hi {{name}}, get 10% instant discount with select bank cards at Sara Electronics. Applied at checkout." },
  },
  {
    id: "no-cost-emi", name: "No-cost EMI push", category: "promotion",
    segments: ["all", "promising", "one_time"], theme: "calm", eyebrow: "No-cost EMI",
    subject: "{{name}}, own it today — pay monthly",
    preheader: "No-cost EMI from ₹999 a month.",
    headline: "Take it home today", subhead: "No-cost EMI on orders above ₹10,000",
    body: "Spread the cost over 3 to 24 months with no interest on eligible cards. The price you see is the price you pay in total.",
    cta: "Shop on EMI",
    bullets: ["✓ From ₹999/month", "✓ No hidden interest", "✓ Instant approval"],
    wa: { templateName: "sara_emi_offer", bodyParams: ["{{name}}", "₹999"], preview: "Hi {{name}}, own it today with No-Cost EMI from ₹999/month at Sara Electronics." },
  },
  {
    id: "installation-offer", name: "Free installation offer", category: "promotion",
    segments: ["all", "repeat", "cat_television", "cat_refrigerator"], theme: "fresh", eyebrow: "Installation",
    subject: "{{name}}, we'll fit it for you — free",
    preheader: "Certified engineers, scheduled to suit you.",
    headline: "Delivered and set up.", subhead: "Installation included, not an extra",
    body: "Our own engineers deliver, install and demonstrate your appliance, then take the packaging away. No third-party contractor, no surprise fee.",
    cta: "Shop appliances",
    bullets: ["✓ Our own engineers", "✓ Slot of your choosing", "✓ Packaging taken away"],
    wa: { templateName: "sara_installation_offer", bodyParams: ["{{name}}"], preview: "Hi {{name}}, buy from Sara Electronics and our engineers deliver, install and set it up free." },
  },
  {
    id: "new-arrivals", name: "New arrivals", category: "promotion",
    segments: ["all", "champion", "loyal", "wishlist_active"], theme: "premium", eyebrow: "Just landed",
    subject: "Just landed: new models, {{name}}",
    preheader: "Fresh stock across every category.",
    headline: "New arrivals are in", subhead: "First stock, first pick",
    body: "New models have arrived across televisions, refrigerators, washing machines and kitchen appliances. Early stock always goes fastest.",
    cta: "See new arrivals",
    bullets: DEFAULT_BULLETS,
    wa: { templateName: "sara_new_arrivals", bodyParams: ["{{name}}"], preview: "Hi {{name}}, new arrivals just landed at Sara Electronics. Be first to see them." },
  },
  {
    id: "clearance", name: "Clearance / last units", category: "promotion",
    segments: ["all", "dormant", "promising"], theme: "urgent", eyebrow: "Last units",
    subject: "{{name}}, last units at clearance prices",
    preheader: "When they're gone, they're gone.",
    headline: "Clearance — final units", subhead: "Display and last-piece stock",
    body: "Display units and final pieces at clearance prices. Full warranty applies, quantities are genuinely limited, and these are not restocked.",
    cta: "Shop clearance",
    bullets: ["✓ Full brand warranty", "✓ Limited units", "✓ Same delivery service"],
    wa: { templateName: "sara_clearance", bodyParams: ["{{name}}"], preview: "Hi {{name}}, clearance stock is live at Sara Electronics. Limited units only." },
  },
  {
    id: "referral", name: "Referral programme", category: "promotion",
    segments: ["champion", "loyal", "frequent", "tier_platinum"], theme: "brand", eyebrow: "Refer & earn",
    subject: "{{name}}, earn ₹1,000 for every friend you send",
    preheader: "They save, you earn. Both sides win.",
    headline: "Refer a friend, both of you save", subhead: "₹1,000 for you, ₹1,000 for them",
    body: "Send your code to a friend. When they place their first order above ₹15,000, you both get ₹1,000 off. There is no cap on how many you refer.",
    cta: "Get my referral code",
    bullets: ["✓ No referral limit", "✓ Credited on delivery", "✓ Stacks with sale prices"],
    wa: { templateName: "sara_referral", bodyParams: ["{{name}}", "₹1, 000"], preview: "Hi {{name}}, refer a friend to Sara Electronics and you both get ₹1,000 off. No limit on referrals." },
  },
  {
    id: "store-visit", name: "Drive to store", category: "promotion",
    segments: ["all", "dormant", "at_risk"], theme: "brand", eyebrow: "Visit us",
    subject: "{{name}}, see it in person before you buy",
    preheader: "40+ stores. Live demos. In-store-only pricing.",
    headline: "Come see it working", subhead: "In-store-only prices on demo units",
    body: "Some things you need to see. Visit any of our 40+ stores for a live demo, and ask about in-store-only pricing that we cannot publish online.",
    cta: "Find my nearest store", ctaPath: "/store-locator",
    bullets: ["✓ 40+ stores", "✓ Live demos", "✓ Expert advice"],
    wa: { templateName: "sara_store_visit", bodyParams: ["{{name}}"], preview: "Hi {{name}}, visit your nearest Sara Electronics store for live demos and in-store-only prices." },
  },
  {
    id: "lucky-draw", name: "Lucky draw / spin & win", category: "promotion",
    segments: ["all", "active", "one_time"], theme: "festive", eyebrow: "Win something",
    subject: "{{name}}, you're entered — spin to win",
    preheader: "Every customer gets a spin. Prizes daily.",
    headline: "Spin and win", subhead: "Every order earns a spin",
    body: "Every customer gets a free spin on the prize wheel. Real prizes, drawn daily, and winners are notified the same day.",
    cta: "Spin the wheel", ctaPath: "/spin",
    bullets: ["✓ Free entry", "✓ Daily winners", "✓ Instant notification"],
    wa: { templateName: "sara_lucky_draw", bodyParams: ["{{name}}"], preview: "Hi {{name}}, spin the wheel at Sara Electronics for a chance to win. Free entry, daily prizes!" },
  },
  // ─── Backed by AskEva templates that are already approved, so these can send today ───
  {
    id: "retention-appliance-push", name: "Appliance retention push (WhatsApp-ready)", category: "lifecycle",
    segments: ["lapsed", "at_risk", "dormant", "cat_washing_machine", "cat_refrigerator", "cat_television", "cat_air_conditioner"],
    theme: "urgent", eyebrow: "Early bird hours",
    subject: "{{name}}, the best appliance deals go early",
    preheader: "9 AM to 12 PM only — early buyers get the best prices.",
    headline: "Early buyers get the best deals", subhead: "9 AM to 12 PM only",
    body: "Mobiles, TVs, ACs and appliances at special morning prices, with extra cashback and easy EMI. Stock at these prices is limited and does not last the day.",
    cta: "Shop the morning rush",
    bullets: ["✓ Special morning prices", "✓ Extra cashback", "✓ Easy EMI + assured gifts"],
    wa: { templateName: "the_epic_full_moon_day", bodyParams: [], preview: "EPIC FULL MOON MORNING RUSH — 9 AM to 12 PM ONLY. Early buyers get the BEST deals on Mobiles, TVs, ACs and Appliances." },
  },
  {
    id: "retention-super-sunday", name: "Super Sunday sale (WhatsApp-ready)", category: "promotion",
    segments: ["all", "dormant", "lapsed", "one_time", "high_spenders"],
    theme: "brand", eyebrow: "Super Sunday",
    subject: "{{name}}, Super Sunday prices are live",
    preheader: "Cashback, no-cost EMI and assured free gifts.",
    headline: "The Sara Super Sunday Sale is live", subhead: "Upgrade for less this Sunday",
    body: "Exclusive sale prices with up to ₹6,000 cashback, 0% no-cost EMI and up to 15 assured free gifts — on 100% genuine products with full brand warranty.",
    cta: "Shop Super Sunday",
    bullets: ["✓ Up to ₹6,000 cashback", "✓ 0% no-cost EMI", "✓ Assured free gifts"],
    wa: { templateName: "sara_super_sunday_week4", bodyParams: [], preview: "The Biggest Sara Super Sunday Sale is LIVE! Exclusive prices, up to ₹6,000 cashback, 0% No Cost EMI and up to 15 assured free gifts." },
  },]

function build(spec: Spec): CampaignTemplate {
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    segments: spec.segments,
    occasion: spec.occasion,
    subject: spec.subject,
    preheader: spec.preheader,
    html: renderEmail({
      theme: THEMES[spec.theme],
      eyebrow: spec.eyebrow,
      headline: spec.headline,
      subhead: spec.subhead,
      body: spec.body,
      ctaLabel: spec.cta,
      ctaHref: `${SITE}${spec.ctaPath ?? "/products"}`,
      bullets: spec.bullets,
      footnote: spec.footnote,
    }),
    whatsapp: {
      templateName: spec.wa.templateName,
      bodyParams: spec.wa.bodyParams,
      buttonUrlParam: spec.wa.buttonUrlParam,
      preview: spec.wa.preview,
    },
  }
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = SPECS.map(build)

export const TEMPLATE_BY_ID: Record<string, CampaignTemplate> = Object.fromEntries(
  CAMPAIGN_TEMPLATES.map((t) => [t.id, t]),
)

/** Templates written for a given audience, best match first. */
export function templatesForSegment(segment: string): CampaignTemplate[] {
  if (!segment || segment === "all") return CAMPAIGN_TEMPLATES
  const exact = CAMPAIGN_TEMPLATES.filter((t) => t.segments.includes(segment))
  const generic = CAMPAIGN_TEMPLATES.filter((t) => !t.segments.includes(segment) && t.segments.includes("all"))
  return [...exact, ...generic]
}
