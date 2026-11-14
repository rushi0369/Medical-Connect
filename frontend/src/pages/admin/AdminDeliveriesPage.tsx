import { AlertTriangle, Bike, MapPin, Trash2, Truck, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DangerButton, PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import {
  assignRiderToOrder,
  bulkDeleteAdminDeliveries,
  deleteAdminDelivery,
  fetchAdminDeliveries,
  fetchAvailableRiders,
  type AdminDeliveryItem,
  type AvailableRider,
} from '../../services/admin.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime, formatPaise } from '../../utils/format'

const DELIVERY_STATUS_TONE: Record<string, { label: string; tone: StatusTone }> = {
  RIDER_ASSIGNED: { label: 'Rider Assigned', tone: 'neutral' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', tone: 'warning' },
  REACHED_CUSTOMER: { label: 'Reached Customer', tone: 'warning' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  DELIVERY_FAILED: { label: 'Failed', tone: 'danger' },
  REASSIGNED: { label: 'Reassigned', tone: 'neutral' },
}

export default function AdminDeliveriesPage() {
  const showToast = useToast()
  const [page, setPage] = useState(1)
  const [scope, setScope] = useState('all')

  // Selection & Delete State
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([])
  const [deliveryToDelete, setDeliveryToDelete] = useState<AdminDeliveryItem | null>(null)
  const [isDeletingSingle, setIsDeletingSingle] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  const { data, error, isLoading, reload } = useAsyncData(
    () => fetchAdminDeliveries({ page, pageSize: 15, scope }),
    [page, scope],
  )

  const deliveries = data?.data ?? []
  const meta = data?.meta

  const allCurrentIds = deliveries.map((d) => d.id)
  const isAllDeliveriesSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedDeliveryIds.includes(id))

  function toggleSelectAllDeliveries() {
    if (isAllDeliveriesSelected) {
      setSelectedDeliveryIds(selectedDeliveryIds.filter((id) => !allCurrentIds.includes(id)))
    } else {
      setSelectedDeliveryIds(Array.from(new Set([...selectedDeliveryIds, ...allCurrentIds])))
    }
  }

  function toggleSelectOneDelivery(id: string) {
    if (selectedDeliveryIds.includes(id)) {
      setSelectedDeliveryIds(selectedDeliveryIds.filter((item) => item !== id))
    } else {
      setSelectedDeliveryIds([...selectedDeliveryIds, id])
    }
  }

  async function handleConfirmDeleteSingle() {
    if (!deliveryToDelete) return
    setIsDeletingSingle(true)
    try {
      await deleteAdminDelivery(deliveryToDelete.id)
      showToast(`Delivery assignment for order #${deliveryToDelete.orderNumber} deleted permanently.`, 'success')
      setSelectedDeliveryIds(selectedDeliveryIds.filter((id) => id !== deliveryToDelete.id))
      setDeliveryToDelete(null)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete delivery.'), 'error')
    } finally {
      setIsDeletingSingle(false)
    }
  }

  async function handleConfirmDeleteBulk() {
    if (selectedDeliveryIds.length === 0) return
    setIsDeletingBulk(true)
    try {
      await bulkDeleteAdminDeliveries(selectedDeliveryIds)
      showToast(`Deleted ${selectedDeliveryIds.length} delivery assignments permanently from database.`, 'success')
      setSelectedDeliveryIds([])
      setIsBulkDeleteModalOpen(false)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete deliveries.'), 'error')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  // Reassignment modal
  const [reassignDelivery, setReassignDelivery] = useState<AdminDeliveryItem | null>(null)
  const [availableRiders, setAvailableRiders] = useState<AvailableRider[]>([])
  const [selectedRiderId, setSelectedRiderId] = useState<string>('')
  const [isLoadingRiders, setIsLoadingRiders] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  async function openReassignModal(d: AdminDeliveryItem) {
    setReassignDelivery(d)
    setSelectedRiderId('')
    setAssignError(null)
    setIsLoadingRiders(true)
    try {
      const list = await fetchAvailableRiders()
      setAvailableRiders(list)
    } catch (err) {
      setAssignError(getErrorMessage(err, 'Failed to load available riders.'))
    } finally {
      setIsLoadingRiders(false)
    }
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reassignDelivery || !selectedRiderId) return

    setIsAssigning(true)
    setAssignError(null)
    try {
      await assignRiderToOrder(reassignDelivery.orderId, selectedRiderId)
      showToast('Rider assigned successfully!', 'success')
      setReassignDelivery(null)
      reload()
    } catch (err) {
      setAssignError(getErrorMessage(err, 'Failed to assign rider.'))
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Delivery Management"
        description="Monitor active dispatches, reassign riders, and delete delivery records."
      />

      {/* Scope Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-border/80 pb-3">
        {[
          { value: 'all', label: 'All Dispatches' },
          { value: 'active', label: 'Active on Road' },
          { value: 'history', label: 'Completed & Failed' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setScope(tab.value)
              setPage(1)
            }}
            className={`rounded-control px-3 py-1.5 text-xs font-semibold transition-colors ${
              scope === tab.value
                ? 'bg-primary text-surface'
                : 'bg-surface text-text-secondary hover:bg-surface-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading ? (
        <LoadingState label="Loading deliveries..." />
      ) : deliveries.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={Truck}
            title={scope === 'active' ? 'No active deliveries on the road' : 'No deliveries recorded yet'}
            message="When orders are confirmed and assigned to riders, they will appear here with live tracking updates."
          />
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          {/* Select All and Bulk Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-surface px-4 py-3 shadow-xs">
            <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-text cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllDeliveriesSelected}
                onChange={toggleSelectAllDeliveries}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span>
                Select All ({deliveries.length} on this page)
              </span>
            </label>

            {selectedDeliveryIds.length > 0 && (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-text-secondary">
                  <strong className="text-text">{selectedDeliveryIds.length}</strong> delivery assignment(s) selected
                </span>
                <DangerButton
                  icon={Trash2}
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="text-xs py-1.5 px-3"
                >
                  Delete Selected ({selectedDeliveryIds.length})
                </DangerButton>
              </div>
            )}
          </div>

          <div className="divide-y divide-border rounded-control border border-border bg-surface">
            {deliveries.map((del) => {
              const statusDisplay = DELIVERY_STATUS_TONE[del.status] ?? {
                label: del.status,
                tone: 'neutral',
              }
              const isActive = ['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'REACHED_CUSTOMER'].includes(del.status)

              return (
                <div
                  key={del.id}
                  className={`flex flex-col gap-4 p-5 transition-colors lg:flex-row lg:items-center lg:justify-between ${
                    selectedDeliveryIds.includes(del.id) ? 'bg-primary-subtle/30' : 'hover:bg-surface-muted/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedDeliveryIds.includes(del.id)}
                      onChange={() => toggleSelectOneDelivery(del.id)}
                      className="mt-1 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                      title="Select delivery"
                    />

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-heading font-semibold text-text">
                          Order #{del.orderNumber || 'ORDER'}
                        </span>
                        <StatusBadge tone={statusDisplay.tone}>{statusDisplay.label}</StatusBadge>
                        {del.paymentMethod && (
                          <span className="text-xs bg-surface-muted px-2 py-0.5 rounded border border-border text-text font-medium">
                            {del.paymentMethod === 'CASH' ? 'Cash on Delivery' : 'Store UPI QR'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                        {del.customer && (
                          <span>
                            Customer: <strong className="text-text">{del.customer.fullName}</strong> ({del.customer.phone})
                          </span>
                        )}
                        {del.rider && (
                          <span className="flex items-center gap-1 text-primary">
                            <Bike className="size-3.5" />
                            Rider: <strong>{del.rider.fullName}</strong> ({del.rider.riderId || del.rider.phone})
                          </span>
                        )}
                      </div>

                      {del.address && (
                        <div className="flex items-start gap-1 text-xs text-text-secondary">
                          <MapPin className="size-3.5 shrink-0 text-text-secondary mt-0.5" />
                          <span>
                            {del.address.area}, {del.address.city} - {del.address.pincode}
                          </span>
                        </div>
                      )}

                      <div className="text-[11px] text-text-secondary/70">
                        Assigned: {formatDateTime(del.assignedAt)}
                        {del.deliveredAt && ` • Delivered: ${formatDateTime(del.deliveredAt)}`}
                        {del.failedAt && ` • Failed: ${del.failureReason || 'Incomplete'}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 lg:border-0 lg:pt-0 lg:text-right">
                    <div>
                      <div className="text-xs text-text-secondary">Total Value</div>
                      <div className="font-heading font-semibold text-text">
                        {del.amountPaise != null ? formatPaise(del.amountPaise) : '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive && (
                        <SecondaryButton
                          icon={UserPlus}
                          onClick={() => openReassignModal(del)}
                          className="text-xs"
                        >
                          Reassign
                        </SecondaryButton>
                      )}

                      <Link
                        to={`/admin/orders/${del.orderId}`}
                        className="inline-flex items-center gap-1 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-surface hover:bg-primary-dark"
                      >
                        Order Details
                      </Link>

                      {/* Delete Delivery Button */}
                      <button
                        type="button"
                        onClick={() => setDeliveryToDelete(del)}
                        className="rounded-control p-1.5 text-text-secondary hover:bg-danger-subtle/60 hover:text-danger transition"
                        title="Delete delivery record permanently from database"
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
                page={page}
                totalPages={meta.totalPages}
                totalItems={meta.totalItems}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete Single Delivery Modal */}
      <Modal
        isOpen={Boolean(deliveryToDelete)}
        onClose={() => setDeliveryToDelete(null)}
        title="Delete Delivery Assignment"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Permanently delete this delivery assignment?</p>
              <p className="mt-1">
                Order #{deliveryToDelete?.orderNumber || 'ORDER'} assignment will be deleted from MongoDB Atlas.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <SecondaryButton onClick={() => setDeliveryToDelete(null)}>Cancel</SecondaryButton>
            <DangerButton onClick={handleConfirmDeleteSingle} isLoading={isDeletingSingle}>
              Delete Permanently
            </DangerButton>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Deliveries Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="Delete Selected Deliveries"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Delete {selectedDeliveryIds.length} delivery assignment(s) permanently?
              </p>
              <p className="mt-1">This will permanently remove the delivery assignments from MongoDB Atlas.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <SecondaryButton onClick={() => setIsBulkDeleteModalOpen(false)}>Cancel</SecondaryButton>
            <DangerButton onClick={handleConfirmDeleteBulk} isLoading={isDeletingBulk}>
              Yes, Delete {selectedDeliveryIds.length} Deliveries
            </DangerButton>
          </div>
        </div>
      </Modal>

      {/* Reassign Rider Modal */}
      <Modal
        isOpen={Boolean(reassignDelivery)}
        onClose={() => setReassignDelivery(null)}
        title={`Reassign Rider - Order #${reassignDelivery?.orderNumber || ''}`}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {assignError && (
            <div className="rounded-control bg-danger-subtle p-3 text-xs text-danger">
              {assignError}
            </div>
          )}

          <p className="text-xs text-text-secondary">
            Current assigned rider:{' '}
            <strong className="text-text">{reassignDelivery?.rider?.fullName || 'None'}</strong>
          </p>

          <div>
            <label className="text-xs font-semibold text-text">Choose New Delivery Rider</label>
            {isLoadingRiders ? (
              <p className="text-xs text-text-secondary mt-1">Loading available riders...</p>
            ) : availableRiders.length === 0 ? (
              <p className="text-xs text-danger mt-1">No active delivery riders found.</p>
            ) : (
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {availableRiders.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center justify-between p-2.5 rounded-control border cursor-pointer text-xs transition ${
                      selectedRiderId === r.id
                        ? 'border-primary bg-primary/5 font-semibold text-primary'
                        : 'border-border bg-surface hover:bg-surface-muted text-text'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rider"
                        value={r.id}
                        checked={selectedRiderId === r.id}
                        onChange={() => setSelectedRiderId(r.id)}
                        className="text-primary focus:ring-primary"
                      />
                      <span>{r.fullName}</span>
                      <span className="text-[10px] text-text-secondary font-mono">({r.riderId})</span>
                    </div>
                    <span className="text-[10px] text-text-secondary">
                      {r.activeDeliveries === 0 ? '🟢 Free' : `🟡 ${r.activeDeliveries} active`}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <SecondaryButton onClick={() => setReassignDelivery(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              type="submit"
              disabled={!selectedRiderId || isAssigning}
              isLoading={isAssigning}
            >
              Reassign Rider
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
