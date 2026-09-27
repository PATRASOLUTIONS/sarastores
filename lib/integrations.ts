export interface Integration {
  id: string
  name: string
  description?: string
  path: string
  status: 'connected' | 'not-configured' | string
  /** False when no admin page exists yet, so the card doesn't link into a 404. */
  available: boolean
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'kgen',
    name: 'eXlr8 / KGen',
    description: 'Product catalogue integration (vouchers & digital products).',
    path: '/admin/integrations/kgen',
    status: 'connected',
    available: true,
  },
  {
    id: 'mockpay',
    name: 'MockPay',
    description: 'Placeholder payment gateway integration.',
    path: '/admin/integrations/mockpay',
    status: 'not-configured',
    available: false,
  },
]

export const getConnectedIntegrations = () =>
  INTEGRATIONS.filter((i) => i.status === 'connected' && i.available)
