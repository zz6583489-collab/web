import { afterEach, describe, expect, it } from 'vitest'
import { AxiosHeaders } from 'axios'
import { apiClient } from '../../api/client'
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markNotificationRead,
} from './notificationApi'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('notification API', () => {
  it('uses recipient-scoped list, count and read endpoints', async () => {
    const requests: string[] = []
    apiClient.defaults.adapter = async (config) => {
      requests.push(`${config.method?.toUpperCase()} ${config.url}`)
      return {
        config,
        data: {
          code: 'OK',
          data:
            config.url === '/notifications/unread-count'
              ? { count: 2 }
              : { items: [], total: 0, page: 1, pageSize: 20 },
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
      }
    }

    expect((await listNotifications(1, true)).total).toBe(0)
    expect(await getUnreadCount()).toBe(2)
    await markNotificationRead('12')
    await markAllRead()
    expect(requests).toEqual([
      'GET /notifications',
      'GET /notifications/unread-count',
      'POST /notifications/12/read',
      'POST /notifications/read-all',
    ])
  })
})
