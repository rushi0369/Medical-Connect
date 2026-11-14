import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ClipboardList,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DangerButton, SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { controlClasses } from '../../components/ui/Field'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import {
  bulkDeleteAdminOrders,
  deleteAdminOrder,
  fetchAdminOrders,
  purgeOldAdminOrders,
} from '../../services/admin.service'
import type { OrderSummary } from '../../types/order'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime, formatPaise } from '../../utils/format'
import { ORDER_STATUS_DISPLAY } from '../../utils/statusLabels'

const STATUS_FILTERS = [
  { value: '', label: 'All Orders' },
  { value: 'PENDING_ADMIN_REVIEW', label: 'New Requests' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'WAITING_FOR_CUSTOMER_APPROVAL', label: 'Needs Approval' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PURGE_DAYS_OPTIONS = [
  { value: 10, label: 'Older than 10 days' },
  { value: 20, label: 'Older than 20 days' },
  { value: 30, label: 'Older than 30 days (Recommended)' },
  { value: 60, label: 'Older than 60 days' },
  { value: 90, label: 'Older than 90 days' },
]

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const showToast = useToast()

  // Single Delete state
  const [deletingOrder, setDeletingOrder] = useState<OrderSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Selection & Bulk Delete state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  // Bulk Purge state
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false)
  const [purgeDays, setPurgeDays] = useState(30)
  const [purgeScope, setPurgeScope] = useState<'ALL' | 'COMPLETED' | 'CANCELLED' | 'DELIVERED'>('COMPLETED')
  const [isPurging, setIsPurging] = useState(false)

  const { data, error, isLoading, reload } = useAsyncData(
    () =>
      fetchAdminOrders({
        page,
        pageSize: 15,
        status: status || undefined,
        search: search.trim() || undefined,
      }),
    [page, status, search],
  )

  const orders = data?.data ?? []
  const meta = data?.meta

  const allCurrentIds = orders.map((o) => o.id)
  const isAllSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedOrderIds.includes(id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedOrderIds(selectedOrderIds.filter((id) => !allCurrentIds.includes(id)))
    } else {
      setSelectedOrderIds(Array.from(new Set([...selectedOrderIds, ...allCurrentIds])))
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((item) => item !== id))
    } else {
      setSelectedOrderIds([...selectedOrderIds, id])
    }
  }

  async function handleSingleDelete() {
    if (!deletingOrder) return
    setIsDeleting(true)
    try {
      await deleteAdminOrder(deletingOrder.id)
      showToast(`Order #${deletingOrder.orderNumber} deleted permanently from database.`, 'success')
      setSelectedOrderIds(selectedOrderIds.filter((id) => id !== deletingOrder.id))
      setDeletingOrder(null)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete order.'), 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedOrderIds.length === 0) return
    setIsDeletingBulk(true)
    try {
      await bulkDeleteAdminOrders(selectedOrderIds)
      showToast(`Deleted ${selectedOrderIds.length} orders permanently from database.`, 'success')
      setSelectedOrderIds([])
      setIsBulkDeleteModalOpen(false)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete orders.'), 'error')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  async function handleBulkPurge(e: React.FormEvent) {
    e.preventDefault()
    setIsPurging(true)
    try {
      const result = await purgeOldAdminOrders({
        days: purgeDays,
        scope: purgeScope,
      })
      showToast(
        `Purged ${result.deletedOrdersCount} order(s) and freed ${result.freedPhotosCount} image(s) from database!`,
        'success',
      )
      setIsPurgeModalOpen(false)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to purge old orders.'), 'error')
    } finally {
      setIsPurging(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Order Requests"
        description="Review customer prescriptions, mark item availability, and prepare invoices."
        actions={
          <SecondaryButton
            icon={Trash2}
            onClick={() => setIsPurgeModalOpen(true)}
            className="text-xs text-danger hover:border-danger hover:bg-danger-subtle/50"
            title="Clean up old orders to prevent database from getting full"
          >
            Clean Up Old Orders
          </SecondaryButton>
        }
      />

      {/* Filter Tabs & Search */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-1.5 border-b border-border/80 pb-3">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
              }}
              className={`rounded-control px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === tab.value
                  ? 'bg-primary text-surface'
                  : 'bg-surface text-text-secondary hover:bg-surface-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="max-w-md">
          <input
            placeholder="Search by customer name, mobile, or order number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className={`h-11 ${controlClasses}`}
          />
        </div>
      </div>

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading ? (
        <LoadingState label="Loading orders..." />
      ) : orders.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={ClipboardList}
            title={search || status ? 'No orders match this filter' : 'No order requests yet'}
            message={
              search || status
                ? 'Try clearing the search or choosing a different status tab.'
                : 'Customer medicine requests will appear here as soon as they are submitted.'
            }
          />
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          {/* Select All and Bulk Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-surface px-4 py-3 shadow-xs">
            <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-text cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span>
                Select All ({orders.length} on this page)
              </span>
            </label>

            {selectedOrderIds.length > 0 && (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-text-secondary">
                  <strong className="text-text">{selectedOrderIds.length}</strong> order(s) selected
                </span>
                <DangerButton
                  icon={Trash2}
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="text-xs py-1.5 px-3"
                >
                  Delete Selected ({selectedOrderIds.length})
                </DangerButton>
              </div>
            )}
          </div>

          <div className="divide-y divide-border rounded-control border border-border bg-surface">
            {orders.map((order) => {
              const statusInfo = ORDER_STATUS_DISPLAY[order.status] ?? {
                label: order.status,
                tone: 'neutral',
              }

              return (
                <div
                  key={order.id}
                  className={`flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    selectedOrderIds.includes(order.id) ? 'bg-primary-subtle/30' : 'hover:bg-surface-muted/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={() => toggleSelectOne(order.id)}
                      className="mt-1 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                      title="Select order"
                    />

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-heading font-semibold text-text">{order.orderNumber}</span>
                        <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>
                      </div>

                      <div className="text-sm font-medium text-text">
                        {order.customer ? (
                          <span>
                            {order.customer.fullName} ({order.customer.phone})
                          </span>
                        ) : (
                          <span className="text-text-secondary">Customer</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                        <span>Placed on {formatDateTime(order.createdAt)}</span>
                        {order.photoCount > 0 && <span>📸 {order.photoCount} photo(s)</span>}
                        {order.itemCount > 0 && <span>💊 {order.itemCount} item(s)</span>}
                        {order.riderName && <span>🚴 Rider: {order.riderName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3 sm:border-0 sm:pt-0 sm:text-right">
                    <div>
                      {order.grandTotalPaise != null ? (
                        <>
                          <div className="text-xs text-text-secondary">Grand Total</div>
                          <div className="font-heading font-semibold text-text">
                            {formatPaise(order.grandTotalPaise)}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-text-secondary italic">Bill not prepared</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit / Review Button */}
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 rounded-control border border-border px-2.5 py-1.5 text-xs font-semibold text-text hover:bg-surface-muted transition"
                        title="Edit order items, medicine quantities, and pricing"
                      >
                        <Pencil className="size-3.5" />
                        <span>Edit</span>
                      </Link>

                      <Link
                        to={`/admin/orders/${order.id}`}
                        className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold transition-colors ${
                          order.status === 'CONFIRMED'
                            ? 'bg-primary text-surface hover:bg-primary-dark shadow-sm'
                            : order.status === 'DELIVERED'
                            ? 'bg-success/15 text-success hover:bg-success/25'
                            : 'bg-primary text-surface hover:bg-primary-dark'
                        }`}
                      >
                        {order.status === 'CONFIRMED' ? (
                          <>
                            <Bike className="size-3.5" />
                            Assign
                          </>
                        ) : order.status === 'DELIVERED' ? (
                          <>
                            <CheckCircle2 className="size-3.5" />
                            View
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" />
                            Review
                          </>
                        )}
                      </Link>

                      {/* Single Order Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeletingOrder(order)}
                        className="rounded-control p-1.5 text-text-secondary hover:bg-danger-subtle/60 hover:text-danger transition"
                        title="Delete order permanently from database"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                totalItems={meta.totalItems}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete Single Order Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingOrder)}
        onClose={() => setDeletingOrder(null)}
        title="Permanently Delete Order"
      >
        {deletingOrder && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">This action cannot be undone.</p>
                <p className="mt-0.5 text-danger/90">
                  Deleting order <strong>#{deletingOrder.orderNumber}</strong> will permanently remove it from MongoDB, including all customer prescription images, delivery logs, and bills to free up database storage.
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              Customer: <strong>{deletingOrder.customer?.fullName || 'Customer'}</strong> • Status:{' '}
              <span className="font-semibold text-text">{deletingOrder.status}</span>
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <SecondaryButton onClick={() => setDeletingOrder(null)}>Cancel</SecondaryButton>
              <DangerButton onClick={handleSingleDelete} isLoading={isDeleting} icon={Trash2}>
                Delete Permanently
              </DangerButton>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Delete Selected Orders Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="Delete Selected Orders"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Delete {selectedOrderIds.length} selected order(s) permanently?
              </p>
              <p className="mt-0.5 text-danger/90">
                This will permanently remove the orders, customer prescription photos, generated invoices, and delivery histories from MongoDB Atlas. This cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <SecondaryButton onClick={() => setIsBulkDeleteModalOpen(false)}>Cancel</SecondaryButton>
            <DangerButton onClick={handleBulkDelete} isLoading={isDeletingBulk} icon={Trash2}>
              Yes, Delete {selectedOrderIds.length} Orders
            </DangerButton>
          </div>
        </div>
      </Modal>

      {/* Bulk Purge Old Orders Modal (Date-Wise Cleanup) */}
      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        title="Clean Up Old Orders (Free Database Storage)"
      >
        <form onSubmit={handleBulkPurge} className="space-y-4">
          <p className="text-xs text-text-secondary">
            Permanently delete old orders and their stored prescription images from MongoDB to keep your database fast and avoid reaching storage limits.
          </p>

          <div>
            <label className="text-xs font-semibold text-text mb-1.5 block">
              Delete Orders Older Than:
            </label>
            <div className="space-y-1.5">
              {PURGE_DAYS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-between rounded-control border p-2.5 text-xs cursor-pointer transition ${
                    purgeDays === opt.value
                      ? 'border-primary bg-primary/5 font-semibold text-primary'
                      : 'border-border bg-surface text-text hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="purgeDays"
                      value={opt.value}
                      checked={purgeDays === opt.value}
                      onChange={() => setPurgeDays(opt.value)}
                      className="text-primary"
                    />
                    <span>{opt.label}</span>
                  </div>
                  <span className="text-[11px] text-text-secondary">
                    Before {new Date(Date.now() - opt.value * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text mb-1.5 block">
              Which Orders to Delete:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                className={`flex items-center gap-2 p-2.5 rounded-control border cursor-pointer ${
                  purgeScope === 'COMPLETED'
                    ? 'border-primary bg-primary/5 font-semibold text-primary'
                    : 'border-border bg-surface text-text'
                }`}
              >
                <input
                  type="radio"
                  name="purgeScope"
                  value="COMPLETED"
                  checked={purgeScope === 'COMPLETED'}
                  onChange={() => setPurgeScope('COMPLETED')}
                  className="text-primary"
                />
                Completed & Cancelled only (Safe)
              </label>

              <label
                className={`flex items-center gap-2 p-2.5 rounded-control border cursor-pointer ${
                  purgeScope === 'ALL'
                    ? 'border-danger bg-danger-subtle font-semibold text-danger'
                    : 'border-border bg-surface text-text'
                }`}
              >
                <input
                  type="radio"
                  name="purgeScope"
                  value="ALL"
                  checked={purgeScope === 'ALL'}
                  onChange={() => setPurgeScope('ALL')}
                  className="text-primary"
                />
                All orders older than selected
              </label>
            </div>
          </div>

          <div className="rounded-control bg-warning-subtle/50 border border-warning/30 p-3 text-xs text-text flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
            <p className="text-[11px] text-text-secondary">
              All selected orders, invoices, delivery records, and uploaded prescription images in MongoDB GridFS will be deleted permanently.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <SecondaryButton type="button" onClick={() => setIsPurgeModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <DangerButton type="submit" isLoading={isPurging} icon={Trash2}>
              Clean Up Database
            </DangerButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
