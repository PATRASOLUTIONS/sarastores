"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrandMarquee from "@/components/BrandMarquee";
import HeroSection from "@/components/HeroSection";

const TermsAndConditionsPage = () => (
  <div className="flex flex-col min-h-screen">
    <Header />
    {/* <BrandMarquee />
    <HeroSection /> */}

    <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="heading-1 mb-6 text-center">
        Sara Mobiles and Electronics — Terms &amp; Conditions
      </h1>

      {/* 1. Delivery of Products */}
      <section className="mb-8">
        <h2 className="heading-3 mb-3 text-brand-primary">
          1. Delivery of Products
        </h2>
        <p className="text-justify mb-4">
          <strong>Delivery Region:</strong>Karnataka. Products purchased from{" "}
          <strong>Sara Mobiles and Electronics</strong> will be delivered within 7–8
          business days from the date of billing through our authorized courier
          partners.
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            Orders placed before <strong>12:00 PM</strong> will be billed the same
            business day. Orders placed after <strong>12:00 PM</strong> will be
            billed on the next business day.
          </li>
          <li>
            The <strong>Estimated Shipping Date</strong> refers to the date the
            product is dispatched from Sara Mobiles and Electronics.
          </li>
          <li>
            The <strong>Estimated Delivery Date</strong> refers to the day the
            customer receives the product, typically within 7–8 business days of
            dispatch.
          </li>
          <li>
            All deliveries are handled through reliable courier services operating
            in Tamil Nadu, Kerala, Karnataka, Andhra Pradesh, and Puducherry.
          </li>
          <li>
            For <strong>Cash on Delivery (COD)</strong> orders, customers must
            make payment directly to the delivery agent upon receiving the product.
          </li>
          <li>
            The original invoice will be enclosed in the shipment, and an order
            confirmation email will be sent to the registered email address.
          </li>
          <li>
            Products can be ordered from anywhere globally, but delivery addresses
            must be within our defined service regions.
          </li>
        </ul>
      </section>

      {/* 2. Refunds and Replacements */}
      <section className="mb-8">
        <h2 className="heading-3 mb-3 text-brand-primary">
          2. Refunds and Replacements
        </h2>
        <p className="text-justify mb-4">
          All products sold by{" "}
          <a
            href="/"
            className="text-brand-primary underline"
          >
            Sara Mobiles and Electronics
          </a>{" "}
          are covered under our conditional Replacement Guarantee. If any issue,
          defect, or damage is found within 3 days of delivery, please contact our
          Customer Care via the “Contact Us” page or call us at{" "}
          <a href="tel:+917892051553" className="text-brand-primary underline">
            +91 78920 51553
          </a>{" "}
          (Monday–Friday, 10:00 AM–6:00 PM IST).
        </p>

        <h3 className="text-lg font-semibold mb-2">
          Product Replacement & Installation Supervision Policy
        </h3>
        <ol className="list-decimal pl-6 space-y-2 mb-4">
          <li>
            <strong>Supervised Opening Requirement:</strong> Product replacement
            will be accepted only if the product is opened in the presence of a
            brand-authorised service provider agent.
          </li>
          <li>
            <strong>Mandatory Authorised Installation:</strong> Installation of the
            product must be carried out exclusively by a brand-authorised service
            agent.
          </li>
          <li>
            <strong>Approval for Replacement:</strong> The brand service agent must
            inspect and approve any damaged product for eligibility under the
            replacement policy.
          </li>
          <li>
            <strong>Non-Compliance:</strong> Products opened or installed without
            the supervision of a brand-authorised service provider agent will not
            be eligible for replacement.
          </li>
        </ol>
        <p className="mb-4">
          Once validated, the defective product will be recalled and a replacement
          dispatched.
        </p>

        <h3 className="text-lg font-semibold mb-2">Conditions for Replacement:</h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            The product must include all original packaging, accessories, manuals,
            and the retail box.
          </li>
          <li>
            Products with missing, altered, or tampered serial numbers will not be
            eligible for replacement.
          </li>
          <li>Cosmetic damages are not covered under the replacement policy.</li>
          <li>All products are insured against damage and theft during transit.</li>
          <li>
            If you receive a tampered or open package, please do not accept it and
            report immediately to Customer Care.
          </li>
        </ul>

        <h3 className="text-lg font-semibold mb-2">Refund Process:</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Refunds are initiated within 7–10 business days after receipt of the
            returned product.
          </li>
          <li>
            If the order is cancelled before shipping, no shipping charges will be
            deducted.
          </li>
          <li>
            If cancelled after dispatch, shipping costs will be deducted from the
            refund.
          </li>
          <li>
            For COD payments, refund processing may take longer due to courier
            settlement timelines.
          </li>
          <li>
            To process refunds, please provide: Account Holder Name, Bank Name,
            Account Number, IFSC Code, Order Number, and Reason for Refund.
          </li>
          <li>
            Refunds will be credited to your bank account or via cheque in the
            billing name. For gift card or voucher purchases, refunds will be issued
            as a new voucher of equal value with the same expiry date.
          </li>
        </ul>
      </section>

      {/* 3. Cancellation Policy */}
      <section className="mb-8">
        <h2 className="heading-3 mb-3 text-brand-primary">
          3. Cancellation Policy
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Orders cancelled before shipment are eligible for a full refund.
          </li>
          <li>
            Orders cancelled after shipment must be coordinated with Customer
            Support.
          </li>
          <li>
            If the product has already been delivered, it is only eligible for
            replacement in case of defects.
          </li>
          <li>
            If a customer refuses to accept delivery, two-way courier charges will
            be collected.
          </li>
        </ul>
      </section>

      {/* 4. Payment Terms */}
      <section className="mb-8">
        <h2 className="heading-3 mb-3 text-brand-primary">
          4. Payment Terms
        </h2>
        <p className="text-justify mb-4">
          For COD orders, payment must be made directly to the courier at delivery.
          The invoice will be included in the package and emailed to you.
        </p>
        <p>
          <strong>Accepted Payment Methods:</strong> Credit Cards, Debit Cards, Net
          Banking, Cash Cards, RTGS & NEFT, Cash on Delivery, EMI, UPI.
        </p>
      </section>

      {/* 5. COD */}
      <section className="mb-8">
        <h2 className="heading-3 mb-3 text-brand-primary">
          5. Cash on Delivery (COD)
        </h2>
        <p className="text-justify">
          COD allows you to pay in cash upon receiving the product. Do not accept
          packages that appear tampered or damaged, and do not pay more than the
          invoice amount. For any billing or delivery concerns, contact Customer
          Support immediately.
        </p>
      </section>

      {/* 6–10 Other Sections */}
      <section className="mb-8">
        <h2 className="heading-3 mb-3 text-brand-primary">6. Trademarks</h2>
        <p>
          The Sara Mobiles and Electronics logo and related branding are registered
          trademarks of Sara Mobiles and Electronics. They may not be copied, reproduced, or
          distributed without written permission.
        </p>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">
          7. Account Responsibility
        </h2>
        <p>
          Users are responsible for maintaining the confidentiality of their login
          credentials. You must be at least 18 years old to create an account or place
          an order directly. By accepting these Terms, creating an account, or placing
          an order, you confirm that you are 18 or older. If you are under 18, a parent
          or legal guardian must create the account and complete the purchase on your
          behalf. We do not ask for your date of birth during sign-up. We reserve the
          right to refuse service, cancel orders, or suspend accounts at our discretion.
        </p>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">
          8. Partner Products & Warranty
        </h2>
        <p>
          Sara Mobiles and Electronics partners with multiple brands and distributors to
          supply products. After-sales service and warranty support are provided
          directly by the respective manufacturers or authorized service centers.
        </p>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">
          9. Applicable Law & Jurisdiction
        </h2>
        <p>
          These Terms are governed by the laws of India, and any disputes shall fall
          under the jurisdiction of Bangalore, Karnataka. Sara Mobiles and Electronics
          reserves the right to modify these Terms & Conditions at any time without
          prior notice.
        </p>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">
          10. Communication Consent
        </h2>
        <p>
          By purchasing from us, you consent to receive transactional and promotional
          communications (via Email, SMS, WhatsApp, or Call) from Sara Mobiles
          and Electronics, its affiliates, and authorized service providers.
        </p>
        <p className="mt-4">
          All products sold by Sara Mobiles and Electronics are 100% genuine, brand-new, and
          sourced directly from authorized partners.
        </p>
      </section>

      <p className="mt-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Sara Mobiles and Electronics. All rights reserved.
      </p>
    </main>
    <Footer />
  </div>
);

export default TermsAndConditionsPage;
