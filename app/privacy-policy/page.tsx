import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import {
  dpdpConfig,
  DATA_RECIPIENTS,
  RETENTION_SCHEDULE,
  PRIVACY_NOTICE_VERSION,
  DPDP_AGE_OF_MAJORITY,
  isDpdpConfigComplete,
} from "@/lib/dpdp-config"

export const metadata: Metadata = {
  title: "Privacy Notice",
  description:
    "How Sara Mobiles and Electronics collects, uses, shares and protects your personal data under India's Digital Personal Data Protection Act, 2023.",
}

// Read at request time so a change to the grievance officer or legal entity in
// the environment takes effect without a rebuild.
export const dynamic = "force-dynamic"

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="heading-3 mt-10 mb-3 text-brand-primary">{title}</h2>
      {children}
    </section>
  )
}

export default function PrivacyPolicy() {
  const officer = dpdpConfig.grievanceOfficer
  const dpo = dpdpConfig.dataProtectionOfficer
  const configured = isDpdpConfigComplete()

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <h1 className="heading-1 mb-2">Privacy Notice</h1>
        <p className="text-sm text-gray-500 mb-6">
          Version {PRIVACY_NOTICE_VERSION} · Issued under section 5 of the Digital Personal Data
          Protection Act, 2023
        </p>

        {!configured && (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Configuration incomplete.</strong> The legal entity and Grievance Officer details below
            are placeholders. Set the <code>DPDP_*</code> variables in <code>.env.local</code> before this
            notice is published.
          </div>
        )}

        <p className="mb-4 text-gray-700">
          This notice tells you what personal data <strong>{dpdpConfig.legalEntity}</strong> (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;) collects about you, exactly what we do with it, who else sees it, how long we
          keep it, and what you can require us to do about it. We are the <em>Data Fiduciary</em> for that
          data. You are the <em>Data Principal</em>.
        </p>
        <p className="mb-4 text-gray-700">
          It is written to satisfy section 5 of the Digital Personal Data Protection Act, 2023 (&ldquo;DPDP
          Act&rdquo;) and the Digital Personal Data Protection Rules made under it. Nothing here takes away
          a right the Act gives you.
        </p>

        <nav aria-label="Contents" className="my-6 rounded-md bg-gray-50 p-4 text-sm">
          <p className="mb-2 font-semibold">On this page</p>
          <ol className="list-decimal pl-5 space-y-1 text-brand-primary">
            <li><a className="underline" href="#what">What we collect, and why</a></li>
            <li><a className="underline" href="#basis">Our lawful basis</a></li>
            <li><a className="underline" href="#consent">Giving and withdrawing consent</a></li>
            <li><a className="underline" href="#sharing">Who else receives your data</a></li>
            <li><a className="underline" href="#retention">How long we keep it</a></li>
            <li><a className="underline" href="#rights">Your rights, and how to use them</a></li>
            <li><a className="underline" href="#grievance">Grievance redressal and the Data Protection Board</a></li>
            <li><a className="underline" href="#children">Children and persons with a guardian</a></li>
            <li><a className="underline" href="#security">Security and data breaches</a></li>
            <li><a className="underline" href="#transfers">Transfers outside India</a></li>
            <li><a className="underline" href="#cookies">Cookies and tracking</a></li>
            <li><a className="underline" href="#changes">Changes to this notice</a></li>
            <li><a className="underline" href="#contact">Who we are</a></li>
          </ol>
        </nav>

        <Section id="what" title="1. What we collect, and why">
          <p className="mb-3">
            We collect only what a specified purpose actually needs. Each row below is a purpose; we do not
            reuse data for a purpose that is not listed without asking you first.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border p-2">Data</th>
                  <th className="border p-2">Purpose</th>
                  <th className="border p-2">Needed?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">Name, email address and password</td>
                  <td className="border p-2">
                    Creating and securing your account
                  </td>
                  <td className="border p-2">Required to have an account</td>
                </tr>
                <tr>
                  <td className="border p-2">Phone number, delivery and billing address</td>
                  <td className="border p-2">Delivering your order, installation, invoicing and returns</td>
                  <td className="border p-2">Required to place an order</td>
                </tr>
                <tr>
                  <td className="border p-2">Order contents, amounts, payment status</td>
                  <td className="border p-2">Fulfilling the order, refunds, warranty and GST invoicing</td>
                  <td className="border p-2">Required to place an order</td>
                </tr>
                <tr>
                  <td className="border p-2">Cart, wishlist, comparison list, recently viewed items</td>
                  <td className="border p-2">Operating those features for you</td>
                  <td className="border p-2">Required for the feature</td>
                </tr>
                <tr>
                  <td className="border p-2">Reviews, complaints, enquiries, service requests</td>
                  <td className="border p-2">Answering you and handling the issue</td>
                  <td className="border p-2">Required to respond</td>
                </tr>
                <tr>
                  <td className="border p-2">IP address, device and browser details, security logs</td>
                  <td className="border p-2">Keeping accounts secure, preventing fraud and abuse</td>
                  <td className="border p-2">Required for security</td>
                </tr>
                <tr>
                  <td className="border p-2">Pages viewed, clicks, site performance measurements</td>
                  <td className="border p-2">Understanding and improving the site</td>
                  <td className="border p-2"><strong>Optional</strong> — only with your consent</td>
                </tr>
                <tr>
                  <td className="border p-2">Purchase history used to build a marketing profile</td>
                  <td className="border p-2">Recommending products and sending offers</td>
                  <td className="border p-2"><strong>Optional</strong> — only with your consent</td>
                </tr>
                <tr>
                  <td className="border p-2">Email address and phone number for promotional messages</td>
                  <td className="border p-2">Marketing by email, SMS and WhatsApp</td>
                  <td className="border p-2"><strong>Optional</strong> — only with your consent</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            <strong>Card details are never stored by us.</strong> They go straight to our payment gateway.
          </p>
          <p className="mt-2">
            We do not sell your personal data, and we do not buy personal data about you from data brokers.
          </p>
        </Section>

        <Section id="basis" title="2. Our lawful basis">
          <p className="mb-3">We process personal data on exactly two bases under the DPDP Act:</p>
          <ul className="list-disc pl-6 mb-3 space-y-2">
            <li>
              <strong>Your consent</strong> (section 6) — for everything marked optional above. You gave it
              by a clear affirmative action, and you can take it back at any time.
            </li>
            <li>
              <strong>Certain legitimate uses</strong> (section 7) — where you voluntarily gave us data for
              a purpose and have not objected, and where a law requires us to keep records, such as GST
              invoicing.
            </li>
          </ul>
          <p>
            We rely on consent for marketing, analytics, advertising and personalisation. We do not rely on
            consent to send you an order confirmation or a delivery update — those are part of the purchase
            you asked for, and you cannot be opted out of them while an order is live.
          </p>
        </Section>

        <Section id="consent" title="3. Giving and withdrawing consent">
          <p className="mb-3">
            Your consent is free, specific, informed, unconditional and unambiguous, given for the purposes
            listed above and nothing else. Where you have not consented, we do not process.
          </p>
          <p className="mb-3">
            <strong>Withdrawing consent is as easy as giving it.</strong> Go to{" "}
            <Link href="/account/privacy" className="text-brand-primary underline">
              Account → Privacy &amp; My Data
            </Link>
            , use the cookie preferences control, or click unsubscribe in any marketing email. There is no
            form to fill in and no need to contact us.
          </p>
          <p className="mb-3">
            Withdrawal takes effect immediately for the future. It does not make lawful processing we
            already carried out unlawful, and it does not remove records we are legally required to keep. If
            withdrawing consent makes a feature impossible to provide, we will tell you which one.
          </p>
          <p>
            We keep a dated record of every consent you give and every one you withdraw, because the Act
            puts the burden of proving consent on us. You can see that record in your data download.
          </p>
        </Section>

        <Section id="sharing" title="4. Who else receives your data">
          <p className="mb-3">
            We share the minimum needed, with the organisations below, under contract. None of them may use
            your data for their own marketing.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border p-2">Recipient</th>
                  <th className="border p-2">Why</th>
                  <th className="border p-2">What they receive</th>
                  <th className="border p-2">Where</th>
                </tr>
              </thead>
              <tbody>
                {DATA_RECIPIENTS.map((recipient) => (
                  <tr key={recipient.name}>
                    <td className="border p-2">{recipient.name}</td>
                    <td className="border p-2">{recipient.purpose}</td>
                    <td className="border p-2">{recipient.dataShared}</td>
                    <td className="border p-2">{recipient.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            We also disclose personal data where a court, regulator or law enforcement agency lawfully
            requires it, and to our professional advisers where necessary.
          </p>
          <p className="mt-2">
            If you place an order through one of our retail or channel partners, that partner receives the
            details needed to fulfil it and is a Data Fiduciary in its own right for what it then does.
          </p>
        </Section>

        <Section id="retention" title="5. How long we keep it">
          <p className="mb-3">
            We erase personal data once the purpose it was collected for is served and no law requires us to
            keep it. This is enforced automatically, not by hand.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border p-2">What</th>
                  <th className="border p-2">Kept for</th>
                  <th className="border p-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_SCHEDULE.map((rule) => (
                  <tr key={rule.collection}>
                    <td className="border p-2">{rule.label}</td>
                    <td className="border p-2">{rule.retention}</td>
                    <td className="border p-2">{rule.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            <strong>Invoices are the one thing we cannot delete on request.</strong> GST law requires us to
            keep invoice and payment records for 72 months. If you delete your account we keep the financial
            record but erase your name, email address, phone number and street address from inside it, so it
            no longer identifies you. This is the legal-compliance exception in section 12(3) of the Act.
          </p>
        </Section>

        <Section id="rights" title="6. Your rights, and how to use them">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border p-2">Right</th>
                  <th className="border p-2">What it means</th>
                  <th className="border p-2">How to use it</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">Access (s.11)</td>
                  <td className="border p-2">
                    A summary of the personal data we process about you, what we do with it, and the
                    identity of everyone we have shared it with
                  </td>
                  <td className="border p-2">
                    <Link href="/account/privacy" className="text-brand-primary underline">
                      Download my data
                    </Link>{" "}
                    — instant, no request needed
                  </td>
                </tr>
                <tr>
                  <td className="border p-2">Correction and completion (s.12(1))</td>
                  <td className="border p-2">
                    Fix anything inaccurate, complete anything incomplete, update anything stale
                  </td>
                  <td className="border p-2">
                    <Link href="/account/profile" className="text-brand-primary underline">
                      Account → Profile
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="border p-2">Erasure (s.12(3))</td>
                  <td className="border p-2">Delete your data, except where a law requires us to keep it</td>
                  <td className="border p-2">
                    <Link href="/account/privacy" className="text-brand-primary underline">
                      Delete my account
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="border p-2">Withdraw consent (s.6(4))</td>
                  <td className="border p-2">Stop any optional processing, at any time</td>
                  <td className="border p-2">
                    <Link href="/account/privacy" className="text-brand-primary underline">
                      Account → Privacy
                    </Link>
                    , cookie preferences, or any unsubscribe link
                  </td>
                </tr>
                <tr>
                  <td className="border p-2">Grievance redressal (s.13)</td>
                  <td className="border p-2">Have a complaint answered by a named, accountable person</td>
                  <td className="border p-2">
                    <Link href="/complaints?category=data-privacy" className="text-brand-primary underline">
                      Raise a data privacy grievance
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="border p-2">Nominate (s.14)</td>
                  <td className="border p-2">
                    Name someone to exercise these rights for you if you die or become incapacitated
                  </td>
                  <td className="border p-2">
                    Write to the Grievance Officer with the nominee&apos;s name and contact details
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            Exercising a right is free. We may ask you to verify your identity first — we will not hand
            someone else&apos;s data to a person who cannot prove they are that person.
          </p>
          <p className="mt-2">
            Section 15 of the Act also places duties on you: give accurate information, do not impersonate
            anyone, and do not file a false or frivolous grievance.
          </p>
        </Section>

        <Section id="grievance" title="7. Grievance redressal and the Data Protection Board">
          <p className="mb-3">
            If you are unhappy with anything we do with your personal data, contact our Grievance Officer
            first. We will acknowledge you and respond within{" "}
            <strong>{dpdpConfig.grievanceSlaDays} days</strong>.
          </p>
          <div className="rounded-md bg-gray-50 p-4 mb-3 text-sm">
            <p className="font-semibold">{officer.designation}</p>
            <p>{officer.name}</p>
            <p>
              Email:{" "}
              <a href={`mailto:${officer.email}`} className="text-brand-primary underline">
                {officer.email}
              </a>
            </p>
            {officer.phone && (
              <p>
                Phone:{" "}
                <a href={`tel:${officer.phone.replace(/\s+/g, "")}`} className="text-brand-primary underline">
                  {officer.phone}
                </a>
              </p>
            )}
            <p>Address: {officer.address || dpdpConfig.registeredAddress}</p>
          </div>
          {dpo.email && (
            <p className="mb-3 text-sm">
              Data Protection Officer: {dpo.name} —{" "}
              <a href={`mailto:${dpo.email}`} className="text-brand-primary underline">
                {dpo.email}
              </a>
            </p>
          )}
          <p>
            <strong>If our answer does not satisfy you</strong>, you have a statutory right to complain to
            the <strong>Data Protection Board of India</strong>, established under Chapter V of the DPDP
            Act. You should normally use our grievance process first. The Board is approached through the
            digital channel notified by the Government of India; details are published by the Ministry of
            Electronics and Information Technology at{" "}
            <a
              href="https://www.meity.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary underline"
            >
              meity.gov.in
            </a>
            . We will not restrict or penalise you for complaining.
          </p>
        </Section>

        <Section id="children" title="8. Children and persons with a guardian">
          <p className="mb-3">
            Under the DPDP Act a <strong>child</strong> is anyone under {DPDP_AGE_OF_MAJORITY}. The Act
            requires verifiable parental consent before a child&apos;s personal data is processed, and
            prohibits tracking a child, monitoring their behaviour, or directing advertising at them — even
            with consent.
          </p>
          <p className="mb-3">
            <strong>
              We therefore do not allow anyone under {DPDP_AGE_OF_MAJORITY} to create an account or buy from
              this site.
            </strong>{" "}
            By creating an account or placing an order, you confirm that you meet this age requirement. We do
            not ask for your date of birth during sign-up and do not knowingly collect a child&apos;s personal data.
          </p>
          <p>
            If you believe a child has given us personal data, tell the Grievance Officer and we will delete
            it and close the account. If you are the lawful guardian of a Data Principal with a disability,
            contact the Grievance Officer to exercise their rights on their behalf.
          </p>
        </Section>

        <Section id="security" title="9. Security and data breaches">
          <p className="mb-3">
            Section 8(5) requires reasonable security safeguards. We use TLS in transit, access controls
            restricting data to staff who need it, hashed passwords, signed session tokens, rate limiting
            and bot protection on authentication, server-side recalculation of all prices and payments, and
            a content security policy on the site.
          </p>
          <p>
            No system is perfectly secure. If a personal data breach occurs we will notify you and the Data
            Protection Board of India without delay, in the form and manner the Rules require, including
            what happened, the likely consequences, and what we are doing about it.
          </p>
        </Section>

        <Section id="transfers" title="10. Transfers outside India">
          <p>
            Your personal data is primarily stored and processed in India. Some service providers listed in
            section 4 operate outside India, including our website host and parts of Google&apos;s services.
            Section 16 of the Act permits such transfers except to a country the Central Government
            restricts by notification; we comply with any such restriction and apply contractual safeguards
            to every transfer.
          </p>
        </Section>

        <Section id="cookies" title="11. Cookies and tracking">
          <p className="mb-3">
            <strong>Strictly necessary</strong> cookies keep you signed in, hold your cart and protect
            against fraud. The site cannot work without them, so they are not consent-based and cannot be
            turned off.
          </p>
          <p className="mb-3">
            <strong>Analytics, advertising and personalisation</strong> cookies and tags do not run until
            you allow them. You choose when the banner first appears, and you can change your mind at any
            time from{" "}
            <Link href="/account/privacy" className="text-brand-primary underline">
              Account → Privacy &amp; My Data
            </Link>
            . Rejecting them is a single click and is exactly as prominent as accepting.
          </p>
          <p>
            Our site also links to external websites. We are not responsible for their privacy practices —
            read their notices before giving them anything.
          </p>
        </Section>

        <Section id="changes" title="12. Changes to this notice">
          <p>
            We will update this notice when what we do changes, and the version number at the top changes
            with it. If a change materially affects processing we rely on your consent for, we will ask you
            again rather than assume the old answer still applies — a previously given consent is
            automatically treated as expired when the notice version changes.
          </p>
        </Section>

        <Section id="contact" title="13. Who we are">
          <p className="mb-2">
            <strong>Data Fiduciary:</strong> {dpdpConfig.legalEntity}
          </p>
          <p className="mb-2">
            <strong>Registered address:</strong> {dpdpConfig.registeredAddress}
          </p>
          {dpdpConfig.cin && (
            <p className="mb-2">
              <strong>CIN:</strong> {dpdpConfig.cin}
            </p>
          )}
          {dpdpConfig.gstin && (
            <p className="mb-2">
              <strong>GSTIN:</strong> {dpdpConfig.gstin}
            </p>
          )}
          <p className="mb-2">
            This notice is available in English and, on request to the Grievance Officer, in any language
            listed in the Eighth Schedule to the Constitution of India, as required by section 5(3).
          </p>
        </Section>

        <p className="mt-10 text-sm text-gray-500 text-center">
          © {new Date().getFullYear()} {dpdpConfig.legalEntity}. All rights reserved.
        </p>
      </main>
      <Footer />
    </div>
  )
}
