import { DollarSign, Truck, FileText, LayoutGrid, RefreshCw } from "lucide-react"

export default function FeatureCards() {
  const features = [
    {
      icon: <DollarSign className="h-10 w-10 text-blue-800" />,
      title: "Best prices & offers",
      description: "Orders at best prices with exciting offers",
    },
    {
      icon: <Truck className="h-10 w-10 text-blue-800" />,
      title: "Free delivery",
      description: "24/7 amazing services",
    },
    {
      icon: <FileText className="h-10 w-10 text-blue-800" />,
      title: "Great daily deal",
      description: "When you sign up",
    },
    {
      icon: <LayoutGrid className="h-10 w-10 text-blue-800" />,
      title: "Wide assortment",
      description: "Mega Discounts",
    },
    {
      icon: <RefreshCw className="h-10 w-10 text-blue-800" />,
      title: "Easy returns",
      description: "Within 14 days",
    },
  ]

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 flex items-start space-x-4"
            >
              <div className="flex-shrink-0">{feature.icon}</div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
