import { useCallback } from 'react'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notification.service'
import { useAsyncData } from './useAsyncData'

export function useNotifications({ page = 1, pageSize = 10 }: { page?: number; pageSize?: number } = {}) {
  const { data, error, isLoading, reload } = useAsyncData(
    (signal) => fetchNotifications({ page, pageSize }, signal),
    [page, pageSize],
  )

  const markRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id)
      reload()
    },
    [reload],
  )

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    reload()
  }, [reload])

  return {
    notifications: data?.notifications ?? [],
    meta: data?.meta ?? null,
    unreadCount: data?.meta.unreadCount ?? 0,
    hasLoaded: data !== null,
    error,
    isLoading,
    reload,
    markRead,
    markAllRead,
  }
}
