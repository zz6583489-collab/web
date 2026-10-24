import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient, setAccessToken } from '../api/client'
import type { ApiResponse, LoginView, UserView } from '../types/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserView | null>(null)

  async function login(username: string, password: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<LoginView>>('/auth/login', {
      username,
      password,
    })
    token.value = response.data.data.accessToken
    setAccessToken(token.value)
    try {
      const me = await apiClient.get<ApiResponse<UserView>>('/users/me')
      user.value = me.data.data
    } catch (error) {
      logout()
      throw error
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    setAccessToken(null)
  }

  return { token, user, login, logout }
})
