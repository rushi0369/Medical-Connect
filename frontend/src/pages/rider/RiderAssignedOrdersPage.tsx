import { ArrowRight, Bike, ExternalLink, MapPin, Phone, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchMyDeliveries } from '../../services/rider.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatPaise } from '../../utils/format'

const RIDER_STATUS_DISPLAY: Record<string, { label: string; tone: StatusTone }> = {
  RIDER_ASSIGNED: { label: 'Assigned (Ready to Start)', tone: 'neutral' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', tone: 'warning' },
  REACHED_CUSTOMER: { label: 'Reached Customer', tone: 'warning' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  DELIVERY_FAILED: { label: 'Failed', tone: 'danger' },
}

export default function RiderAssignedOrdersPage() {
  const { data, error, isLoading, reload } = useAsyncData(
    () => fetchMyDeliveries({ scope: 'active', page: 1, pageSize: 50 }),
    [],
  )

  const deliveries = data?.data ?? []

  return (
    <>
      <PageHeader
        title="Assigned Deliveries"
        description="Active medicine orders waiting for pickup and customer drop-off."
        actions={
          <SecondaryButton icon={RefreshCw} onClick={reload}>
            Refresh
          </SecondaryButton>
        }
      />

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading ? (
        <LoadingState label="Loading your deliveries..." />
      ) : deliveries.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={Bike}
            title="No Active Orders Assigned"
            message="You are all caught up! New delivery tasks assigned to you by the pharmacy will appear right here."
          />
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          {deliveries.map((del) => {
            const statusInfo = RIDER_STATUS_DISPLAY[del.status] ?? {
              label: del.status,
              tone: 'neutral',
            }

            const mapsQuery = del.address
              ? encodeURIComponent(`${del.address.fullAddress}, ${del.address.area}, ${del.address.city} ${del.address.pincode}`)
              : ''

            return (
              <DashboardCard key={del.id} className="border-l-4 border-l-primary">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-base font-bold text-text">
                        Order #{del.orderNumber || 'ORDER'}
                      </span>
                      <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
                        {del.paymentMethod === 'CASH' ? 'Cash on Delivery' : 'Store UPI QR'}
                      </span>
                    </div>

                    {del.customer && (
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-medium text-text">Customer: {del.customer.fullName}</span>
                        <a
                          href={`tel:${del.customer.phone}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                        >
                          <Phone className="size-3.5" />
                          {del.customer.phone}
                        </a>
                      </div>
                    )}

                    {del.address && (
                      <div className="flex items-start gap-1.5 text-xs text-text-secondary">
                        <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-text">{del.address.fullAddress}</p>
                          <p>{del.address.area}, {del.address.city} - {del.address.pincode}</p>
                          {del.address.deliveryInstructions && (
                            <p className="mt-1 italic text-text-secondary">
                              Note: {del.address.deliveryInstructions}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:items-end justify-between gap-3 border-t border-border/60 pt-3 sm:border-0 sm:pt-0">
                    <div className="sm:text-right">
                      <span className="text-xs text-text-secondary">Collect / Total</span>
                      <div className="font-heading text-lg font-bold text-primary">
                        {del.amountPaise != null ? formatPaise(del.amountPaise) : '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {mapsQuery && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-control border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-surface-muted"
                          title="Open navigation in Google Maps"
                        >
                          <ExternalLink className="size-3.5" />
                          Maps
                        </a>
                      )}

                      <Link
                        to={`/rider/deliveries/${del.id}`}
                        className="inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-xs font-semibold text-surface hover:bg-primary-dark shadow-sm"
                      >
                        Delivery Task
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </DashboardCard>
            )
          })}
        </div>
      )}
    </>
  )
}
