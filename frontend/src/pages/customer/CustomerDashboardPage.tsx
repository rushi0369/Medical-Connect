import { CircleCheck, ClipboardList, Clock, PackageOpen, Pill, Receipt } from 'lucide-react'
import { Link } from 'react-router'
import { NotificationPanel } from '../../components/common/NotificationPanel'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { fetchCustomerSummary } from '../../services/dashboard.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime } from '../../utils/format'
import { ORDER_STATUS_DISPLAY } from '../../utils/statusLabels'

export default function CustomerDashboardPage() {
  const { user } = useAuth()
  const { data: summary, error, isLoading, reload } = useAsyncData(fetchCustomerSummary, [])
  const notifications = useNotifications({ pageSize: 5 })

  return (
    <>
      <PageHeader title={`Hello, ${user?.fullName}`} description="Here is what is happening with your orders." />

      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card bg-primary-dark p-5 text-surface sm:p-6">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface/12 text-primary-light">
            <Pill className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Request medicines</h2>
            <p className="mt-0.5 text-sm text-surface-muted">
              Send a photo or type what you need. The store checks availability and prepares your bill.
            </p>
          </div>
        </div>
        <Link
          to="/customer/requests/new"
          className="rounded-control bg-primary-light px-4 py-2 text-sm font-semibold text-primary-dark transition-colors hover:bg-surface"
        >
          Request Medicines →
        </Link>
      </section>

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading || !summary ? (
        <LoadingState label="Loading your dashboard..." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={ClipboardList} label="Total orders" value={summary.totalOrders} />
            <StatCard icon={Clock} label="Active orders" value={summary.activeOrders} tone="info" />
            <StatCard icon={Receipt} label="Bills to approve" value={summary.pendingApprovals} tone="warning" />
            <StatCard icon={CircleCheck} label="Completed deliveries" value={summary.completedDeliveries} tone="success" />
          </div>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
            <DashboardCard title="Recent order activity">
              {summary.recentOrders.length === 0 ? (
                <EmptyState
                  icon={PackageOpen}
                  title="No orders yet"
                  message="Your medicine requests and their progress will appear here."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {summary.recentOrders.map((order) => {
                    const status = ORDER_STATUS_DISPLAY[order.status]
                    return (
                      <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text">{order.orderNumber}</p>
                          <p className="text-xs text-text-secondary">{formatDateTime(order.createdAt)}</p>
                        </div>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </DashboardCard>

            <DashboardCard title="Notifications">
              <NotificationPanel {...notifications} />
            </DashboardCard>
          </div>
        </>
      )}
    </>
  )
}
