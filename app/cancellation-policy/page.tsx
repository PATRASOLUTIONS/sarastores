"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrandMarquee from "@/components/BrandMarquee";
import HeroSection from "@/components/HeroSection";

export default function CancellationPolicy() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* <BrandMarquee />
      <HeroSection /> */}
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <h1 className="heading-1 mb-6">Cancellation Policy</h1>
        <p className="mb-4 text-justify">
          Thank you for choosing <strong>Sara Mobiles and Electronics</strong>. Please read our
          cancellation and refund policies carefully before making a purchase.
        </p>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">Terms and Conditions for Cancellation</h2>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Cancellations will be taken into consideration at any time before the delivery of the product.</li>
          <li>If you cancel your order before it has been shipped, we will refund the entire amount.</li>
          <li>Cancellation will not be accepted for orders placed under the <strong>Same Day Delivery</strong> category.</li>
          <li>If your product has shipped but has not yet been delivered, please contact Customer Support and inform them of the same.</li>
          <li>
            If you have already received the product, it will only be eligible for replacement in cases where there are verified defects with the product.
          </li>
          <li>
            When the product is delivered by courier and the customer does not accept the package, a two-way shipment charge will be collected from the customer.
          </li>
        </ul>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">Replacement Policy (Damaged / Defective Items Only)</h2>
        <p className="mb-3 text-justify">
          We at <strong>Sara Mobiles and Electronics</strong> strive to provide high-quality electronic products. All sales are final and we do not accept general returns or exchanges. However, if you receive a damaged or defective product, Sara Mobiles and Electronics will assist you with a replacement or refund in accordance with the following policy:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Replacements are only accepted for items that arrive damaged or defective.</li>
          <li>Proof of damage or defect must be provided within <strong>48 hours</strong> of delivery.</li>
          <li>Products must include all original packaging, accessories, manuals, cables, and any other items that were originally included.</li>
          <li>Items without a valid, readable, and untampered serial number will not be eligible for replacement.</li>
          <li>
            If you receive a package that appears tampered with, please do not accept it and contact our customer care immediately.
          </li>
          <li>
            Refunds will be processed within <strong>7–10 working days</strong> once we receive the product. Shipping charges may be deducted unless the issue is due to our error or a defective item.
          </li>
          <li>
            Refunds for payments made via Cash on Delivery (COD) may take longer as they depend on courier settlement.
          </li>
          <li>Sara Mobiles and Electronics reserves the right to accept or reject replacement/refund requests at its sole discretion.</li>
        </ul>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">How to Report a Damaged or Defective Item</h2>
        <p className="mb-3 text-justify">
          To report a damaged or defective item, please contact our Customer Care team via the details provided below. You will need to share:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Your Order Number</li>
          <li>Clear photos of the damaged or defective item</li>
          <li>Description of the issue</li>
          <li>Bank account details for refund (if applicable): Account Holder Name, Bank Name, Account Number, and IFSC Code</li>
        </ul>

        <h2 className="heading-3 mt-8 mb-3 text-brand-primary">Grievance Officer</h2>
        <p className="mb-3 text-justify">
          In case of escalation of customer service enquiries regarding defects or service complaints, please contact our Grievance Officer at the address below:
        </p>
        <div className="border-l-4 border-brand-primary bg-brand-primary-subtle/40 rounded-r-lg pl-4 py-3 mb-6">
          <p><strong>Sara Mobiles and Electronics</strong></p>
          <p>Grievance Officer</p>
          <p>#23/1, 1st Floor, J.C. 1st Cross, JC Road, Near Poornima Theatre,</p>
          <p>Bengaluru, Karnataka – 560027</p>
          <p>📞 <a href="tel:+917892051553" className="text-brand-primary underline">+91 78920 51553</a></p>
          <p>✉️ <a href="mailto:info@saramobiles.com" className="text-brand-primary underline">info@saramobiles.com</a></p>
        </div>

        <p className="text-sm text-gray-600">
          This policy is subject to change without prior notice. Please check this page periodically for updates.
        </p>
      </main>
      <Footer />
    </div>
  );
}
