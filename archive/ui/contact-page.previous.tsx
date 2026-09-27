"use client"

import { useState, useEffect } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ContactForm from "@/components/ContactForm"
import { MapPin, Phone, Mail, Clock, User, Loader2, CheckCircle2, ArrowRight } from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"
import { toast } from "react-hot-toast"


export default function ContactPage() {
  const [isLoaded, setIsLoaded] = useState(false)

  // Contact form state for Sara Mobiles and Electronics
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const { data: settings, isLoading: loading } = useSettingsData()

  // Handle contact form submission
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!contactName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
      toast.error("Please fill in all fields")
      return
    }

    // Validate phone (10 digits)
    const cleanPhone = contactPhone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      toast.error("Please enter a valid email address")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          phone: cleanPhone,
          pincode: "000000",
          category: "Contact Inquiry",
          source: "Contact Page",
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Thank you! We will contact you soon.")
        setSubmitted(true)
        setContactName("")
        setContactEmail("")
        setContactPhone("")
      } else {
        toast.error(data.error || "Failed to submit. Please try again.")
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      toast.error("An error occurred. Please try again later.")
    } finally {
      setSubmitting(false)
    }
  }

  const contactInfo = [
    {
      icon: MapPin,
      title: "Visit Us",
      details: settings?.storeAddress ? [settings.storeAddress] : [],
    },
    {
      icon: Phone,
      title: "Call Us",
      details: settings?.storePhone ? [settings.storePhone] : [],
    },
    {
      icon: Mail,
      title: "Email Us",
      details: settings?.storeEmail ? [settings.storeEmail] : [],
    },
    {
      icon: Clock,
      title: "Business Hours",
      details: ["Mon - Fri: 10:00 AM - 6:00 PM"],
    },
  ]

  return (
    <div
      className={`flex flex-col min-h-screen transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"} bg-white`}
    >
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative min-h-[500px] md:min-h-[600px] flex items-center overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>

          {/* Geometric Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '40px 40px'
            }}></div>
          </div>

          {/* Animated Gradient Orbs */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

          {/* Content */}
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-white tracking-wide">We're Here to Help</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-tight">
                Get in{" "}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent animate-gradient">
                  Touch
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-xl md:text-2xl text-gray-300 font-light leading-relaxed mb-8 max-w-3xl mx-auto">
                Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="/complaints"
                  className="px-8 py-4 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary-hover transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-2"
                >
                  Send Message
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a
                  href="/faq"
                  className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
                >
                  FAQ
                </a>
                <a
                  href="#map"
                  className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
                >
                  Find Us
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-16 md:h-24" viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" />
            </svg>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className="py-12 md:py-16 -mt-16 relative z-20">
          <div className="container mx-auto px-4 md:px-6">
            {loading ? (
              <div className="text-center py-10">Loading contact information...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {contactInfo.map((info, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
                  >
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 flex items-center justify-center shadow-lg">
                      <info.icon className="h-7 w-7 md:h-8 md:w-8 text-white" />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold mb-3 text-gray-900 text-center">{info.title}</h3>
                    {info.details.length > 0 ? (
                      info.details.map((detail, idx) => (
                        <p key={idx} className="text-sm md:text-base text-gray-600 mb-1 text-center">
                          {detail}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm md:text-base text-gray-400 mb-1 text-center">Not available</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Contact Form Section */}
        {/* <section id="contact-form" className="py-16 md:py-24 bg-gradient-to-b from-white to-gray-50">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-block mb-4">
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Contact Form</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Send Us a Message</h2>
                <p className="text-lg md:text-xl text-gray-600">
                  Fill out the form below and we'll get back to you as soon as possible.
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
                <ContactForm />
              </div>
            </div>
          </div>
        </section> */}

        {/* Connect with Sara Mobiles and Electronics Section */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '40px 40px'
            }}></div>
          </div>
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-block mb-4">
                  <span className="px-5 py-2.5 bg-white/10 backdrop-blur-md text-white rounded-full text-sm font-semibold border border-white/20">
                    📞 Get In Touch
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Connect with{" "}
                  <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                    Sara Mobiles and Electronics
                  </span>
                </h2>
                <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
                  Leave your details and our team will reach out to assist you with all your mobile and electronics needs
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 md:p-10 border border-white/20 shadow-2xl">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <CheckCircle2 className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Thank You!</h3>
                    <p className="text-gray-300 mb-6">
                      We've received your inquiry and will contact you shortly.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all duration-300 font-medium"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-6">
                    {/* Name Field */}
                    <div>
                      <label htmlFor="contact-name" className="block text-sm font-semibold text-gray-200 mb-2">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          id="contact-name"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-300"
                          required
                        />
                      </div>
                    </div>

                    {/* Email Field */}
                    <div>
                      <label htmlFor="contact-email" className="block text-sm font-semibold text-gray-200 mb-2">
                        Email ID <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="email"
                          id="contact-email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="Enter your email address"
                          className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-300"
                          required
                        />
                      </div>
                    </div>

                    {/* Phone Field */}
                    <div>
                      <label htmlFor="contact-phone" className="block text-sm font-semibold text-gray-200 mb-2">
                        Phone Number <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="tel"
                          id="contact-phone"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="Enter your 10-digit phone number"
                          className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-300"
                          required
                          pattern="[0-9]{10}"
                          maxLength={10}
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-400">We'll never share your contact details with anyone else.</p>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 px-6 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary-hover transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Inquiry
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Contact Info Cards Below Form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                    <Phone className="h-6 w-6 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Call Us</p>
                    <p className="text-white font-semibold">{settings?.storePhone || "+91 9999999999"}</p>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                    <Mail className="h-6 w-6 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Email Us</p>
                    <p className="text-white font-semibold text-sm">{settings?.storeEmail || "info@saramobiles.com"}</p>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Business Hours</p>
                    <p className="text-white font-semibold text-sm">10:00 AM - 6:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Map Section */}
        <section id="map" className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <div className="inline-block mb-4">
                <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Location</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Find Us</h2>
              <p className="text-lg md:text-xl text-gray-600">
                Visit our office in the heart of Bengaluru, Karnataka.
              </p>
            </div>

            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
                <div className="h-96 md:h-[500px]">
                  <iframe
                    src="https://www.google.com/maps?q=%2323%2F1%2C%201st%20Floor%2C%20J.C.%201st%20Cross%2C%20JC%20Road%2C%20near%20Poornima%20Theatre%2C%20Bengaluru%2C%20Karnataka%20560027&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
                <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <MapPin className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Sara Mobiles &amp; Electronics</h3>
                      <p className="text-base md:text-lg text-gray-600 mb-4">
                        #23/1, 1st Floor, J.C. 1st Cross, JC Road, near Poornima Theatre, Bengaluru, Karnataka 560027
                      </p>
                      <a
                        href="https://maps.app.goo.gl/uQGTADTZHsFu1Uzw5"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary-hover transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                      >
                        Open in Google Maps
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
