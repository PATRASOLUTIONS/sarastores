"use client"

import type React from "react"

import { useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import { Bell, Lock, Eye, EyeOff } from "lucide-react"

export default function SettingsPage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lock = useSubmitLock()

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [orderUpdates, setOrderUpdates] = useState(true)
  const [promotions, setPromotions] = useState(true)
  const [savingNotifications, setSavingNotifications] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match")
      return
    }

    if (!lock.acquire()) return
    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // In a real app, this would be an API call to change the password
      toast.success("Password changed successfully")

      // Reset form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error("Error changing password:", error)
      toast.error("Failed to change password")
    } finally {
      lock.release()
      setIsSubmitting(false)
    }
  }

  const handleNotificationSave = async (e: React.FormEvent) => {
    e.preventDefault()

    setSavingNotifications(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // In a real app, this would be an API call to update notification preferences
      toast.success("Notification preferences updated")
    } catch (error) {
      console.error("Error updating notification preferences:", error)
      toast.error("Failed to update notification preferences")
    } finally {
      setSavingNotifications(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Password Settings */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 bg-gray-50 border-b flex items-center">
          <Lock className="h-5 w-5 mr-2 text-gray-500" />
          <h2 className="text-xl font-semibold">Password Settings</h2>
        </div>

        <div className="p-6">
          <form onSubmit={handlePasswordChange}>
            <div className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters long</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-maroon-800 text-white rounded-md hover:bg-maroon-900 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Changing Password..." : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 bg-gray-50 border-b flex items-center">
          <Bell className="h-5 w-5 mr-2 text-gray-500" />
          <h2 className="text-xl font-semibold">Notification Settings</h2>
        </div>

        <div className="p-6">
          <form onSubmit={handleNotificationSave}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Email Notifications</h3>
                  <p className="text-sm text-gray-600">Receive emails about your account activity</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={() => setEmailNotifications(!emailNotifications)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-maroon-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-maroon-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Order Updates</h3>
                  <p className="text-sm text-gray-600">Receive updates about your orders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={orderUpdates}
                    onChange={() => setOrderUpdates(!orderUpdates)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-maroon-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-maroon-800"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Promotions and Offers</h3>
                  <p className="text-sm text-gray-600">Receive emails about promotions and special offers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promotions}
                    onChange={() => setPromotions(!promotions)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-maroon-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-maroon-800"></div>
                </label>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={savingNotifications}
                className="px-6 py-2 bg-maroon-800 text-white rounded-md hover:bg-maroon-900 transition-colors disabled:opacity-50"
              >
                {savingNotifications ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
