import Link from "next/link"
import { Building2, Code2, Shield, Wrench, ChevronRight, Calendar, ExternalLink } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export const metadata = {
  title: "Credits & Site Information | Sara Mobiles & Electronics",
  description: "Technical acknowledgements, engineering credits, and platform information for Sara Mobiles & Electronics.",
  robots: "noindex, follow",
}

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Bytewise Consulting LLP",
  "url": "https://bytewiseconsulting.in",
  "sameAs": ["https://www.linkedin.com/company/bytewise-consulting"],
  "description": "Software engineering and technology consulting services",
}

export default function CreditsPage() {
  const currentYear = new Date().getFullYear()
  const lastUpdated = new Date().toLocaleDateString("en-IN", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  })

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 md:py-16">
        {/* Breadcrumb */}
        <div className="section-container mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-600">
            <Link href="/" className="hover:text-brand-primary transition-colors">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium">Credits</span>
          </nav>
        </div>

        <div className="section-container">
          <div className="max-w-4xl mx-auto">
            {/* Hero Card */}
            <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-brand-primary to-brand-primary-hover px-6 md:px-10 py-8 md:py-10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Credits & Site Information</h1>
                    <p className="text-blue-100 text-sm md:text-base">Technical acknowledgement and platform engineering details</p>
                  </div>
                </div>
              </div>

              {/* Content Section */}
              <div className="px-6 md:px-10 py-8 md:py-10 space-y-8">
                {/* Engineering & Maintenance */}
                <section aria-labelledby="engineering-heading">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Code2 className="h-5 w-5 text-brand-primary" />
                    </div>
                    <h2 id="engineering-heading" className="text-xl font-semibold text-gray-900">Engineering & Maintenance</h2>
                  </div>
                  
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    This platform was engineered and is maintained by{" "}
                    <a 
                      href="https://bytewiseconsulting.in" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-primary font-medium hover:text-brand-primary-hover transition-colors"
                    >
                      Bytewise Consulting LLP
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    , a software engineering and technology consulting firm specializing in scalable web applications.
                  </p>

                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                      <dt className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
                        <Wrench className="h-4 w-4 text-brand-primary" />
                        Services Provided
                      </dt>
                      <dd className="text-sm text-gray-700 leading-relaxed">
                        Full-stack development, UI/UX implementation, performance optimization, cloud hosting & deployment, security hardening, accessibility compliance (WCAG), SEO optimization, and continuous maintenance & support.
                      </dd>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                      <dt className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        Technical Support
                      </dt>
                      <dd className="text-sm text-gray-700 leading-relaxed">
                        For technical assistance, bug reports, or platform inquiries, please use our{" "}
                        <Link href="/contact" className="text-brand-primary hover:underline font-medium">
                          Contact Page
                        </Link>
                        {" "}or reach out to the site administrator.
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Legal & Attribution */}
                <section aria-labelledby="legal-heading" className="pt-6 border-t border-gray-200">
                  <h2 id="legal-heading" className="text-lg font-semibold text-gray-900 mb-3">Legal & Attribution</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    This page serves as a formal acknowledgement of the technical partner responsible for the engineering, 
                    development, and ongoing maintenance of this e-commerce platform. This disclosure does not constitute 
                    an endorsement or representation beyond the scope of technical services provided under contract.
                  </p>
                </section>


                {/* Related Links */}
                <section aria-labelledby="links-heading" className="pt-6 border-t border-gray-200">
                  <h2 id="links-heading" className="text-lg font-semibold text-gray-900 mb-4">Related Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link 
                      href="/privacy-policy" 
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                    >
                      <span className="text-sm font-medium text-gray-900">Privacy Policy</span>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-brand-primary transition-colors" />
                    </Link>
                    <Link 
                      href="/terms-and-conditions" 
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                    >
                      <span className="text-sm font-medium text-gray-900">Terms & Conditions</span>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-brand-primary transition-colors" />
                    </Link>
                    <Link 
                      href="/about" 
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                    >
                      <span className="text-sm font-medium text-gray-900">About Us</span>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-brand-primary transition-colors" />
                    </Link>
                    <Link 
                      href="/contact" 
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                    >
                      <span className="text-sm font-medium text-gray-900">Contact Us</span>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-brand-primary transition-colors" />
                    </Link>
                  </div>
                </section>
              </div>

              {/* Footer Section */}
              <div className="px-6 md:px-10 py-5 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Last updated: {lastUpdated}</span>
                  </div>
                  <span>© {currentYear} Sara Mobiles & Electronics. All rights reserved.</span>
                </div>
              </div>
            </div>

            {/* Back to Home CTA */}
            <div className="mt-8 text-center">
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                Back to Home
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* JSON-LD Schema */}
        <script 
          type="application/ld+json" 
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} 
        />
      </main>
      <Footer />
    </>
  )
}
