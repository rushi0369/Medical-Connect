import { Banknote, CircleAlert, CircleCheck, ClipboardList, Clock, PackageOpen, Truck } from 'lucide-react'
import { Link } from 'react-router'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { StatCard } from '../../components/ui/StatCard'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useAuth } from '../../hooks/useAuth'
import { fetchRiderSummary } from '../../services/dashboard.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatPaise } from '../../utils/format'

export default function RiderDashboardPage() {
  const { user } = useAuth()
  const { data: summary, error, isLoading, reload } = useAsyncData(fetchRiderSummary, [])

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl leading-tight font-bold text-text">Hello, {user?.fullName}</h1>
        <p className="mt-1 text-sm font-medium text-text-secondary">Rider ID: {user?.riderProfile?.riderId}</p>
      </header>

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading || !summary ? (
        <LoadingState label="Loading your deliveries..." />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <StatCard icon={ClipboardList} label="Assigned" value={summary.assignedDeliveries} />
            <StatCard icon={Clock} label="Pending" value={summary.pendingDeliveries} tone="warning" />
            <StatCard icon={Truck} label="Out for delivery" value={summary.outForDelivery} tone="info" />
            <StatCard icon={CircleCheck} label="Completed" value={summary.completedDeliveries} tone="success" />
            <StatCard icon={CircleAlert} label="Failed" value={summary.failedDeliveries} tone="danger" />
            <StatCard
              icon={Banknote}
              label="Cash collected"
              value={formatPaise(summary.cashCollectedPaise)}
              hint={
                summary.cashSettlementPendingPaise > 0
                  ? `${formatPaise(summary.cashSettlementPendingPaise)} to hand in`
                  : undefined
              }
              tone="success"
            />
          </div>

          <DashboardCard title="Your deliveries" className="mt-5">
            {summary.assignedDeliveries > 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary mb-3">
                  <Truck className="size-6" />
                </div>
                <h3 className="font-heading font-bold text-base text-text">
                  You have {summary.assignedDeliveries} assigned {summary.assignedDeliveries === 1 ? 'order' : 'orders'}
                </h3>
                <p className="mt-1 text-xs text-text-secondary max-w-sm">
                  Review customer delivery addresses, view prescriptions, and navigate to delivery locations.
                </p>
                <Link
                  to="/rider/deliveries"
                  className="mt-4 inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-surface hover:bg-primary-dark transition-colors"
                >
                  Open Assigned Orders →
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={PackageOpen}
                title="No deliveries assigned"
                message="New delivery assignments from the store will appear here in real time."
              />
            )}
          </DashboardCard>
        </>
      )}
    </>
  )
}
