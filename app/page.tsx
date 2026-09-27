import SaraLanding from "@/components/home/SaraLanding"

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What products does Sara Electronics sell?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sara Electronics sells a wide range of electronics including televisions, refrigerators, washing machines, air conditioners, smartphones, laptops, and home appliances from top brands at competitive prices with fast delivery across India.",
      },
    },
    {
      "@type": "Question",
      name: "What is the Sara Rewards Club?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The Sara Rewards Club is our upcoming free loyalty programme, launching soon. Once live, you will earn Sara Coins on every order and be able to redeem them against future purchases, with higher tiers earning more. Sara customers already enjoy no-cost EMI, free installation and store pickup today.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer free delivery?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sara Electronics offers free delivery on most products across India. Delivery times may vary based on your location and product availability.",
      },
    },
    {
      "@type": "Question",
      name: "What is the return policy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sara Electronics offers a hassle-free return policy. If you are not satisfied with your purchase, you can initiate a return within the specified return window. Please check our cancellation and return policy for detailed information.",
      },
    },
    {
      "@type": "Question",
      name: "Are the products genuine?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, all products sold on Sara Electronics are 100% genuine and come with manufacturer warranty. We are an authorized dealer for all the brands we carry.",
      },
    },
  ],
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-[#EEF2F7]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_JSON_LD),
        }}
      />

      <SaraLanding />
    </div>
  )
}
