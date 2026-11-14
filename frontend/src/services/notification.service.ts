import type { ApiSuccess, PageMeta } from '../types/api'
import type { AppNotification } from '../types/dashboard'
import { api } from './api'

export async function fetchNotifications(params: { page: number; pageSize: number }, signal?: AbortSignal) {
  const { data } = await api.get<ApiSuccess<AppNotification[], PageMeta & { unreadCount: number }>>('/notifications', {
    params,
    signal,
  })
  return { notifications: data.data, meta: data.meta }
}

export async function markNotificationRead(id: string) {
  await api.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead() {
  await api.patch('/notifications/read-all')
}

export async function deleteNotification(id: string) {
  await api.delete(`/notifications/${id}`)
}

export async function bulkDeleteNotifications(notificationIds: string[]) {
  await api.post('/notifications/bulk-delete', { notificationIds })
}
