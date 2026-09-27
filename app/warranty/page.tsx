import { pageMetadata } from "@/lib/seo-page"
import PolicyPage from "@/components/PolicyPage"

export const generateMetadata = pageMetadata({
  path: "/warranty",
  title: (brand) => `Warranty | ${brand}`,
  description:
    "Every product sold by SARA carries the full manufacturer warranty, serviced through authorised service centres. Here is how to claim it.",
})

export default function WarrantyPage() {
  return (
    <PolicyPage
      eyebrow="Customer Service"
      title="Warranty"
      intro="We are a brand-authorised dealer. Everything we sell carries the complete manufacturer warranty — not a store-level substitute."
      footnote="Need help raising a warranty claim?"
      sections={[
        {
          heading: "What you get",
          bullets: [
            "Full manufacturer warranty on every product, for the period the brand specifies.",
            "Service through the brand's authorised service centres, not a third-party workshop.",
            "A GST-compliant invoice, which is the document your warranty is registered against.",
          ],
        },
        {
          heading: "How long it lasts",
          body: "Warranty length is set by the manufacturer and varies by product and component — for example, many refrigerators carry one year on the appliance and a longer separate term on the compressor. The exact terms are printed in the warranty card in the box and listed on the product page.",
        },
        {
          heading: "Raising a claim",
          bullets: [
            "Keep your SARA invoice — it is the proof of purchase date.",
            "Call our support line and we will log the claim with the brand on your behalf.",
            "Or walk into the store you bought from with the product and invoice.",
            "For large appliances, the brand's engineer visits your home; you do not need to transport the unit.",
          ],
        },
        {
          heading: "What is not covered",
          bullets: [
            "Physical damage, liquid ingress, and damage from voltage fluctuation without a stabiliser where one is required.",
            "Unauthorised repair, modification, or a tampered/removed serial number.",
            "Consumables and normal wear such as filters, belts and batteries, unless the brand states otherwise.",
          ],
        },
        {
          heading: "Extended warranty",
          body: "Extended warranty plans are available on selected products at the time of purchase. Ask in store or on the phone before you check out — these plans cannot be added after the sale is complete.",
        },
      ]}
    />
  )
}
