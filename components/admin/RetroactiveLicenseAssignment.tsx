/**
 * Retroactive License Assignment Admin Component
 * 
 * NOTE: This component requires shadcn/ui components. If not installed, either:
 * 1. Install shadcn/ui: npx shadcn-ui@latest init
 * 2. Or replace with your existing UI components
 * 
 * Required shadcn components: button, card, input, label, alert
 * Required icon library: lucide-react
 */

'use client'

import { useState } from 'react'
// NOTE: Replace these imports with your UI library if shadcn/ui is not available
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertCircle, Key, Mail, Package } from 'lucide-react'

interface AssignmentStats {
  totalOrders: number
  ordersProcessed: number
  licensesAssigned: number
  emailsSent: number
  ordersMarkedDelivered: number
  errorsCount: number
  errors: Array<{ orderId: string; error: string }>
}

export default function RetroactiveLicenseAssignment() {
  const [daysBack, setDaysBack] = useState(30)
  const [isChecking, setIsChecking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkResult, setCheckResult] = useState<{
    ordersNeedingLicenses: number
    message: string
  } | null>(null)
  const [processResult, setProcessResult] = useState<AssignmentStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = async () => {
    setIsChecking(true)
    setError(null)
    setCheckResult(null)
    setProcessResult(null)

    try {
      const response = await fetch(`/api/admin/assign-missing-licenses?daysBack=${daysBack}`)
      const data = await response.json()

      if (data.success) {
        setCheckResult({
          ordersNeedingLicenses: data.ordersNeedingLicenses,
          message: data.message
        })
      } else {
        setError(data.error || 'Failed to check orders')
      }
    } catch (err) {
      setError('Network error: Failed to check orders')
      console.error(err)
    } finally {
      setIsChecking(false)
    }
  }

  const handleAssign = async () => {
    if (!window.confirm(
      `This will assign licenses to ${checkResult?.ordersNeedingLicenses || 'all'} order(s) and send emails to customers. Continue?`
    )) {
      return
    }

    setIsProcessing(true)
    setError(null)
    setProcessResult(null)

    try {
      const response = await fetch('/api/admin/assign-missing-licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack })
      })

      const data = await response.json()

      if (data.success) {
        setProcessResult(data.stats)
        setCheckResult(null) // Clear check result after processing
      } else {
        setError(data.error || 'Failed to assign licenses')
      }
    } catch (err) {
      setError('Network error: Failed to assign licenses')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Retroactive License Assignment
        </CardTitle>
        <CardDescription>
          Assign license keys to orders that were placed before the automatic system was active
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="daysBack">Days to Check</Label>
              <Input
                id="daysBack"
                type="number"
                min="1"
                max="365"
                value={daysBack}
                onChange={(e) => setDaysBack(parseInt(e.target.value) || 30)}
                placeholder="30"
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Check orders from the last {daysBack} days
              </p>
            </div>

            <Button
              onClick={handleCheck}
              disabled={isChecking || isProcessing}
              variant="outline"
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check Orders'
              )}
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Check Result */}
        {checkResult && (
          <Alert className={checkResult.ordersNeedingLicenses > 0 ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}>
            <Package className="h-4 w-4" />
            <AlertTitle>Check Complete</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{checkResult.message}</p>
              {checkResult.ordersNeedingLicenses > 0 && (
                <Button
                  onClick={handleAssign}
                  disabled={isProcessing}
                  size="sm"
                  className="mt-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Assign Licenses Now
                    </>
                  )}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Processing Result */}
        {processResult && (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Processing Complete!</AlertTitle>
              <AlertDescription className="text-green-700">
                Successfully processed {processResult.ordersProcessed} order(s)
              </AlertDescription>
            </Alert>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                icon={<Package className="h-5 w-5 text-blue-600" />}
                label="Orders Found"
                value={processResult.totalOrders}
                bgColor="bg-blue-50"
              />
              <StatCard
                icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
                label="Orders Processed"
                value={processResult.ordersProcessed}
                bgColor="bg-green-50"
              />
              <StatCard
                icon={<Key className="h-5 w-5 text-purple-600" />}
                label="Licenses Assigned"
                value={processResult.licensesAssigned}
                bgColor="bg-purple-50"
              />
              <StatCard
                icon={<Mail className="h-5 w-5 text-indigo-600" />}
                label="Emails Sent"
                value={processResult.emailsSent}
                bgColor="bg-indigo-50"
              />
              <StatCard
                icon={<Package className="h-5 w-5 text-teal-600" />}
                label="Marked Delivered"
                value={processResult.ordersMarkedDelivered}
                bgColor="bg-teal-50"
              />
              <StatCard
                icon={<AlertCircle className="h-5 w-5 text-red-600" />}
                label="Errors"
                value={processResult.errorsCount}
                bgColor="bg-red-50"
              />
            </div>

            {/* Errors List */}
            {processResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errors Encountered</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {processResult.errors.map((err, index) => (
                      <li key={index} className="text-sm">
                        <strong>Order {err.orderId}:</strong> {err.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-sm mb-2">ℹ️ How it works:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Checks orders with software items that don't have license keys</li>
            <li>• Assigns unique unused license keys from the license pool</li>
            <li>• Marks orders as "delivered"</li>
            <li>• Sends activation emails to customers</li>
            <li>• Includes comprehensive error handling and logging</li>
          </ul>
        </div>

        {/* Warning */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            This action will send emails to customers. Make sure you have enough license keys
            available before proceeding. Check the console logs for detailed progress.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  bgColor
}: {
  icon: React.ReactNode
  label: string
  value: number
  bgColor: string
}) {
  return (
    <div className={`${bgColor} p-4 rounded-lg border border-gray-200`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
