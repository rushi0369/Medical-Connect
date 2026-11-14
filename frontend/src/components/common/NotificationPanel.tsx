import { AlertTriangle, Bell, Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { useNotifications } from '../../hooks/useNotifications'
import { useToast } from '../../hooks/useToast'
import {
  bulkDeleteNotifications,
  deleteNotification,
} from '../../services/notification.service'
import type { AppNotification } from '../../types/dashboard'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime } from '../../utils/format'
import { DangerButton, IconButton, SecondaryButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { Modal } from '../ui/Modal'

type NotificationPanelProps = Pick<
  ReturnType<typeof useNotifications>,
  'notifications' | 'unreadCount' | 'hasLoaded' | 'error' | 'isLoading' | 'reload' | 'markRead' | 'markAllRead'
>

export function NotificationPanel({
  notifications,
  unreadCount,
  hasLoaded,
  error,
  isLoading,
  reload,
  markRead,
  markAllRead,
}: NotificationPanelProps) {
  const showToast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  // Admin Selection & Deletion State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingNotification, setDeletingNotification] = useState<AppNotification | null>(null)
  const [isDeletingSingle, setIsDeletingSingle] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  const allCurrentIds = notifications.map((n) => n.id)
  const isAllSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedIds.includes(id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(selectedIds.filter((id) => !allCurrentIds.includes(id)))
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...allCurrentIds])))
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  async function handleConfirmDeleteSingle() {
    if (!deletingNotification) return
    setIsDeletingSingle(true)
    try {
      await deleteNotification(deletingNotification.id)
      showToast('Notification deleted permanently from database.', 'success')
      setSelectedIds(selectedIds.filter((id) => id !== deletingNotification.id))
      setDeletingNotification(null)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete notification.'), 'error')
    } finally {
      setIsDeletingSingle(false)
    }
  }

  async function handleConfirmBulkDelete() {
    if (selectedIds.length === 0) return
    setIsDeletingBulk(true)
    try {
      await bulkDeleteNotifications(selectedIds)
      showToast(`Deleted ${selectedIds.length} notification(s) permanently from database.`, 'success')
      setSelectedIds([])
      setIsBulkDeleteModalOpen(false)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete notifications.'), 'error')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  const runAction = (action: Promise<void>) =>
    action.catch((actionError: unknown) => showToast(getErrorMessage(actionError), 'error'))

  if (!hasLoaded && isLoading) return <LoadingState label="Loading notifications..." />
  if (error && !hasLoaded) return <ErrorState message={getErrorMessage(error)} onRetry={reload} />

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications"
        message="Updates about orders, bills and deliveries will appear here."
      />
    )
  }

  return (
    <div>
      {/* Top action bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-text cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span>Select All</span>
            </label>
          )}
          {unreadCount > 0 && (
            <p className="text-xs text-text-secondary">({unreadCount} unread)</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && selectedIds.length > 0 && (
            <DangerButton
              icon={Trash2}
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="text-xs py-1 px-2.5"
            >
              Delete Selected ({selectedIds.length})
            </DangerButton>
          )}
          {unreadCount > 0 && (
            <SecondaryButton icon={Check} onClick={() => runAction(markAllRead())} className="text-xs py-1 px-2.5">
              Mark all read
            </SecondaryButton>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={`flex items-start gap-3 py-3 px-2 rounded-control transition ${
              isAdmin && selectedIds.includes(notification.id) ? 'bg-primary-subtle/30' : 'hover:bg-surface-muted/30'
            }`}
          >
            {isAdmin && (
              <input
                type="checkbox"
                checked={selectedIds.includes(notification.id)}
                onChange={() => toggleSelectOne(notification.id)}
                className="mt-1 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
              />
            )}
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.isRead ? 'bg-transparent' : 'bg-primary'}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm text-text ${notification.isRead ? '' : 'font-semibold'}`}>
                {notification.title}
                {!notification.isRead && <span className="sr-only"> (unread)</span>}
              </p>
              <p className="mt-0.5 text-sm text-text-secondary">{notification.message}</p>
              <p className="mt-1 text-xs text-text-secondary">{formatDateTime(notification.createdAt)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!notification.isRead && (
                <IconButton icon={Check} label="Mark as read" onClick={() => runAction(markRead(notification.id))} />
              )}
              {isAdmin && (
                <IconButton
                  icon={Trash2}
                  label="Delete notification"
                  tone="danger"
                  onClick={() => setDeletingNotification(notification)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Admin Single Delete Notification Modal */}
      {isAdmin && (
        <Modal
          isOpen={Boolean(deletingNotification)}
          onClose={() => setDeletingNotification(null)}
          title="Delete Notification"
          footer={
            <div className="flex items-center justify-end gap-3">
              <SecondaryButton onClick={() => setDeletingNotification(null)}>Cancel</SecondaryButton>
              <DangerButton onClick={handleConfirmDeleteSingle} isLoading={isDeletingSingle}>
                Delete Permanently
              </DangerButton>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Delete this notification from the database?</p>
                <p className="mt-1 text-danger/90">
                  <strong>{deletingNotification?.title}</strong>
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Bulk Delete Notifications Modal */}
      {isAdmin && (
        <Modal
          isOpen={isBulkDeleteModalOpen}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          title="Delete Selected Notifications"
          footer={
            <div className="flex items-center justify-end gap-3">
              <SecondaryButton onClick={() => setIsBulkDeleteModalOpen(false)}>Cancel</SecondaryButton>
              <DangerButton onClick={handleConfirmBulkDelete} isLoading={isDeletingBulk}>
                Yes, Delete {selectedIds.length} Notifications
              </DangerButton>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Permanently delete {selectedIds.length} notification(s) from database?
                </p>
                <p className="mt-1 text-danger/90">This cannot be undone.</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
