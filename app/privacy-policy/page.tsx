"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrandMarquee from "@/components/BrandMarquee";
import HeroSection from "@/components/HeroSection";

export default function PrivacyPolicy() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* <BrandMarquee />
      <HeroSection /> */}
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <h1 className="heading-1 mb-6">Privacy Policy</h1>
        <p className="mb-4 text-gray-700">
          At <strong>Sara Mobiles and Electronics</strong>, we value your privacy and are committed to protecting your
          personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you visit our website or use our services.
        </p>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">1. Information We Collect</h2>
        <p className="mb-3">
          We may collect the following types of information when you interact with our website:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Personal Information:</strong> Name, email address, phone number, and billing details when you make a purchase or contact us.</li>
          <li><strong>Technical Information:</strong> IP address, browser type, device information, and usage data collected through cookies and analytics tools.</li>
          <li><strong>Payment Information:</strong> Processed securely through trusted third-party gateways. We do not store full card details.</li>
        </ul>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">2. How We Use Your Information</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>To process and complete your orders or service requests.</li>
          <li>To communicate with you regarding purchases, updates, or support inquiries.</li>
          <li>To improve our website, products, and customer experience.</li>
          <li>To comply with legal requirements and prevent fraudulent activity.</li>
        </ul>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">3. Data Protection</h2>
        <p className="mb-4">
          We use secure servers, encryption, and other industry-standard measures to protect your data.
          Access to your information is restricted to authorized personnel only.
        </p>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">4. Sharing of Information</h2>
        <p className="mb-4">
          We do not sell or rent your personal information. We may share limited data with trusted
          partners or service providers who assist in operating our business — such as payment gateways,
          shipping providers, and analytics tools — under strict confidentiality agreements.
        </p>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">5. Cookies & Tracking</h2>
        <p className="mb-4">
          Our website uses cookies to enhance your browsing experience and collect analytics. You may
          choose to disable cookies in your browser settings, but some features of the site may not
          function properly.
        </p>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">6. Your Rights</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>You can request access to, correction of, or deletion of your personal data.</li>
          <li>You may opt out of marketing emails at any time.</li>
          <li>For any privacy-related requests, please contact us using the details below.</li>
        </ul>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">7. Third-Party Links</h2>
        <p className="mb-4">
          Our site may contain links to external websites. We are not responsible for the privacy
          practices or content of those third-party sites.
        </p>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">8. Updates to This Policy</h2>
        <p className="mb-4">
          We may update this Privacy Policy from time to time. Any changes will be posted on this page
          with an updated revision date. Continued use of our website after changes signifies your
          acceptance of the updated policy.
        </p>

        <h2 className="heading-3 mt-8 mb-2 text-brand-primary">9. Contact Us</h2>
        <p className="mb-4">
          If you have any questions or concerns regarding this Privacy Policy or how we handle your data,
          please contact:
        </p>
        <p className="mb-2">
          <strong>Grievance Officer</strong><br />
          Sara Mobiles and Electronics<br />
          Email: <a href="mailto:info@saramobiles.com" className="text-brand-primary underline">info@saramobiles.com</a><br />
          Phone: <a href="tel:+917892051553" className="text-brand-primary underline">+91 78920 51553</a><br />
          Address: #23/1, 1st Floor, J.C. 1st Cross, JC Road, Bengaluru, Karnataka 560027
        </p>

        <p className="mt-8 text-sm text-gray-500 text-center">
          © {new Date().getFullYear()} Sara Mobiles and Electronics. All rights reserved.
        </p>
      </main>
      <Footer />
    </div>
  )
}
