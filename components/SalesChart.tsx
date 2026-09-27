"use client"

import { useState, useEffect, useRef } from "react"
import { products } from "@/lib/mock-data"

// Mock sales data for the chart
const mockSalesData = products.map((product) => ({
  id: product.id,
  name: product.name,
  sales: Math.floor(Math.random() * 500) + 100, // Random sales between 100-600
  color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
}))

export default function SalesChart() {
  const [isClient, setIsClient] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    if (isMounted.current) {
      setIsClient(true)
    }

    return () => {
      isMounted.current = false
    }
  }, [])

  // Sort products by sales for better visualization
  const sortedData = [...mockSalesData].sort((a, b) => b.sales - a.sales)
  const maxSales = Math.max(...sortedData.map((item) => item.sales))

  if (!isClient) {
    return <div className="h-64 bg-gray-100 rounded flex items-center justify-center">Loading chart...</div>
  }

  return (
    <div className="h-64 w-full">
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-end">
          {sortedData.map((item) => (
            <div key={item.id} className="flex flex-col items-center flex-1 h-full justify-end px-1">
              <div
                className="w-full rounded-t transition-all duration-1000 ease-out"
                style={{
                  height: `${(item.sales / maxSales) * 100}%`,
                  backgroundColor: item.color,
                  maxWidth: "40px",
                  margin: "0 auto",
                }}
              ></div>
              <div className="text-xs font-medium mt-2 text-center truncate w-full" title={item.name}>
                {item.name.split(" ")[0]}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center text-sm text-gray-500">Product Sales</div>
      </div>
    </div>
  )
}
