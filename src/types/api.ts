export interface ApiResponse<T> {
  code: string
  message: string
  data: T
  traceId: string
}

export interface UserView {
  id: number
  username: string
  displayName: string
  email: string | null
}

export interface LoginView {
  accessToken: string
  tokenType: 'Bearer'
  expiresInSeconds: number
}
