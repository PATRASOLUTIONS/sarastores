import { pageMetadata } from "@/lib/seo-page"
import PolicyPage from "@/components/PolicyPage"

export const generateMetadata = pageMetadata({
  path: "/emi",
  title: (brand) => `EMI Options | ${brand}`,
  description:
    "No-cost EMI, bank card EMI and cardless finance at SARA. Tenure options, eligibility and how the instalment is calculated.",
})

export default function EmiPage() {
  return (
    <PolicyPage
      eyebrow="Customer Service"
      title="EMI Options"
      intro="Split a large purchase into monthly instalments without paying more than the sticker price."
      footnote="Not sure which plan suits you?"
      sections={[
        {
          heading: "No-cost EMI",
          body: "On eligible products the interest is absorbed as a discount, so the total you pay across all instalments equals the product price. The applicable plans and tenures are shown on the product page and again at checkout before payment.",
          bullets: [
            "Available on orders above the threshold shown at checkout.",
            "Tenures of 3, 6, 9, 12, 18 and 24 months depending on the product and bank.",
            "Offered on major credit cards and on selected debit cards.",
          ],
        },
        {
          heading: "Standard bank EMI",
          body: "Where no-cost EMI is not available, standard EMI at the bank's published interest rate can still be selected at checkout. The bank charges the interest directly — SARA does not add anything on top.",
        },
        {
          heading: "Cardless EMI",
          body: "If you do not hold a credit card, cardless finance from our partner lenders is available subject to their approval and documentation. Ask in store or on the phone before placing the order.",
        },
        {
          heading: "What you should know",
          bullets: [
            "Eligibility, tenure and the final rate are decided by your bank or lender, not by SARA.",
            "Some banks levy a processing fee or GST on the interest component; that is outside our control.",
            "Cancelling an EMI order after the bank has booked the plan may leave bank charges that we cannot reverse.",
            "The price shown is GST-inclusive and a proper invoice is issued on every EMI order.",
          ],
        },
      ]}
    />
  )
}
