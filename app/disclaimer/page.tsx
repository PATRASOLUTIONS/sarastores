import { pageMetadata } from "@/lib/seo-page"
import PolicyPage from "@/components/PolicyPage"

export const generateMetadata = pageMetadata({
  path: "/disclaimer",
  title: (brand) => `Disclaimer | ${brand}`,
  description:
    "Disclaimer covering product information, pricing, images, third-party brands and external links on the SARA website.",
})

export default function DisclaimerPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Disclaimer"
      intro="The information on this website is published in good faith and for general information only."
      footnote="Spotted something that looks wrong?"
      sections={[
        {
          heading: "Product information",
          body: "Specifications, features and descriptions are supplied by the manufacturer and are reproduced here as accurately as we can. Manufacturers change specifications without notice, so the product carton and the brand's own documentation are the final authority.",
        },
        {
          heading: "Images",
          body: "Product images are for representation. Colour, finish and bundled accessories may differ from what is shown on screen depending on your display and on the manufacturer's current production batch.",
        },
        {
          heading: "Pricing and availability",
          bullets: [
            "Prices are inclusive of GST and are subject to change without notice.",
            "Offers and discounts are valid only for the period stated and while stock lasts.",
            "In the rare case of an obvious pricing error, we may cancel the affected order and refund it in full.",
            "Stock shown online is indicative; store availability is confirmed when you order.",
          ],
        },
        {
          heading: "Third-party brands",
          body: "All brand names, logos and trademarks belong to their respective owners and are used here only to identify the products we sell as an authorised dealer. Their presence does not imply endorsement of SARA by those brands beyond our dealership.",
        },
        {
          heading: "External links",
          body: "Some pages link to websites we do not control. We are not responsible for their content, accuracy or privacy practices, and a link is not an endorsement.",
        },
        {
          heading: "Limitation of liability",
          body: "To the extent permitted by law, SARA is not liable for any indirect or consequential loss arising from use of this website. Nothing here limits your statutory rights as a consumer or the manufacturer's warranty obligations.",
        },
      ]}
    />
  )
}
