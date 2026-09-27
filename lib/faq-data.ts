/**
 * FAQ content, kept separate from the page so the server layout can emit
 * FAQPage structured data from the same source. Duplicating the copy into the
 * schema would guarantee the two drift apart.
 */

export interface FaqItem {
  q: string
  a: string
}

export interface FaqCategory {
  id: string
  label: string
  items: FaqItem[]
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "ordering",
    label: "Ordering",
    items: [
      { q: "How do I place an order?", a: "Browse products, add items to your cart, and proceed to checkout. Fill in your shipping details, choose a payment method, and confirm your order. You'll receive an order confirmation email immediately." },
      { q: "Can I place an order without creating an account?", a: "Yes, we support guest checkout. However, creating an account lets you track orders, save addresses, and access exclusive deals." },
      { q: "Can I modify or cancel my order after placing it?", a: "Order modifications are not possible once placed. Cancellations are also not available — once an order is confirmed, it cannot be cancelled. Please ensure your order details are correct before confirming. Contact support only for urgent cases." },
      { q: "I didn't receive an order confirmation email. What should I do?", a: "Check your spam/junk folder first. If it's not there, log into your account and check My Orders. If the order doesn't appear, contact support with your payment screenshot." },
      { q: "What if an item I want is out of stock?", a: "Out-of-stock items show an \"Notify Me\" button. Click it and we'll email you when the product is back in restocked. You can also check nearby stores for availability." },
      { q: "Can I order multiple items from different brands?", a: "Yes, you can add products from any brand to a single cart and checkout once. Items may ship separately depending on warehouse locations." },
      { q: "Is there a minimum order value?", a: "No, there is no minimum order value. However, free shipping may have a minimum threshold — check the shipping policy on the product page." },
    ],
  },
  {
    id: "payment",
    label: "Payment",
    items: [
      { q: "What payment methods do you accept?", a: "We accept UPI (Google Pay, PhonePe, Paytm), credit/debit cards (Visa, Mastercard, RuPay), net banking, EMI, and Cash on Delivery (COD) for eligible orders." },
      { q: "Is Cash on Delivery (COD) available?", a: "COD is available for orders up to ₹50,000 in select pin codes. Enter your pin code at checkout to check eligibility. COD orders require OTP verification at delivery." },
      { q: "My payment was deducted but I didn't get an order confirmation. What should I do?", a: "This usually means the payment was captured but the order wasn't created due to a timeout. The amount will be refunded automatically within 5-7 business days. If not refunded, contact support with your bank statement." },
      { q: "Can I pay via EMI?", a: "Yes, EMI is available on credit cards from major banks (HDFC, ICICI, SBI, Axis, etc.). Select EMI at checkout and choose your tenure. No-cost EMI is available on select products." },
      { q: "Do you accept international credit cards?", a: "Currently, we only accept Indian-issued credit/debit cards and UPI. International cards are not supported." },
      { q: "My payment failed. Will I be charged?", a: "Failed payments are not charged. If you see a deduction, it's a temporary authorization hold that will be released within 3-5 business days depending on your bank." },
      { q: "How do I get a GST invoice?", a: "GST invoices are generated automatically for all orders. You can download it from My Orders > Order Details > Download Invoice." },
    ],
  },
  {
    id: "shipping",
    label: "Shipping & Delivery",
    items: [
      { q: "How long does delivery take?", a: "Standard delivery takes 5-8 business days depending on your location. Metro cities receive orders faster (3-5 days). Remote areas may take 7-10 business days." },
      { q: "Do you offer free shipping?", a: "Yes, free shipping is available on most products. Some heavy/bulky items (TVs, refrigerators, washing machines) may have a delivery charge based on pin code." },
      { q: "How do I check if you deliver to my area?", a: "Enter your pin code on the product page under \"Delivery\" section. If delivery is available, you'll see the estimated delivery date and shipping charges." },
      { q: "Can I choose a specific delivery time slot?", a: "Currently, we offer standard delivery (10 AM - 7 PM). For large appliances, you may get a preferred time slot option during checkout. We're working on adding more time slots." },
      { q: "What if I'm not home during delivery?", a: "Our delivery partner will call you before delivery. If you're unavailable, they'll attempt delivery the next day. For COD orders, the delivery partner will reschedule." },
      { q: "Do you deliver on weekends and holidays?", a: "Yes, deliveries happen on weekends and public holidays in most areas. However, delivery timelines may be extended during festivals and peak seasons." },
      { q: "Can I change my delivery address after placing the order?", a: "Address changes are possible only before the order is shipped. Go to My Orders > Modify Address. Once shipped, the address cannot be changed." },
    ],
  },
  {
    id: "tracking",
    label: "Order Tracking",
    items: [
      { q: "How do I track my order?", a: "After your order ships, you'll receive a tracking link via email and SMS. You can also track from My Orders > Track Order. Our live tracking shows real-time shipment status with animated visualization." },
      { q: "I haven't received a tracking number. What should I do?", a: "Tracking numbers are sent within 24-48 hours of order placement. Check your email spam folder. If you still haven't received it after 48 hours, contact support." },
      { q: "My order status shows 'Shipped' but hasn't moved. What should I do?", a: "Tracking updates can lag by 24-48 hours due to carrier scanning delays. If no update appears after 3 days, contact support with your order ID." },
      { q: "The tracking shows 'Delivered' but I haven't received my package.", a: "First check with neighbors or building security. If you still can't find it, contact us within 48 hours of the delivery status update. We'll investigate with our shipping partner." },
      { q: "Can I track multiple orders at once?", a: "Yes, go to My Orders and you'll see all your orders with their current status. Click any order to see detailed tracking information." },
    ],
  },
  {
    id: "returns",
    label: "Replacement & Returns",
    items: [
      { q: "What is your replacement policy?", a: "We offer replacements only for damaged, defective, or wrong items. No returns are accepted. If you receive a damaged or incorrect product, we'll arrange a free replacement within 48 hours of delivery." },
      { q: "How do I request a replacement?", a: "Go to My Orders, select the order, and click 'Report Issue.' Upload photos of the damaged or defective item and describe the problem. Our team will review and arrange a replacement within 24-48 hours." },
      { q: "How long does replacement take?", a: "Once your replacement request is approved, we'll arrange pickup and deliver a new product within 3-7 business days depending on your location and product availability." },
      { q: "Can I get a refund instead of a replacement?", a: "No, we do not offer refunds. We only provide replacements for damaged, defective, or wrong items delivered to you." },
      { q: "What items are non-replaceable?", a: "Replacements are only for damaged or defective items reported within 48 hours of delivery. Software licenses, gift cards, and personal care items cannot be replaced. All sales are final for other cases." },
      { q: "What if the replacement product is also damaged or wrong?", a: "Contact us immediately with photos. We'll escalate to our quality team and arrange another replacement or work with the brand service center directly." },
    ],
  },
  {
    id: "warranty",
    label: "Warranty & Replacement",
    items: [
      { q: "Do products come with a manufacturer warranty?", a: "Yes, all products come with the manufacturer's warranty (typically 1-2 years). Warranty period is mentioned on the product page. Sara Electronics is an authorized dealer." },
      { q: "How do I claim warranty?", a: "Contact the manufacturer's authorized service center with your purchase invoice from Sara Electronics. We can help you locate the nearest service center." },
      { q: "What if my product is damaged during delivery?", a: "Report the damage within 48 hours of delivery. Go to My Orders > Report Issue, upload photos, and we'll arrange a free replacement at no extra cost." },
      { q: "Can I get an extended warranty?", a: "Extended warranty options are available for select products at checkout. You can also purchase extended warranty within 7 days of delivery from My Orders." },
      { q: "My product stopped working after 2 weeks. Can I get a replacement?", a: "If within 48 hours of delivery, we'll arrange a replacement. After 48 hours, you'll need to use the manufacturer's warranty. Contact us and we'll guide you to the nearest service center." },
    ],
  },
  {
    id: "account",
    label: "Account & Profile",
    items: [
      { q: "How do I create an account?", a: "Click \"Sign Up\" in the top-right corner. Enter your email or phone number, verify with OTP, and set a password. You can also sign up during checkout." },
      { q: "I forgot my password. How do I reset it?", a: "Click \"Forgot Password\" on the login page. Enter your registered email or phone number. You'll receive an OTP to set a new password." },
      { q: "How do I update my profile information?", a: "Go to My Account > Profile. You can update your name, email, phone number, and profile picture." },
      { q: "How do I add or manage delivery addresses?", a: "Go to My Account > Addresses. You can add up to 5 delivery addresses, set a default address, and edit or delete existing addresses." },
      { q: "Can I have multiple accounts with the same phone number?", a: "No, each phone number can only be associated with one account. If you need to change your registered number, update it in Profile settings." },
    ],
  },
  {
    id: "products",
    label: "Products",
    items: [
      { q: "Are all products genuine and original?", a: "Yes, 100% genuine. Sara Electronics is an authorized dealer for all brands we sell. Every product comes with manufacturer warranty and original packaging." },
      { q: "Why are some products cheaper on your site?", a: "We offer competitive pricing through direct partnerships with brands and distributors. We pass the savings to you without compromising on authenticity." },
      { q: "Can I compare products on your website?", a: "Yes! Use the \"Compare\" feature on product cards to compare specifications side by side. You can compare up to 6 products at once." },
      { q: "Do you offer product demonstrations?", a: "For select products, we have video demos and 360° views on the product page. For in-store demos, visit our physical store in Bengaluru." },
      { q: "How do I know if a product is compatible with my devices?", a: "Check the \"Specifications\" tab on the product page for detailed compatibility information. You can also contact our support team for specific compatibility questions." },
    ],
  },
  {
    id: "store",
    label: "Store & In-Store",
    items: [
      { q: "Where is your physical store?", a: "Our store is located at #23/1, 1st Floor, J.C. 1st Cross, JC Road, near Poornima Theatre, Bengaluru, Karnataka 560027." },
      { q: "What are the store hours?", a: "We're open Monday to Saturday, 10:00 AM to 6:00 PM IST. Closed on Sundays and public holidays." },
      { q: "Can I buy online and pick up in-store?", a: "Yes, in-store pickup is available for select products. Choose \"Pickup from Store\" at checkout. You'll get a notification when your order is ready for collection." },
      { q: "Can I see products before buying online?", a: "Yes, visit our store to see and test products before purchasing online. Our staff can help you choose the right product." },
    ],
  },
  {
    id: "support",
    label: "Support & Complaints",
    items: [
      { q: "How do I contact customer support?", a: "You can reach us via phone, email, or live chat during business hours (Mon-Sat, 10 AM - 6 PM IST). For urgent issues, call us directly. You can also submit a complaint from the Complaints page." },
      { q: "How do I file a complaint?", a: "Go to /complaints and fill in the complaint form with your order ID, issue type, and description. You'll receive a complaint tracking number and updates via email." },
      { q: "How long does it take to resolve a complaint?", a: "We acknowledge complaints within 2 hours and aim to resolve them within 24-48 hours. Complex issues may take up to 5 business days. You'll get status updates throughout." },
      { q: "Can I escalate my complaint?", a: "If you're not satisfied with the resolution, reply to the complaint email requesting escalation. A senior team member will review your case within 24 hours." },
      { q: "Do you offer live chat support?", a: "Live chat is available during business hours. Click the chat icon in the bottom-right corner of any page to connect with a support agent." },
    ],
  },
  {
    id: "promotions",
    label: "Promotions & Spin Wheel",
    items: [
      { q: "How does the Spin the Wheel work?", a: "Spin the Wheel is a promotional game where you can win exciting prizes. Register with your phone number, spin the wheel, and if you win, you'll receive a coupon code. Visit /spin to play." },
      { q: "Can I spin the wheel multiple times?", a: "No, each user can spin only once per campaign. Duplicate registrations from the same phone number are not allowed." },
      { q: "How do I use my spin wheel coupon code?", a: "Apply the coupon code at checkout in the \"Coupon Code\" field. The discount will be applied to your order total. Check the coupon terms for minimum order value." },
      { q: "My spin wheel coupon isn't working. What should I do?", a: "Check if the coupon has expired, if there's a minimum order value, or if it's applicable to your selected products. If the issue persists, contact support with the coupon code." },
      { q: "How do I participate in ongoing promotions?", a: "Check the homepage banners and the Spin Wheel page for ongoing promotions. Subscribe to our newsletter for exclusive deals and early access to sales." },
    ],
  },
  {
    id: "software",
    label: "Software & Licenses",
    items: [
      { q: "How do I purchase software licenses?", a: "Browse the Software section, add licenses to your cart, and checkout. You'll receive the license key via email within 5 minutes of payment confirmation." },
      { q: "How do I activate my software license?", a: "Follow the activation instructions sent to your email. Typically, you'll need to enter the license key in the software's activation dialog. Contact support if you face issues." },
      { q: "Can I transfer my software license to another computer?", a: "It depends on the software's licensing terms. Most licenses are per-device. Some allow deactivation on one device and reactivation on another. Check the product details." },
      { q: "My license key isn't working. What should I do?", a: "First, ensure you're entering the key correctly (no extra spaces). If it still doesn't work, contact support with your order ID and the error message you're seeing." },
    ],
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    items: [
      { q: "Is my personal information safe?", a: "Yes, we use industry-standard SSL encryption and follow strict data protection protocols. We never sell or share your personal data with third parties for marketing purposes." },
      { q: "Do you store my credit card details?", a: "No, we never store your credit card or banking details. All payment processing is handled by certified payment gateways (Razorpay) with PCI-DSS compliance." },
      { q: "How do I delete my account?", a: "Contact support to request account deletion. We'll process your request within 7 business days. Note: This action is irreversible and all your data will be permanently removed." },
      { q: "Can I opt out of marketing emails?", a: "Yes, click \"Unsubscribe\" at the bottom of any marketing email. You can also manage your notification preferences in My Account > Settings." },
      { q: "What data do you collect and why?", a: "We collect only necessary data: name, email, phone, and address for order fulfillment. We use analytics to improve your experience. See our Privacy Policy for full details." },
    ],
  },
]

/** schema.org FAQPage node built from the same copy the page renders. */
export function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_CATEGORIES.flatMap((category) =>
      category.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    ),
  }
}
