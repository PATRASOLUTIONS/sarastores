"use client"

import { useState, useEffect, useRef } from "react"
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react"

// Default testimonials if none are found in localStorage
const defaultTestimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "Regular Customer",
    image: "https://placehold.co/200x200/222222/FFFFFF?text=Sarah+J",
    quote:
      "Sara Mobiles and Electronics  has become my go-to online store. The quality of products and customer service is exceptional. I highly recommend them to everyone!",
  },
  {
    id: 2,
    name: "Michael Chen",
    role: "Tech Enthusiast",
    image: "https://placehold.co/200x200/333333/FFFFFF?text=Michael+C",
    quote:
      "I've purchased several electronics from Sara Mobiles and Electronics  and have always been impressed with the fast shipping and product quality. Their prices are unbeatable!",
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    role: "Fashion Blogger",
    image: "https://placehold.co/200x200/444444/FFFFFF?text=Emily+R",
    quote:
      "As someone who shops a lot for fashion items, I can confidently say that Sara Mobiles and Electronics  offers the best selection at great prices. Their customer support is also top-notch.",
  },
]

export default function TestimonialSection() {
  const [isVisible, setIsVisible] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [testimonials, setTestimonials] = useState(defaultTestimonials)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load testimonials from localStorage if available
    try {
      const storedTestimonials = localStorage.getItem("testimonials")
      if (storedTestimonials) {
        setTestimonials(JSON.parse(storedTestimonials))
      }
    } catch (error) {
      console.error("Error loading testimonials:", error)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const nextTestimonial = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      nextTestimonial()
    }, 6000)

    return () => clearInterval(interval)
  }, [testimonials.length])

  return (
    <section ref={sectionRef} className="py-20 bg-gray-50 overflow-hidden">
      <div className="container mx-auto px-4">
        <div
          className={`text-center mb-12 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
        >
          <h2 className="text-3xl font-bold mb-4">What Our Customers Say</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Don't just take our word for it. Here's what our satisfied customers have to say about their shopping
            experience.
          </p>
        </div>

        {/* Desktop Testimonials */}
        <div className="hidden md:block">
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"
              } transition-all duration-700 delay-300`}
          >
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className="bg-white p-8 rounded-lg shadow-md relative transform transition-all duration-500 hover:-translate-y-2 hover:shadow-xl"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="absolute -top-5 -left-5 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <Quote className="h-5 w-5 text-white" />
                </div>
                <div className="flex items-center mb-6">
                  <img
                    src={testimonial.image || "/placeholder.svg"}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md mr-4"
                  />
                  <div>
                    <h3 className="font-semibold">{testimonial.name}</h3>
                    <p className="text-gray-600 text-sm">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-700 italic mb-6">"{testimonial.quote}"</p>
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Testimonial Carousel */}
        <div className="md:hidden relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="w-full flex-shrink-0 px-4">
                  <div className="bg-white p-6 rounded-lg shadow-md relative">
                    <div className="absolute -top-4 -left-4 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <Quote className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex items-center mb-4">
                      <img
                        src={testimonial.image || "/placeholder.svg"}
                        alt={testimonial.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md mr-3"
                      />
                      <div>
                        <h3 className="font-semibold">{testimonial.name}</h3>
                        <p className="text-gray-600 text-xs">{testimonial.role}</p>
                      </div>
                    </div>
                    <p className="text-gray-700 italic text-sm mb-4">"{testimonial.quote}"</p>
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-center mt-6 space-x-2">
            <button
              onClick={prevTestimonial}
              className="p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex space-x-1 items-center">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${activeIndex === index ? "w-6 bg-blue-800" : "bg-gray-300"
                    }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
            <button
              onClick={nextTestimonial}
              className="p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
