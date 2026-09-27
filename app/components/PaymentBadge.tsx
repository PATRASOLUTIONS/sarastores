import { FC } from 'react'

interface PaymentBadgeProps {
  method: string
}

const PaymentBadge: FC<PaymentBadgeProps> = ({ method }) => {
  const getBadgeColors = () => {
    switch (method.toLowerCase()) {
      case 'razorpay':
        return 'bg-blue-100 text-blue-800'
      case 'instore':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColors()}`}>
      {method.charAt(0).toUpperCase() + method.slice(1)}
    </span>
  )
}

export default PaymentBadge