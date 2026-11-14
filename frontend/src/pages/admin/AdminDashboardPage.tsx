import {
  Bike,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  CreditCard,
  FilePenLine,
  Inbox,
  IndianRupee,
  Receipt,
  Truck,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { primaryButtonClasses } from '../../components/ui/buttonStyles'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchAdminSummary } from '../../services/dashboard.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatPaise } from '../../utils/format'

function StatGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-text">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}

export default function AdminDashboardPage() {
  const { data: summary, error, isLoading, reload } = useAsyncData(fetchAdminSummary, [])

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live figures from your store's database."
        actions={
          <Link to="/admin/riders" className={primaryButtonClasses}>
            <Bike className="size-4" aria-hidden="true" />
            Manage riders
          </Link>
        }
      />

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading || !summary ? (
        <LoadingState label="Loading dashboard..." />
      ) : (
        <div className="space-y-6">
          <StatGroup title="Customers and orders">
            <StatCard icon={Users} label="Total customers" value={summary.totalCustomers} />
            <StatCard icon={ClipboardList} label="Total orders" value={summary.totalOrders} />
            <StatCard icon={Inbox} label="New requests" value={summary.newRequests} tone="info" />
            <StatCard icon={FilePenLine} label="Under review" value={summary.underReview} tone="info" />
            <StatCard icon={Receipt} label="Bills awaiting approval" value={summary.awaitingApproval} tone="warning" />
          </StatGroup>

          <StatGroup title="Riders and deliveries">
            <StatCard
              icon={Bike}
              label="Active riders"
              value={summary.activeRiders}
              hint={summary.inactiveRiders > 0 ? `${summary.inactiveRiders} inactive` : undefined}
            />
            <StatCard icon={Truck} label="Assigned deliveries" value={summary.assignedDeliveries} tone="info" />
            <StatCard icon={CircleCheck} label="Delivered orders" value={summary.deliveredOrders} tone="success" />
            <StatCard icon={CircleAlert} label="Failed deliveries" value={summary.failedDeliveries} tone="danger" />
          </StatGroup>

          <StatGroup title="Payments">
            <StatCard
              icon={IndianRupee}
              label="Today's revenue"
              value={formatPaise(summary.todayRevenuePaise)}
              tone="success"
            />
            <StatCard icon={CreditCard} label="Pending payments" value={summary.pendingPayments} tone="warning" />
          </StatGroup>
        </div>
      )}
    </>
  )
}
