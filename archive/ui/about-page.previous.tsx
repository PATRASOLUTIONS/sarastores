"use client"

import { useState, useEffect } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CompanyStory from "@/components/about/CompanyStory"
import { Users, Award, Globe, TrendingUp } from "lucide-react"

export default function AboutPage() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const stats = [
    { icon: Users, label: "Partner Network", value: "5000+" },
    { icon: Award, label: "Cities in India", value: "90+" },
    { icon: Globe, label: "Units Sold", value: "2M+" },
    { icon: TrendingUp, label: "YOY Growth", value: "17%" },
  ]

  const team = [
    {
      name: "Abhishek Jain",
      role: "Chairman & Managing Director",
      image: "https://static.wixstatic.com/media/6201ac_f3e8b6daec044483b6c565a4e2ebd11a~mv2.jpg/v1/fill/w_782,h_840,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/WhatsApp%20Image%202024-06-08%20at%2016_58_edited.jpg", // replace with your actual image path
      description:
        "Graduate with over 25 years of expertise in channel partner setup, branch operations, marketing, and general management.",
    },
    {
      name: "Amit Kothari",
      role: "Executive Director & CFO",
      image: "https://static.wixstatic.com/media/6201ac_1087c3eb28964af48b87bfed83dffdbe~mv2.jpeg/v1/fill/w_759,h_815,al_c,q_85,enc_avif,quality_auto/WhatsApp%20Image%202025-02-10%20at%2018_27_50.jpeg", // replace with your actual image path
      description:
        "Graduate with 20+ years of experience in sales, accounts, finance, and banking, driving financial excellence and strategy.",
    },
    {
      name: "Archit Jain",
      role: "Executive Director",
      image: "https://static.wixstatic.com/media/6201ac_ba5d4cd73e0e45b2ad58fa7b3ed9197f~mv2.jpeg/v1/fill/w_768,h_825,al_c,q_85,enc_avif,quality_auto/WhatsApp%20Image%202025-02-10%20at%2018_27_50-2.jpegs", // replace with your actual image path
      description:
        "Graduate with 13 years of experience in the field of IT hardware, sales, and marketing, contributing to business growth and client success.",
    },
  ]

  const values = [
    {
      title: "Customer-Centricity",
      description:
        "We are dedicated to understanding and exceeding our customers’ needs through personalized solutions, exceptional service, and transparent communication.",
    },
    {
      title: "Integrity & Ethics",
      description:
        "We uphold the highest standards of honesty, fairness, and compliance, ensuring responsible operations and long-term trust with all stakeholders.",
    },
    {
      title: "Innovation & Agility",
      description:
        "In a rapidly evolving tech landscape, we embrace innovation, continuously exploring new ideas and technologies to deliver cutting-edge solutions.",
    },
    {
      title: "Collaboration & Teamwork",
      description:
        "Our strength lies in unity. We cultivate a culture of collaboration, respect, and mutual growth, where every voice contributes to shared success.",
    },
  ]

  return (
    <div
      className={`flex flex-col min-h-screen transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"
        } bg-white`}
    >
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative min-h-[600px] md:min-h-[700px] flex items-center overflow-hidden">
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
            <div className="max-w-5xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-white tracking-wide">Established Since 2010</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-tight">
                About{" "}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent animate-gradient">
                  Sara Mobiles &amp; Electronics
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 font-light leading-relaxed mb-10 max-w-4xl mx-auto">
                Empowering Success Through{" "}
                <span className="text-blue-400 font-semibold">Innovation</span>,{" "}
                <span className="text-cyan-400 font-semibold">Excellence</span>, and{" "}
                <span className="text-indigo-400 font-semibold">Trust</span>
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-10">
                <div className="group px-6 py-3 bg-gradient-to-r from-blue-600/20 to-blue-500/20 backdrop-blur-md rounded-xl border border-blue-400/30 hover:border-blue-400/60 transition-all duration-300 hover:scale-105 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500/30 rounded-lg flex items-center justify-center">
                      <span className="text-blue-300 text-lg">🏆</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-blue-300 font-medium">Experience</p>
                      <p className="text-sm text-white font-bold">50+ Years Combined</p>
                    </div>
                  </div>
                </div>

                <div className="group px-6 py-3 bg-gradient-to-r from-cyan-600/20 to-cyan-500/20 backdrop-blur-md rounded-xl border border-cyan-400/30 hover:border-cyan-400/60 transition-all duration-300 hover:scale-105 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-cyan-500/30 rounded-lg flex items-center justify-center">
                      <span className="text-cyan-300 text-lg">🌟</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-cyan-300 font-medium">Trusted By</p>
                      <p className="text-sm text-white font-bold">2M+ Happy Customers</p>
                    </div>
                  </div>
                </div>

                <div className="group px-6 py-3 bg-gradient-to-r from-indigo-600/20 to-indigo-500/20 backdrop-blur-md rounded-xl border border-indigo-400/30 hover:border-indigo-400/60 transition-all duration-300 hover:scale-105 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500/30 rounded-lg flex items-center justify-center">
                      <span className="text-indigo-300 text-lg">🚀</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-indigo-300 font-medium">Serving</p>
                      <p className="text-sm text-white font-bold">90+ Cities in India</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="#company-overview"
                  className="px-8 py-4 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary-hover transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-2"
                >
                  Learn More
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a
                  href="#leadership"
                  className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
                >
                  Meet Our Team
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

        {/* Stats Section */}
        <section className="py-12 md:py-16 -mt-16 relative z-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 flex items-center justify-center shadow-lg">
                    <stat.icon className="h-7 w-7 md:h-8 md:w-8 text-white" />
                  </div>
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 text-gray-900">{stat.value}</h3>
                  <p className="text-sm md:text-base text-gray-600 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Company Overview */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-white to-gray-50">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-block mb-4">
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Who We Are</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">Your Trusted Electronics Partner</h2>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-100">
                <p className="text-base md:text-lg text-gray-700 leading-relaxed mb-6">
                  Established in 2010, <strong className="text-brand-primary">Sara Mobiles &amp; Electronics</strong> brings over 50 years of combined leadership experience to the forefront. We are a trusted electronics retailer serving customers across India with the latest mobiles, laptops, and consumer technology.
                </p>
                <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                  Our core expertise lies in sourcing, sales, and after-sales support across a wide range of products — from top-tier smartphones and laptops to home appliances and accessories — all backed by genuine warranties and dependable service.
                </p>
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-500 mb-3">Authorized partner for leading brands</p>
                  <div className="flex flex-wrap gap-3">
                    {['Samsung', 'Apple', 'Xiaomi', 'OnePlus', 'realme', 'Lenovo', 'HP', 'boAt'].map((client, idx) => (
                      <span key={idx} className="px-4 py-2 bg-brand-primary-subtle text-brand-primary rounded-lg text-sm font-medium">
                        {client}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our History */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center max-w-6xl mx-auto">
              <div className="order-2 md:order-1">
                <div className="mb-6">
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Our Story</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                  The <span className="text-blue-600">Journey</span> That Defined Us
                </h2>
                <div className="space-y-4">
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                    In <strong className="text-brand-primary">2010</strong>, <strong>Abhishek Jain</strong> and <strong>Amit Kothari</strong> embarked on their entrepreneurial journey by founding Sara Mobiles &amp; Electronics in Bengaluru, Karnataka.
                  </p>
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                    Leveraging their extensive backgrounds in distribution, retail management, and innovation, they quickly positioned Sara Electronics as a formidable force in the market.
                  </p>
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                    Today, their legacy thrives as Sara Electronics continues to redefine the retail experience with <strong className="text-brand-primary">excellence, reliability,</strong> and <strong className="text-brand-primary">forward-thinking leadership</strong>.
                  </p>
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent z-10"></div>
                  <img
                    src="/landscap.jpg"
                    alt="Sara Mobiles and Electronics  history"
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        {/* <section className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12 md:mb-16">
              <div className="inline-block mb-4">
                <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Leadership Team</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Meet Our Leadership</h2>
              <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
                The powerhouse team driving SYSTECH's success — leading innovation, operations, and client excellence.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
              {team.map((member, index) => (
                <div
                  key={index}
                  className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
                >
                  <div className="relative h-64 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{member.name}</h3>
                    <p className="text-blue-600 font-semibold mb-4 text-sm md:text-base">{member.role}</p>
                    <p className="text-gray-600 leading-relaxed text-sm md:text-base">{member.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* Core Values */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400 rounded-full blur-3xl opacity-20"></div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="text-center mb-12 md:mb-16">
              <div className="inline-block mb-4">
                <span className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-full text-sm font-semibold border border-white/20">Our Values</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">Core Values & Principles</h2>
              <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto">
                The foundation of Sara Electronics' culture and long-term success.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-7xl mx-auto">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 md:p-8 hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <span className="text-2xl md:text-3xl">✦</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-3 text-center">{value.title}</h3>
                  <p className="text-sm md:text-base text-blue-100 leading-relaxed text-center">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CompanyStory />
      </main>
      <Footer />
    </div>
  )
}
