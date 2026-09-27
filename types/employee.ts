export interface Employee {
  _id?: string
  employeeId: string
  name: string
  email: string
  department: string
  role: string
  status: 'active' | 'inactive'
  dashboardAccess?: boolean
  allowedPages?: string[]
  storeAccess?: 'none' | 'selected' | 'all'
  storeIds?: string[]
  createdAt: string
  updatedAt: string
}