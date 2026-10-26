import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient, observeAccessToken, setAccessToken } from '../api/client'
import type { ApiResponse, LoginView, UserView } from '../types/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserView | null>(null)
  const initialized = ref(false)
  let restoring: Promise<void> | null = null
  observeAccessToken((nextToken) => {
    token.value = nextToken
    if (!nextToken) user.value = null
  })

  function clearLocal(): void {
    token.value = null
    user.value = null
    setAccessToken(null)
  }

  async function loadUser(): Promise<void> {
    const me = await apiClient.get<ApiResponse<UserView>>('/users/me')
    user.value = me.data.data
  }

  async function login(username: string, password: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<LoginView>>('/auth/login', {
      username,
      password,
    })
    token.value = response.data.data.accessToken
    setAccessToken(token.value)
    try {
      await loadUser()
      initialized.value = true
    } catch (error) {
      try {
        await apiClient.post('/auth/logout', null, { headers: { 'X-TeamFlow-CSRF': '1' } })
      } finally {
        clearLocal()
      }
      throw error
    }
  }

  async function restore(): Promise<void> {
    if (initialized.value) return
    if (restoring) return restoring
    restoring = (async () => {
      try {
        const response = await apiClient.post<ApiResponse<LoginView>>('/auth/refresh', null, {
          headers: { 'X-TeamFlow-CSRF': '1' },
        })
        token.value = response.data.data.accessToken
        setAccessToken(token.value)
        await loadUser()
      } catch {
        clearLocal()
      } finally {
        initialized.value = true
      }
    })()
    try {
      await restoring
    } finally {
      restoring = null
    }
  }

  async function logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout', null, { headers: { 'X-TeamFlow-CSRF': '1' } })
    } finally {
      clearLocal()
      initialized.value = true
    }
  }

  return { token, user, initialized, login, restore, logout }
})
