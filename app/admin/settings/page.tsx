"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useRef, useEffect } from "react"
import {
  Save,
  Store,
  Mail,
  Phone,
  MapPin,
  Image as ImageIcon,
  Receipt,
  Truck,
  Globe,
  CreditCard,
  Percent,
  Tag,
  Palette,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Link,
  FileText,
  Shield,
} from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"

type SectionKey = "store" | "branding" | "business" | "shipping" | "social"

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; description: string }[] = [
  { key: "store", label: "Store Information", icon: Store, description: "Basic store details and contact info" },
  { key: "branding", label: "Branding", icon: Palette, description: "Logo, signature, and visual identity" },
  { key: "business", label: "Business", icon: CreditCard, description: "Currency, tax, and pricing" },
  { key: "shipping", label: "Shipping", icon: Truck, description: "Shipping fees and thresholds" },
  { key: "social", label: "Online Presence", icon: Globe, description: "Website, social links, and SEO" },
]

function FieldGroup({
  label,
  icon: Icon,
  children,
  className = "",
}: {
  label: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="flex items-center text-sm font-medium text-gray-700 gap-1.5">
        <Icon className="h-4 w-4 text-maroon-600" />
        {label}
      </label>
      {children}
    </div>
  )
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <input
      type={type}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-colors bg-white"
      required={required}
    />
  )
}

function NumberInput({
  id,
  value,
  onChange,
  min = 0,
  max,
  step = "0.01",
  prefix,
}: {
  id: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: string
  prefix?: string
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{prefix}</span>
      )}
      <input
        type="number"
        id={id}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className={`w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-colors bg-white ${prefix ? "pl-7 pr-3 py-2" : "px-3 py-2"}`}
      />
    </div>
  )
}

function SelectInput({
  id,
  value,
  onChange,
  options,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-colors bg-white"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function ImageUpload({
  id,
  preview,
  onUpload,
  onRemove,
  accept = "image/*",
  label,
}: {
  id: string
  preview: string | null
  onUpload: (file: File) => void
  onRemove: () => void
  accept?: string
  label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ImageIcon className="h-4 w-4" />
          Choose {label}
        </button>
        <input
          ref={inputRef}
          type="file"
          id={id}
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
          }}
          className="hidden"
        />
        {preview && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>
      {preview && (
        <div className="relative w-20 h-20 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <img src={preview} alt={label} className="w-full h-full object-contain" />
        </div>
      )}
    </div>
  )
}

export default function AdminSettings() {
  const { data, mutate, isLoading } = useSettingsData()
  const [settings, setSettings] = useState<any>({})
  const [successMessage, setSuccessMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    store: true,
    branding: true,
    business: true,
    shipping: true,
    social: true,
  })

  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setSettings(data)
      setLogoPreview(data.brandLogo || null)
      setSignaturePreview(data.signature || null)
    }
  }, [data])

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })

  const handleLogoChange = async (file: File) => {
    const base64 = await toBase64(file)
    setSettings((s: any) => ({ ...s, brandLogo: base64 }))
    setLogoPreview(base64)
  }

  const handleSignatureChange = async (file: File) => {
    const base64 = await toBase64(file)
    setSettings((s: any) => ({ ...s, signature: base64 }))
    setSignaturePreview(base64)
  }

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const updateField = (field: string, value: any) => {
    setSettings((s: any) => ({ ...s, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      mutate()
      setSuccessMessage("Settings saved successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      console.error("Failed to save settings:", err)
      setSuccessMessage("Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const renderSectionContent = (key: SectionKey) => {
    switch (key) {
      case "store":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Store Name" icon={Store}>
              <TextInput
                id="storeName"
                value={settings.storeName || ""}
                onChange={(v) => updateField("storeName", v)}
                placeholder="e.g. Sara Electronics"
                required
              />
            </FieldGroup>

            <FieldGroup label="Legal Entity Name" icon={Shield}>
              <TextInput
                id="legalName"
                value={settings.legalName || ""}
                onChange={(v) => updateField("legalName", v)}
                placeholder="e.g. SARA Mobiles Pvt. Ltd."
              />
            </FieldGroup>

            <FieldGroup label="Years of Trust" icon={Store}>
              <TextInput
                id="statYears"
                value={settings.statYears || ""}
                onChange={(v) => updateField("statYears", v)}
                placeholder="e.g. 25+"
              />
            </FieldGroup>

            <FieldGroup label="Store Count (marketing)" icon={Store}>
              <TextInput
                id="statStores"
                value={settings.statStores || ""}
                onChange={(v) => updateField("statStores", v)}
                placeholder="e.g. 85+"
              />
            </FieldGroup>

            <FieldGroup label="Happy Customers" icon={Store}>
              <TextInput
                id="statCustomers"
                value={settings.statCustomers || ""}
                onChange={(v) => updateField("statCustomers", v)}
                placeholder="e.g. 2,00,000+"
              />
            </FieldGroup>

            <FieldGroup label="Store Email" icon={Mail}>
              <TextInput
                id="storeEmail"
                type="email"
                value={settings.storeEmail || ""}
                onChange={(v) => updateField("storeEmail", v)}
                placeholder="e.g. contact@example.com"
                required
              />
            </FieldGroup>

            <FieldGroup label="Store Phone" icon={Phone}>
              <TextInput
                id="storePhone"
                value={settings.storePhone || ""}
                onChange={(v) => updateField("storePhone", v)}
                placeholder="e.g. +91 98765 43210"
                required
              />
            </FieldGroup>

            <FieldGroup label="Store Address" icon={MapPin}>
              <TextInput
                id="storeAddress"
                value={settings.storeAddress || ""}
                onChange={(v) => updateField("storeAddress", v)}
                placeholder="e.g. 123 Main St, City, State"
                required
              />
            </FieldGroup>

            <FieldGroup label="Store Description" icon={FileText} className="md:col-span-2">
              <textarea
                id="storeDescription"
                value={settings.storeDescription || ""}
                onChange={(e) => updateField("storeDescription", e.target.value)}
                placeholder="Brief description of your store..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-colors bg-white resize-none"
              />
            </FieldGroup>
          </div>
        )

      case "branding":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Brand Logo" icon={ImageIcon}>
              <ImageUpload
                id="brandLogo"
                preview={logoPreview}
                onUpload={handleLogoChange}
                onRemove={() => {
                  setLogoPreview(null)
                  updateField("brandLogo", null)
                }}
                label="Logo"
              />
            </FieldGroup>

            <FieldGroup label="Signature" icon={FileText}>
              <ImageUpload
                id="signature"
                preview={signaturePreview}
                onUpload={handleSignatureChange}
                onRemove={() => {
                  setSignaturePreview(null)
                  updateField("signature", null)
                }}
                label="Signature"
              />
            </FieldGroup>

            <FieldGroup label="Storefront Photo URL" icon={ImageIcon}>
              <TextInput
                id="storefrontImage"
                value={settings.storefrontImage || ""}
                onChange={(v) => updateField("storefrontImage", v)}
                placeholder="/media/... — used on About, Contact, Store Locator & footer"
              />
            </FieldGroup>

            <FieldGroup label="Lifestyle Photo URL" icon={ImageIcon}>
              <TextInput
                id="lifestyleImage"
                value={settings.lifestyleImage || ""}
                onChange={(v) => updateField("lifestyleImage", v)}
                placeholder="/media/... — used in the About 'Our Story' block"
              />
            </FieldGroup>

            <FieldGroup label="Karnataka Landmark Photo URL" icon={ImageIcon}>
              <TextInput
                id="landmarkImage"
                value={settings.landmarkImage || ""}
                onChange={(v) => updateField("landmarkImage", v)}
                placeholder="/media/... — used in the About closing banner"
              />
            </FieldGroup>

            <FieldGroup label="Primary Color" icon={Palette}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={settings.primaryColor || "#7e22ce"}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
                <TextInput
                  id="primaryColorHex"
                  value={settings.primaryColor || "#7e22ce"}
                  onChange={(v) => updateField("primaryColor", v)}
                  placeholder="#7e22ce"
                />
              </div>
            </FieldGroup>

            <FieldGroup label="Favicon URL" icon={ImageIcon}>
              <TextInput
                id="favicon"
                value={settings.favicon || ""}
                onChange={(v) => updateField("favicon", v)}
                placeholder="/favicon.ico"
              />
            </FieldGroup>
          </div>
        )

      case "business":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Currency" icon={CreditCard}>
              <SelectInput
                id="currency"
                value={settings.currency || "INR"}
                onChange={(v) => updateField("currency", v)}
                options={[
                  { value: "INR", label: "Indian Rupee (INR)" },
                  { value: "USD", label: "US Dollar (USD)" },
                  { value: "EUR", label: "Euro (EUR)" },
                  { value: "GBP", label: "British Pound (GBP)" },
                ]}
              />
            </FieldGroup>

            <FieldGroup label="Tax Rate (%)" icon={Percent}>
              <NumberInput
                id="taxRate"
                value={settings.taxRate || 0}
                onChange={(v) => updateField("taxRate", v)}
                min={0}
                max={100}
                prefix="%"
              />
            </FieldGroup>

            <FieldGroup label="GST Number" icon={Receipt}>
              <TextInput
                id="gstNumber"
                value={settings.gstNumber || ""}
                onChange={(v) => updateField("gstNumber", v)}
                placeholder="e.g. 22AAAAA0000A1Z5"
              />
            </FieldGroup>

            <FieldGroup label="PAN Number" icon={Shield}>
              <TextInput
                id="panNumber"
                value={settings.panNumber || ""}
                onChange={(v) => updateField("panNumber", v)}
                placeholder="e.g. ABCDE1234F"
              />
            </FieldGroup>
          </div>
        )

      case "shipping":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Shipping Fee" icon={Truck}>
              <NumberInput
                id="shippingFee"
                value={settings.shippingFee || 0}
                onChange={(v) => updateField("shippingFee", v)}
                min={0}
                prefix="INR"
              />
            </FieldGroup>

            <FieldGroup label="Free Shipping Threshold" icon={Tag}>
              <NumberInput
                id="freeShippingThreshold"
                value={settings.freeShippingThreshold || 0}
                onChange={(v) => updateField("freeShippingThreshold", v)}
                min={0}
                prefix="INR"
              />
            </FieldGroup>

            <FieldGroup label="COD Available" icon={CheckCircle}>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => updateField("codAvailable", !settings.codAvailable)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.codAvailable ? "bg-maroon-600" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.codAvailable ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
                <span className="text-sm text-gray-600">{settings.codAvailable ? "Enabled" : "Disabled"}</span>
              </div>
            </FieldGroup>

            <FieldGroup label="Estimated Delivery Days" icon={Truck}>
              <NumberInput
                id="estimatedDeliveryDays"
                value={settings.estimatedDeliveryDays || 5}
                onChange={(v) => updateField("estimatedDeliveryDays", v)}
                min={1}
              />
            </FieldGroup>
          </div>
        )

      case "social":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Website URL" icon={Globe}>
              <TextInput
                id="websiteUrl"
                value={settings.websiteUrl || ""}
                onChange={(v) => updateField("websiteUrl", v)}
                placeholder="https://example.com"
              />
            </FieldGroup>

            <FieldGroup label="Facebook URL" icon={Link}>
              <TextInput
                id="facebookUrl"
                value={settings.facebookUrl || ""}
                onChange={(v) => updateField("facebookUrl", v)}
                placeholder="https://facebook.com/yourpage"
              />
            </FieldGroup>

            <FieldGroup label="Instagram URL" icon={Link}>
              <TextInput
                id="instagramUrl"
                value={settings.instagramUrl || ""}
                onChange={(v) => updateField("instagramUrl", v)}
                placeholder="https://instagram.com/yourpage"
              />
            </FieldGroup>

            <FieldGroup label="Twitter / X URL" icon={Link}>
              <TextInput
                id="twitterUrl"
                value={settings.twitterUrl || ""}
                onChange={(v) => updateField("twitterUrl", v)}
                placeholder="https://x.com/yourhandle"
              />
            </FieldGroup>

            <FieldGroup label="YouTube URL" icon={Link}>
              <TextInput
                id="youtubeUrl"
                value={settings.youtubeUrl || ""}
                onChange={(v) => updateField("youtubeUrl", v)}
                placeholder="https://youtube.com/yourchannel"
              />
            </FieldGroup>

            <FieldGroup label="WhatsApp Number" icon={Phone}>
              <TextInput
                id="whatsappNumber"
                value={settings.whatsappNumber || ""}
                onChange={(v) => updateField("whatsappNumber", v)}
                placeholder="e.g. +919876543210"
              />
            </FieldGroup>

            <FieldGroup label="Meta Title" icon={FileText}>
              <TextInput
                id="metaTitle"
                value={settings.metaTitle || ""}
                onChange={(v) => updateField("metaTitle", v)}
                placeholder="Page title for SEO"
              />
            </FieldGroup>

            <FieldGroup label="Meta Description" icon={FileText}>
              <TextInput
                id="metaDescription"
                value={settings.metaDescription || ""}
                onChange={(v) => updateField("metaDescription", v)}
                placeholder="Page description for SEO"
              />
            </FieldGroup>
          </div>
        )
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Store Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your store details, branding, and business settings</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-maroon-800 text-white rounded-lg hover:bg-maroon-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Save All Settings"}
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            successMessage.includes("Failed")
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {successMessage.includes("Failed") ? (
            <XCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {successMessage}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !data && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j}>
                    <div className="h-4 w-20 bg-gray-100 rounded animate-pulse mb-2" />
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings Sections */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {SECTIONS.map(({ key, label, icon: Icon, description }) => (
          <div
            key={key}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-shadow hover:shadow-md"
          >
            {/* Section Header */}
            <button
              type="button"
              onClick={() => toggleSection(key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-maroon-100 p-2 rounded-lg">
                  <Icon className="h-5 w-5 text-maroon-700" />
                </div>
                <div className="text-left">
                  <h2 className="text-base font-semibold text-gray-900">{label}</h2>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </div>
              {expandedSections[key] ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Section Content */}
            {expandedSections[key] && (
              <div className="px-5 pb-5 border-t border-gray-100">
                <div className="pt-4">{renderSectionContent(key)}</div>
              </div>
            )}
          </div>
        ))}

        {/* Bottom Save Bar */}
        <div className="flex justify-end pt-2 pb-4">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-maroon-800 text-white rounded-lg hover:bg-maroon-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </form>
    </div>
  )
}
