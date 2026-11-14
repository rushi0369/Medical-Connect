import {
  Banknote,
  CheckCircle2,
  Package,
  QrCode,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchAdminReports, type AdminReportData } from '../../services/admin.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime, formatPaise } from '../../utils/format'

const RANGE_OPTIONS = [
  { label: 'Last 7 Days', days: 7, groupBy: 'day' },
  { label: 'Last 30 Days', days: 30, groupBy: 'day' },
  { label: 'Last 90 Days', days: 90, groupBy: 'week' },
]

export default function AdminReportsPage() {
  const [selectedRange, setSelectedRange] = useState(RANGE_OPTIONS[1])

  const { data: report, error, isLoading, reload } = useAsyncData<AdminReportData>(() => {
    const to = new Date()
    const from = new Date(Date.now() - selectedRange.days * 24 * 60 * 60 * 1000)
    return fetchAdminReports({
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy: selectedRange.groupBy,
    })
  }, [selectedRange])

  const successRate =
    report && report.totals.orders > 0
      ? Math.round((report.totals.delivered / report.totals.orders) * 100)
      : 100

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <PageHeader
          title="Reports & Analytics"
          description="Fulfillment metrics, revenue breakdown, rider efficiency, and customer trends."
        />

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 rounded-control border border-border bg-surface p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setSelectedRange(opt)}
              className={`rounded-control px-3 py-1.5 text-xs font-semibold transition ${
                selectedRange.days === opt.days
                  ? 'bg-primary text-surface'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading || !report ? (
        <LoadingState label="Computing analytics report..." />
      ) : (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-control bg-primary/15 flex items-center justify-center text-primary">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <span className="text-xs text-text-secondary">Total Revenue</span>
                  <p className="font-heading font-bold text-lg text-primary">
                    {formatPaise(report.totals.revenuePaise)}
                  </p>
                  <span className="text-[10px] text-text-secondary">Across fulfilled orders</span>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-control bg-info-subtle flex items-center justify-center text-info">
                  <Package className="size-5" />
                </div>
                <div>
                  <span className="text-xs text-text-secondary">Total Orders</span>
                  <p className="font-heading font-bold text-lg text-text">
                    {report.totals.orders}
                  </p>
                  <span className="text-[10px] text-text-secondary">
                    {report.totals.delivered} delivered • {report.totals.cancelled} cancelled
                  </span>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-control bg-success/15 flex items-center justify-center text-success">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <span className="text-xs text-text-secondary">Delivery Success Rate</span>
                  <p className="font-heading font-bold text-lg text-success">{successRate}%</p>
                  <span className="text-[10px] text-text-secondary">
                    {report.totals.delivered} successful drop-offs
                  </span>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-control bg-danger/15 flex items-center justify-center text-danger">
                  <XCircle className="size-5" />
                </div>
                <div>
                  <span className="text-xs text-text-secondary">Failed / Issues</span>
                  <p className="font-heading font-bold text-lg text-danger">
                    {report.totals.failed}
                  </p>
                  <span className="text-[10px] text-text-secondary">
                    Drop-offs reported with issue
                  </span>
                </div>
              </div>
            </DashboardCard>
          </div>

          {/* Payment Method Channels */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DashboardCard
              title="Payment Methods Breakdown"
              description="Store UPI QR vs Cash on Delivery collection"
            >
              <div className="space-y-4 pt-2">
                {report.paymentMethods.length === 0 ? (
                  <p className="text-xs text-text-secondary italic">
                    No payment collections recorded in this date range.
                  </p>
                ) : (
                  report.paymentMethods.map((pm) => {
                    const isUpi = pm.method === 'UPI'
                    const share =
                      report.totals.revenuePaise > 0
                        ? Math.round((pm.amountPaise / report.totals.revenuePaise) * 100)
                        : 0

                    return (
                      <div
                        key={pm.method}
                        className="rounded-control border border-border bg-surface p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`size-8 rounded-control flex items-center justify-center ${
                                isUpi
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-warning/10 text-warning'
                              }`}
                            >
                              {isUpi ? <QrCode className="size-4" /> : <Banknote className="size-4" />}
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-text">
                                {isUpi ? 'Store UPI QR Code' : 'Cash on Delivery'}
                              </p>
                              <p className="text-[11px] text-text-secondary">
                                {pm.payments} transaction(s)
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-heading font-bold text-sm text-text">
                              {formatPaise(pm.amountPaise)}
                            </p>
                            <span className="text-[10px] text-text-secondary">{share}% of revenue</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className={`h-full rounded-full ${isUpi ? 'bg-primary' : 'bg-warning'}`}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </DashboardCard>

            {/* Rider Performance Table */}
            <DashboardCard
              title="Delivery Rider Efficiency"
              description="Assigned orders, completion rates, and collected cash"
            >
              <div className="space-y-3 pt-2">
                {report.riders.length === 0 ? (
                  <p className="text-xs text-text-secondary italic">
                    No rider deliveries recorded in this date range.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-control border border-border bg-surface">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/80 bg-surface-muted/50 text-text-secondary font-semibold">
                        <tr>
                          <th className="p-3">Rider</th>
                          <th className="p-3">Assigned</th>
                          <th className="p-3">Delivered</th>
                          <th className="p-3">Cash Handled</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {report.riders.map((r) => (
                          <tr key={r.riderId} className="hover:bg-surface-muted/30">
                            <td className="p-3">
                              <span className="font-semibold text-text">{r.riderName}</span>
                              {r.riderCode && (
                                <p className="text-[10px] text-text-secondary font-mono">
                                  {r.riderCode}
                                </p>
                              )}
                            </td>
                            <td className="p-3">{r.assigned}</td>
                            <td className="p-3">
                              <span className="font-semibold text-success">{r.delivered}</span>
                              {r.failed > 0 && (
                                <span className="text-danger text-[10px] ml-1">
                                  ({r.failed} failed)
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-semibold text-text">
                              {formatPaise(r.cashCollectedPaise)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DashboardCard>
          </div>

          {/* Top Customers */}
          <DashboardCard
            title="Active Customers"
            description="Patients and customers ordering prescriptions regularly"
          >
            <div className="space-y-3 pt-2">
              {report.customers.length === 0 ? (
                <p className="text-xs text-text-secondary italic">
                  No customer orders recorded in this date range.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-control border border-border bg-surface">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/80 bg-surface-muted/50 text-text-secondary font-semibold">
                      <tr>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Total Orders</th>
                        <th className="p-3">Delivered</th>
                        <th className="p-3">Last Order Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {report.customers.map((c) => (
                        <tr key={c.customerId} className="hover:bg-surface-muted/30">
                          <td className="p-3 font-semibold text-text">{c.customerName}</td>
                          <td className="p-3 text-text-secondary">{c.phone || '—'}</td>
                          <td className="p-3 font-medium text-text">{c.orders}</td>
                          <td className="p-3 text-success font-semibold">{c.delivered}</td>
                          <td className="p-3 text-text-secondary">
                            {c.lastOrderAt ? formatDateTime(c.lastOrderAt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>
      )}
    </>
  )
}
