"use client"

import BrandGuidelines, {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  getPrimaryButtonClasses,
  getSecondaryButtonClasses,
  getCardClasses,
  getInputClasses,
  getHeadingClasses,
  getBadgeClasses,
  GRADIENTS,
} from "@/lib/brandGuidelines"

export default function BrandGuidelinesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div
        className="text-white py-20"
        style={{ background: GRADIENTS.primary }}
      >
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4">Sara Mobiles and Electronics </h1>
          <p className="text-2xl text-blue-100">Smart, Secure, Seamless</p>
          <p className="mt-4 text-blue-50 max-w-2xl">
            Professional, innovative, reliable, tech-driven brand identity system
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Color Palette */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Color Palette</h2>

          {/* Primary Colors */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Primary Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={getCardClasses()}>
                <div
                  className="h-32 rounded-lg mb-4"
                  style={{ backgroundColor: COLORS.primary.blue }}
                ></div>
                <h4 className="font-semibold">Primary Blue</h4>
                <p className="text-gray-600 font-mono text-sm">{COLORS.primary.blue}</p>
              </div>
              <div className={getCardClasses()}>
                <div
                  className="h-32 rounded-lg mb-4"
                  style={{ backgroundColor: COLORS.primary.blueDark }}
                ></div>
                <h4 className="font-semibold">Blue Dark</h4>
                <p className="text-gray-600 font-mono text-sm">{COLORS.primary.blueDark}</p>
              </div>
              <div className={getCardClasses()}>
                <div
                  className="h-32 rounded-lg mb-4"
                  style={{ backgroundColor: COLORS.primary.blueLight }}
                ></div>
                <h4 className="font-semibold">Blue Light</h4>
                <p className="text-gray-600 font-mono text-sm">{COLORS.primary.blueLight}</p>
              </div>
            </div>
          </div>

          {/* Accent Colors */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Accent Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={getCardClasses()}>
                <div
                  className="h-32 rounded-lg mb-4"
                  style={{ backgroundColor: COLORS.accent.yellow }}
                ></div>
                <h4 className="font-semibold">Accent Yellow</h4>
                <p className="text-gray-600 font-mono text-sm">{COLORS.accent.yellow}</p>
              </div>
              <div className={getCardClasses()}>
                <div
                  className="h-32 rounded-lg mb-4"
                  style={{ backgroundColor: COLORS.accent.green }}
                ></div>
                <h4 className="font-semibold">Accent Green</h4>
                <p className="text-gray-600 font-mono text-sm">{COLORS.accent.green}</p>
              </div>
            </div>
          </div>

          {/* Neutral Colors */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Neutral Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Object.entries(COLORS.neutral).map(([name, color]) => (
                <div key={name} className={getCardClasses()}>
                  <div
                    className="h-24 rounded-lg mb-4 border"
                    style={{ backgroundColor: color }}
                  ></div>
                  <h4 className="font-semibold capitalize">{name}</h4>
                  <p className="text-gray-600 font-mono text-sm">{color}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Typography</h2>
          <div className={getCardClasses()}>
            <div className="space-y-6">
              <div>
                <h1 className={getHeadingClasses(1)}>H1 Hero - 48px Poppins Bold</h1>
                <p className="text-gray-500 text-sm mt-2">Used for main hero sections</p>
              </div>
              <div>
                <h2 className={getHeadingClasses(2)}>H2 Section - 32px Poppins SemiBold</h2>
                <p className="text-gray-500 text-sm mt-2">Used for section headings</p>
              </div>
              <div>
                <h3 className={getHeadingClasses(3)}>H3 Subsection - 24px Poppins SemiBold</h3>
                <p className="text-gray-500 text-sm mt-2">Used for subsections</p>
              </div>
              <div>
                <h4 className={getHeadingClasses(4)}>H4 Card Title - 20px Poppins Medium</h4>
                <p className="text-gray-500 text-sm mt-2">Used for card titles</p>
              </div>
              <div>
                <p className="text-base">Body Text - 16px Roboto Regular</p>
                <p className="text-gray-500 text-sm mt-2">Used for body content and descriptions</p>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Buttons</h2>
          <div className={getCardClasses()}>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Primary Button</h3>
                <button className={getPrimaryButtonClasses()}>
                  Get Started
                </button>
                <p className="text-gray-500 text-sm mt-2">
                  Used for primary actions and CTAs
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Secondary Button</h3>
                <button className={getSecondaryButtonClasses()}>
                  Learn More
                </button>
                <p className="text-gray-500 text-sm mt-2">
                  Used for secondary actions
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Button Sizes</h3>
                <div className="flex flex-wrap gap-4">
                  <button className={getPrimaryButtonClasses() + " text-sm py-1 px-4"}>
                    Small
                  </button>
                  <button className={getPrimaryButtonClasses()}>
                    Medium
                  </button>
                  <button className={getPrimaryButtonClasses() + " text-lg py-3 px-8"}>
                    Large
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Badges</h2>
          <div className={getCardClasses()}>
            <div className="flex flex-wrap gap-4">
              <span className={getBadgeClasses("sale")}>Sale</span>
              <span className={getBadgeClasses("success")}>Success</span>
              <span className={getBadgeClasses("info")}>Info</span>
              <span className={getBadgeClasses("warning")}>Warning</span>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              Used for status indicators, labels, and promotional tags
            </p>
          </div>
        </section>

        {/* Cards */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={getCardClasses()}>
              <h3 className="text-xl font-semibold mb-2">Product Card</h3>
              <p className="text-gray-600 mb-4">
                White background with subtle shadow and 8px border radius
              </p>
              <button className={getPrimaryButtonClasses()}>
                View Details
              </button>
            </div>
            <div className={getCardClasses()}>
              <h3 className="text-xl font-semibold mb-2">Feature Card</h3>
              <p className="text-gray-600 mb-4">
                Consistent padding and spacing using 8px scale
              </p>
              <button className={getSecondaryButtonClasses()}>
                Learn More
              </button>
            </div>
            <div className={getCardClasses()}>
              <h3 className="text-xl font-semibold mb-2">Info Card</h3>
              <p className="text-gray-600 mb-4">
                Hover effects for better interactivity
              </p>
              <span className={getBadgeClasses("info")}>New</span>
            </div>
          </div>
        </section>

        {/* Form Elements */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Form Elements</h2>
          <div className={getCardClasses()}>
            <div className="space-y-6 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Input
                </label>
                <input
                  type="text"
                  placeholder="Enter text..."
                  className={getInputClasses()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Input
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  className={getInputClasses()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Dropdown
                </label>
                <select className={getInputClasses()}>
                  <option>Option 1</option>
                  <option>Option 2</option>
                  <option>Option 3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Textarea
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter description..."
                  className={getInputClasses()}
                ></textarea>
              </div>
            </div>
          </div>
        </section>

        {/* Spacing System */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Spacing System (8px base)</h2>
          <div className={getCardClasses()}>
            <div className="space-y-4">
              {Object.entries(SPACING).map(([name, value]) => (
                <div key={name} className="flex items-center gap-4">
                  <div
                    className="bg-blue-600"
                    style={{ width: value, height: "32px" }}
                  ></div>
                  <span className="font-mono text-sm">
                    {name.toUpperCase()}: {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Gradients */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Gradients</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={getCardClasses()}>
              <div
                className="h-32 rounded-lg mb-4 flex items-center justify-center text-white font-semibold"
                style={{ background: GRADIENTS.primary }}
              >
                Primary Gradient
              </div>
              <p className="text-gray-600 text-sm">Used for buttons and CTAs</p>
            </div>
            <div className={getCardClasses()}>
              <div
                className="h-32 rounded-lg mb-4 flex items-center justify-center text-white font-semibold"
                style={{ background: GRADIENTS.hero }}
              >
                Hero Gradient
              </div>
              <p className="text-gray-600 text-sm">Used for hero sections</p>
            </div>
          </div>
        </section>

        {/* Usage Examples */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Usage Examples</h2>
          <div className={getCardClasses()}>
            <h3 className="text-xl font-semibold mb-4">Importing Brand Guidelines</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
              {`import BrandGuidelines, {
  COLORS,
  getPrimaryButtonClasses,
  getCardClasses,
} from '@/lib/brandGuidelines'

// Use helper functions
<button className={getPrimaryButtonClasses()}>
  Get Started
</button>

// Or use constants directly
<div style={{ color: COLORS.primary.blue }}>
  Sara Mobiles and Electronics 
</div>`}
            </pre>
          </div>
        </section>

        {/* Brand Voice */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Brand Voice & Messaging</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={getCardClasses()}>
              <h3 className="text-xl font-semibold mb-4">✅ Recommended CTAs</h3>
              <div className="space-y-2">
                <button className={getPrimaryButtonClasses() + " w-full"}>Discover</button>
                <button className={getPrimaryButtonClasses() + " w-full"}>Transform</button>
                <button className={getPrimaryButtonClasses() + " w-full"}>Get Started</button>
                <button className={getPrimaryButtonClasses() + " w-full"}>Secure Your Business</button>
              </div>
            </div>
            <div className={getCardClasses()}>
              <h3 className="text-xl font-semibold mb-4">Brand Characteristics</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✓ <strong>Confident:</strong> We know our technology</li>
                <li>✓ <strong>Clear:</strong> No jargon, straightforward</li>
                <li>✓ <strong>Modern:</strong> Forward-thinking</li>
                <li>✓ <strong>Approachable:</strong> Friendly and helpful</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Do's and Don'ts */}
        <section className="mb-16">
          <h2 className={getHeadingClasses(2) + " mb-8"}>Do's & Don'ts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={getCardClasses() + " border-l-4 border-green-500"}>
              <h3 className="text-xl font-semibold mb-4 text-green-700">✅ Do's</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✓ Use approved fonts and colors</li>
                <li>✓ Keep logo consistent</li>
                <li>✓ Ensure accessibility standards</li>
                <li>✓ Use 8px spacing scale</li>
                <li>✓ Test on multiple devices</li>
                <li>✓ Maintain proper hierarchy</li>
              </ul>
            </div>
            <div className={getCardClasses() + " border-l-4 border-red-500"}>
              <h3 className="text-xl font-semibold mb-4 text-red-700">❌ Don'ts</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✗ Don't distort the logo</li>
                <li>✗ Don't use mismatched fonts</li>
                <li>✗ Don't create cluttered designs</li>
                <li>✗ Don't use unapproved colors</li>
                <li>✗ Don't ignore mobile responsiveness</li>
                <li>✗ Don't use poor quality images</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
