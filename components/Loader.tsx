"use client"

import { useEffect, useState } from "react"

interface LoaderProps {
  size?: "sm" | "md" | "lg" | "xl"
  fullScreen?: boolean
  text?: string
  variant?: "spinner" | "dots" | "pulse" | "brand"
}

export default function Loader({ 
  size = "md", 
  fullScreen = false, 
  text = "Loading...",
  variant = "brand"
}: LoaderProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  }

  const containerClass = fullScreen
    ? "fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
    : "flex flex-col items-center justify-center py-12"

  // Brand Spinner Loader
  const BrandSpinner = () => (
    <div className="relative">
      {/* Outer ring */}
      <div
        className={`${sizeClasses[size]} rounded-full border-4 border-gray-200 border-t-transparent animate-spin`}
        style={{ borderTopColor: '#2A7FFF' }}
      ></div>
      {/* Inner ring */}
      <div
        className={`absolute inset-2 rounded-full border-4 border-gray-100 border-b-transparent animate-spin`}
        style={{ 
          borderBottomColor: '#FFC107',
          animationDirection: 'reverse',
          animationDuration: '0.8s'
        }}
      ></div>
      {/* Center dot */}
      <div
        className="absolute inset-0 flex items-center justify-center"
      >
        <div 
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: '#00C48C' }}
        ></div>
      </div>
    </div>
  )

  // Simple Spinner
  const SimpleSpinner = () => (
    <div
      className={`${sizeClasses[size]} rounded-full border-4 border-gray-200 animate-spin`}
      style={{ borderTopColor: '#2A7FFF' }}
    ></div>
  )

  // Dots Loader
  const DotsLoader = () => (
    <div className="flex space-x-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full animate-bounce"
          style={{
            backgroundColor: '#2A7FFF',
            animationDelay: `${i * 0.15}s`,
          }}
        ></div>
      ))}
    </div>
  )

  // Pulse Loader
  const PulseLoader = () => (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-full animate-ping absolute`}
        style={{ backgroundColor: '#2A7FFF', opacity: 0.3 }}
      ></div>
      <div
        className={`${sizeClasses[size]} rounded-full relative`}
        style={{ backgroundColor: '#2A7FFF' }}
      ></div>
    </div>
  )

  const renderLoader = () => {
    switch (variant) {
      case "spinner":
        return <SimpleSpinner />
      case "dots":
        return <DotsLoader />
      case "pulse":
        return <PulseLoader />
      case "brand":
      default:
        return <BrandSpinner />
    }
  }

  return (
    <div className={containerClass}>
      {renderLoader()}
      {text && (
        <p 
          className="mt-4 text-gray-600 font-medium animate-pulse"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          {text}{dots}
        </p>
      )}
    </div>
  )
}

// Skeleton Loader for Cards
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
      <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
    </div>
  )
}

// Skeleton Loader for List Items
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-md p-4 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Skeleton Loader for Table
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="animate-pulse">
        {/* Table Header */}
        <div className="bg-gray-100 p-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded"></div>
          ))}
        </div>
        {/* Table Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={rowIndex} 
            className="p-4 border-t border-gray-100 grid gap-4"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div key={colIndex} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Page Loader with Brand Logo
export function PageLoader({ text = "Loading your experience..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      {/* Animated Logo */}
      <div className="mb-8 animate-bounce">
        <div className="text-4xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
          <span style={{ color: '#2A7FFF' }}>Systech</span>
          <span className="text-gray-900">Digital</span>
        </div>
      </div>
      
      {/* Brand Spinner */}
      <div className="relative">
        <div
          className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-transparent animate-spin"
          style={{ borderTopColor: '#2A7FFF' }}
        ></div>
        <div
          className="absolute inset-2 rounded-full border-4 border-gray-100 border-b-transparent animate-spin"
          style={{ 
            borderBottomColor: '#FFC107',
            animationDirection: 'reverse',
            animationDuration: '0.8s'
          }}
        ></div>
      </div>
      
      {/* Loading Text */}
      <p 
        className="mt-6 text-gray-600 font-medium animate-pulse"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        {text}
      </p>
      
      {/* Progress Bar */}
      <div className="mt-4 w-64 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full animate-progress"
          style={{ 
            backgroundColor: '#2A7FFF',
            animation: 'progress 2s ease-in-out infinite'
          }}
        ></div>
      </div>
      
      <style jsx>{`
        @keyframes progress {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 75%;
            margin-left: 0%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  )
}
