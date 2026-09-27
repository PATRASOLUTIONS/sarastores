import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck, Ticket, HelpCircle, Gift, CheckCircle2 } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function SpinTermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-amber-500/30">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-12 md:py-20 mt-16">
        <Link href="/spin" className="inline-flex items-center text-amber-500 hover:text-amber-400 mb-8 transition-colors group">
          <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Spin Wheel
        </Link>
        
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Campaign Terms & Conditions
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Everything you need to know about participating, claiming prizes, and getting support for the Sara Mobiles Spin the Wheel campaign.
          </p>
        </div>

        <div className="grid gap-8">
          {/* How to Use */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><HelpCircle className="w-6 h-6" /></div>
              How to Use
            </h2>
            <ul className="space-y-4 text-slate-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 mt-0.5">1</span>
                <div><strong>Enter Details:</strong> Provide your valid Name, 10-digit Phone Number, and Email Address.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 mt-0.5">2</span>
                <div><strong>Verify Identity:</strong> You will receive a secure 6-digit OTP via Email and WhatsApp. Enter this code to verify.</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 mt-0.5">3</span>
                <div><strong>Spin the Wheel:</strong> Once verified, agree to the final spin terms and click "SPIN NOW".</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 mt-0.5">4</span>
                <div><strong>Get Your Result:</strong> The wheel will land on a prize. A Secret Coupon Code will be generated instantly and sent to your email and WhatsApp.</div>
              </li>
            </ul>
          </section>

          {/* How to Claim */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Gift className="w-6 h-6" /></div>
              How to Claim Your Prize
            </h2>
            <div className="grid md:grid-cols-2 gap-6 text-slate-300 border border-slate-700 rounded-xl p-6 bg-slate-900/50">
              <div>
                <h3 className="font-bold text-white mb-2 text-lg">In-Store Claiming</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Visit the specific offline store.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Proceed to the billing/checkout counter.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Show the Secret Coupon Code on your phone.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Present a valid Government ID matching your registered name.</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h4 className="font-bold text-emerald-400 mb-1">Important Note</h4>
                <p className="text-sm">Prizes must be claimed within 7 days of spinning. Screenshots without the original WhatsApp message or Email may be subject to additional verification.</p>
              </div>
            </div>
          </section>

          {/* Terms & Conditions */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400"><Ticket className="w-6 h-6" /></div>
              Official Terms and Conditions
            </h2>
            <ul className="space-y-4 text-slate-300 text-sm leading-relaxed list-disc list-inside">
              <li><strong>Eligibility:</strong> This campaign is open to residents aged 18 and above. Employees of Sara Mobiles and Electronics and their immediate relatives are not eligible.</li>
              <li><strong>One Spin Per User:</strong> Strictly one spin is permitted per verified phone number and email address. Multiple entries using different credentials belonging to the same individual will result in disqualification.</li>
              <li><strong>Prize Availability:</strong> All prizes are subject to stock availability dynamically calculated by our system. In the event a prize is out of stock, it will be automatically disabled from the wheel.</li>
              <li><strong>Non-Transferable:</strong> Prizes or coupon codes are non-transferable and cannot be exchanged for cash, store credit, or different products.</li>
              <li><strong>Management Rights:</strong> Sara Mobiles and Electronics reserves the absolute right to withdraw, alter, or cancel the campaign or its terms at any time without prior notice.</li>
              <li><strong>Fair Play:</strong> Any automated spinning, script abuse, or fraudulent OTP usage will lead to immediate IP ban and criminal prosecution if deemed malicious.</li>
              <li><strong>Campaign Duration:</strong> Valid for a limited time period only, as determined by the store management.</li>
            </ul>
          </section>

          {/* Support */}
          <section className="bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700 rounded-3xl p-8 text-center backdrop-blur-sm mt-4">
            <h2 className="text-2xl font-bold mb-3 text-white">Need Support?</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Having trouble receiving your OTP? Did your spin register incorrectly? Our team is here to help you out.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="mailto:support@saramobiles.com" className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors w-full sm:w-auto">
                Email Support
              </a>
              <a href="tel:+917892051553" className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-amber-500/20 w-full sm:w-auto text-center">
                Call Us: +91 78920 51553
              </a>
            </div>
          </section>

        </div>
      </main>
      
      <Footer />
    </div>
  )
}
