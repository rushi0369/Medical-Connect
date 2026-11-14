import { History, MapPin } from 'lucide-react'
import { useState } from 'react'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchMyDeliveries } from '../../services/rider.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime, formatPaise } from '../../utils/format'

const HISTORY_STATUS_TONE: Record<string, { label: string; tone: StatusTone }> = {
  DELIVERED: { label: 'Delivered', tone: 'success' },
  DELIVERY_FAILED: { label: 'Failed', tone: 'danger' },
  REASSIGNED: { label: 'Reassigned', tone: 'neutral' },
}

export default function RiderDeliveryHistoryPage() {
  const [page, setPage] = useState(1)

  const { data, error, isLoading, reload } = useAsyncData(
    () => fetchMyDeliveries({ scope: 'history', page, pageSize: 15 }),
    [page],
  )

  const deliveries = data?.data ?? []
  const meta = data?.meta

  return (
    <>
      <PageHeader
        title="Delivery History"
        description="Review all your past completed, delivered, and past orders."
      />

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading ? (
        <LoadingState label="Loading delivery history..." />
      ) : deliveries.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={History}
            title="No Past Deliveries"
            message="Deliveries that you complete or finalize will appear here in your activity history."
          />
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-border rounded-control border border-border bg-surface">
            {deliveries.map((del) => {
              const statusDisplay = HISTORY_STATUS_TONE[del.status] ?? {
                label: del.status,
                tone: 'neutral',
              }

              return (
                <div
                  key={del.id}
                  className="flex flex-col gap-3 p-5 transition-colors hover:bg-surface-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-heading font-semibold text-text">
                        Order #{del.orderNumber || 'ORDER'}
                      </span>
                      <StatusBadge tone={statusDisplay.tone}>{statusDisplay.label}</StatusBadge>
                      <span className="text-xs bg-surface-muted px-2 py-0.5 rounded border border-border text-text font-medium">
                        {del.paymentMethod === 'CASH' ? 'Cash on Delivery' : 'Store UPI QR'}
                      </span>
                    </div>

                    {del.customer && (
                      <div className="text-xs text-text-secondary">
                        Customer: <strong className="text-text">{del.customer.fullName}</strong>
                      </div>
                    )}

                    {del.address && (
                      <div className="flex items-start gap-1 text-xs text-text-secondary">
                        <MapPin className="size-3.5 shrink-0 text-text-secondary mt-0.5" />
                        <span>
                          {del.address.area}, {del.address.city} - {del.address.pincode}
                        </span>
                      </div>
                    )}

                    <div className="text-[11px] text-text-secondary/70">
                      Completed: {formatDateTime(del.updatedAt)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3 sm:border-0 sm:pt-0 sm:text-right">
                    <div>
                      <div className="text-xs text-text-secondary">Order Value</div>
                      <div className="font-heading font-semibold text-text">
                        {del.amountPaise != null ? formatPaise(del.amountPaise) : '—'}
                      </div>
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
    </>
  )
}
