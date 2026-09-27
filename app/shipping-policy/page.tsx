import { pageMetadata } from "@/lib/seo-page"
import PolicyPage from "@/components/PolicyPage"

export const generateMetadata = pageMetadata({
  path: "/shipping-policy",
  title: (brand) => `Shipping & Delivery Policy | ${brand}`,
  description:
    "Delivery coverage across Karnataka, dispatch and delivery timelines, shipping charges, and what happens on delivery day at SARA.",
})

export default function ShippingPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Customer Service"
      title="Shipping & Delivery Policy"
      intro="We deliver with our own teams wherever we can, which is why installation and after-sales stay with the same people who dropped the box off."
      footnote="Question about a delivery in progress?"
      sections={[
        {
          heading: "Where we deliver",
          body: "We deliver across Karnataka from our store network, and to most serviceable pincodes elsewhere in India through our logistics partners. Enter your pincode on any product page to confirm availability before you order.",
        },
        {
          heading: "Dispatch and delivery time",
          bullets: [
            "Orders placed before the daily cut-off are picked and dispatched the same working day.",
            "Metro and store-served pincodes in Karnataka typically receive delivery in 1–3 working days.",
            "Other serviceable pincodes take 3–7 working days depending on distance and product size.",
            "Large appliances are scheduled with you by phone before the vehicle is loaded.",
          ],
        },
        {
          heading: "Shipping charges",
          body: "Delivery is free above the order value shown at checkout. Below that threshold a flat shipping fee applies, and it is always displayed in the order summary before you pay — never added afterwards.",
        },
        {
          heading: "On delivery day",
          bullets: [
            "Check the outer packaging before signing. If the carton is damaged, refuse the delivery and call us.",
            "Keep the invoice and the box until installation is complete and the product has been demonstrated.",
            "Someone over 18 must be present to receive and sign for the order.",
          ],
        },
        {
          heading: "Failed or delayed deliveries",
          body: "If nobody is available, the courier will reattempt delivery. After repeated failed attempts the order is returned to us and refunded, with a two-way shipping charge deducted. Delays caused by weather, strikes or other events outside our control are communicated as soon as we know.",
        },
      ]}
    />
  )
}
