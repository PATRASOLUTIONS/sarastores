import { pageMetadata } from "@/lib/seo-page"
import PolicyPage from "@/components/PolicyPage"

export const generateMetadata = pageMetadata({
  path: "/corporate-information",
  title: (brand) => `Corporate Information | ${brand}`,
  description:
    "Registered entity details, business activity, compliance and grievance officer contact for SARA Mobiles & Electronics.",
})

export default function CorporateInformationPage() {
  return (
    <PolicyPage
      eyebrow="About SARA"
      title="Corporate Information"
      intro="Statutory and business details for the entity that operates this website and our retail network."
      footnote="Need a document we have not published here?"
      sections={[
        {
          heading: "About the business",
          body: "SARA is a Karnataka-based electronics and home appliance retailer operating a network of neighbourhood stores alongside this online storefront. We sell mobiles, televisions, large and small appliances and computing products from leading brands as an authorised dealer, and we deliver, install and service them with our own teams.",
        },
        {
          heading: "Registered details",
          bullets: [
            "Entity: the legal name shown in the footer of this website.",
            "Registered office and correspondence address: as published on our Contact page.",
            "GSTIN and PAN: printed on every invoice we issue.",
            "Nature of business: retail and online trade in consumer electronics and home appliances.",
          ],
        },
        {
          heading: "Compliance",
          body: "We invoice with GST, sell only brand-authorised stock through official channels, and honour the manufacturer warranty on every unit. Consumer complaints are handled under the Consumer Protection Act and the e-commerce rules made under it.",
        },
        {
          heading: "Grievance redressal",
          body: "If a complaint is not resolved to your satisfaction by our support team, escalate it through the Contact page marking it for the Grievance Officer. We acknowledge escalations within 48 hours and aim to resolve them within one month, as required by the e-commerce rules.",
        },
        {
          heading: "Business and bulk enquiries",
          body: "Corporate, institutional and bulk purchase requests are handled by a dedicated team. Use the Business Enquiries page so your request reaches them directly rather than the retail queue.",
        },
      ]}
    />
  )
}
