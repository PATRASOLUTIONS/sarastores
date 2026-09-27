import { pageMetadata } from "@/lib/seo-page"
import PolicyPage from "@/components/PolicyPage"

export const generateMetadata = pageMetadata({
  path: "/returns",
  title: (brand) => `Returns & Refunds | ${brand}`,
  description:
    "How returns and refunds work at SARA — eligibility for damaged or defective products, the reporting window, and refund timelines.",
})

export default function ReturnsPage() {
  return (
    <PolicyPage
      eyebrow="Customer Service"
      title="Returns & Refunds"
      intro="Electronics are sold as final sale, but a damaged or defective product is always our problem to fix. Here is exactly how that works."
      footnote="Need help with a specific order?"
      sections={[
        {
          heading: "What is eligible",
          body: "We accept returns for products that arrive damaged, defective, or materially different from what was ordered. General change-of-mind returns are not accepted on electronics and home appliances.",
          bullets: [
            "Report damage or a defect within 48 hours of delivery.",
            "The product must include all original packaging, accessories, manuals and cables.",
            "The serial number must be intact, readable and untampered.",
            "Do not accept a package that arrives visibly tampered with — call us instead.",
          ],
        },
        {
          heading: "How to raise a request",
          body: "Call our support line, use the contact form, or walk into the store you bought from. Have your order number and a photograph of the issue ready — it lets us approve most requests the same day.",
        },
        {
          heading: "Replacement or refund",
          body: "Once the issue is verified we will either replace the unit or refund you, whichever you prefer and whichever the brand permits. Replacements are dispatched as soon as a matching unit is available at the nearest store or warehouse.",
        },
        {
          heading: "Refund timelines",
          bullets: [
            "Prepaid orders are refunded to the original payment method within 7–10 working days of the product reaching us.",
            "Cash on Delivery refunds take longer because they depend on courier settlement, and are paid by bank transfer.",
            "Shipping charges are deducted unless the issue was caused by us or the product was defective.",
          ],
        },
        {
          heading: "Cancellations",
          body: "Orders can be cancelled any time before dispatch for a full refund. Once a product has shipped, contact support immediately and we will try to intercept it. Same-day delivery orders cannot be cancelled.",
        },
      ]}
    />
  )
}
