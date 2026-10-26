export interface ApiResponse<T> {
  code: string
  message: string
  data: T
  traceId: string
}

export interface UserView {
  id: string
  username: string
  displayName: string
  email: string | null
  systemAdmin: boolean
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface LoginView {
  accessToken: string
  tokenType: 'Bearer'
  expiresInSeconds: number
}
