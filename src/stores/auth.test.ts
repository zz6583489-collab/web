import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { apiClient, setAccessToken } from '../api/client'
import { useAuthStore } from './auth'

const user = {
  id: '9007199254740993',
  username: 'alice',
  displayName: 'Alice',
  email: null,
  systemAdmin: true,
}

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => {
  vi.restoreAllMocks()
  setAccessToken(null)
})

describe('auth store', () => {
  it('restores the session from an HttpOnly refresh cookie after reload', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { data: { accessToken: 'jwt' } } })
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: user } })
    const auth = useAuthStore()

    await auth.restore()

    expect(post).toHaveBeenCalledWith('/auth/refresh', null, {
      headers: { 'X-TeamFlow-CSRF': '1' },
    })
    expect(auth.token).toBe('jwt')
    expect(auth.user?.id).toBe('9007199254740993')
    expect(auth.initialized).toBe(true)
  })

  it('clears the local identity after server logout', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { data: { accessToken: 'jwt' } } })
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: user } })
    const auth = useAuthStore()
    await auth.login('alice', 'valid-password')

    await auth.logout()

    expect(post).toHaveBeenCalledWith('/auth/logout', null, {
      headers: { 'X-TeamFlow-CSRF': '1' },
    })
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
  })
})
