import { pageMetadata } from "@/lib/seo-page"
import PolicyPage from "@/components/PolicyPage"

export const generateMetadata = pageMetadata({
  path: "/installation",
  title: (brand) => `Installation Support | ${brand}`,
  description:
    "Free standard installation and demonstration by certified SARA engineers on televisions, refrigerators, washing machines and air conditioners.",
})

export default function InstallationPage() {
  return (
    <PolicyPage
      eyebrow="Customer Service"
      title="Installation Support"
      intro="Delivery is only half the job. Our own certified engineers install the product, demonstrate it, and take the packaging away."
      footnote="Want to book or reschedule an installation?"
      sections={[
        {
          heading: "What is included",
          bullets: [
            "Standard installation on eligible products at no extra cost.",
            "A full working demonstration so you know how to use it before we leave.",
            "Removal of the packaging from your home.",
            "Registration of the product with the brand where that is required for warranty.",
          ],
        },
        {
          heading: "How scheduling works",
          body: "Installation is scheduled after delivery, usually within 24–48 hours. We call to agree a slot that suits you rather than turning up unannounced. For air conditioners and large appliances we confirm site readiness on that call.",
        },
        {
          heading: "What you need to have ready",
          bullets: [
            "A suitable power point within reach, and a stabiliser where the brand requires one.",
            "Water inlet and drain for washing machines and dishwashers.",
            "A cleared, load-bearing wall for television wall mounts.",
            "Outdoor unit access and drilling permission for split air conditioners.",
          ],
        },
        {
          heading: "Chargeable extras",
          body: "Standard installation is free. Materials and work beyond the standard scope — extra copper piping, core cutting, special brackets, stabilisers or additional wiring — are chargeable, and our engineer will tell you the cost and get your approval before starting.",
        },
        {
          heading: "After installation",
          body: "If something is not right after the engineer leaves, call us. Revisits related to the original installation are free.",
        },
      ]}
    />
  )
}
