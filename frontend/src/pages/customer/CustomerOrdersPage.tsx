import { ClipboardList, Plus, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PrimaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { controlClasses } from '../../components/ui/Field'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchCustomerOrders } from '../../services/customer.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime, formatPaise } from '../../utils/format'
import { ORDER_STATUS_DISPLAY } from '../../utils/statusLabels'

export default function CustomerOrdersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, error, isLoading, reload } = useAsyncData(
    () =>
      fetchCustomerOrders({
        page,
        pageSize: 10,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      }),
    [page, statusFilter, search],
  )

  const orders = data?.data ?? []
  const meta = data?.meta

  return (
    <>
      <PageHeader
        title="My Orders"
        description="Track the status of your medicine requests and delivery history."
        actions={
          <Link to="/customer/requests/new">
            <PrimaryButton icon={Plus}>
              Request Medicines
            </PrimaryButton>
          </Link>
        }
      />

      {/* Filters Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <input
            placeholder="Search by order number (e.g. CK-...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className={`h-11 ${controlClasses}`}
          />
        </div>

        <div className="w-56">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className={`h-11 ${controlClasses}`}
          >
            <option value="">All Statuses</option>
            <option value="PENDING_ADMIN_REVIEW">Waiting for store</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="WAITING_FOR_CUSTOMER_APPROVAL">Bill needs approval</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading ? (
        <LoadingState label="Loading your orders..." />
      ) : orders.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={ClipboardList}
            title={search || statusFilter ? 'No orders match your filter' : 'No orders placed yet'}
            message={
              search || statusFilter
                ? 'Try clearing the search text or selecting "All Statuses".'
                : 'Send your doctor prescription or list your medicines to place your first order.'
            }
            action={
              !search && !statusFilter ? (
                <Link to="/customer/requests/new">
                  <PrimaryButton icon={Plus}>
                    Request Medicines Now
                  </PrimaryButton>
                </Link>
              ) : undefined
            }
          />
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-border rounded-control border border-border bg-surface">
            {orders.map((order) => {
              const statusInfo = ORDER_STATUS_DISPLAY[order.status] ?? {
                label: order.status,
                tone: 'neutral',
              }

              return (
                <Link
                  key={order.id}
                  to={`/customer/orders/${order.id}`}
                  className="flex flex-col gap-3 p-5 transition-colors hover:bg-surface-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-heading font-semibold text-text">{order.orderNumber}</span>
                      <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>
                    </div>

                    <p className="text-xs text-text-secondary">
                      Placed on {formatDateTime(order.createdAt)}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary pt-1">
                      {order.photoCount > 0 && <span>📸 {order.photoCount} Prescription photo(s)</span>}
                      {order.itemCount > 0 && <span>💊 {order.itemCount} Medicine(s)</span>}
                      {order.riderName && <span>🚴 Rider: {order.riderName}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3 sm:border-0 sm:pt-0 sm:text-right">
                    <div>
                      {order.grandTotalPaise != null ? (
                        <>
                          <div className="text-xs text-text-secondary">Total Bill</div>
                          <div className="font-heading font-semibold text-text">
                            {formatPaise(order.grandTotalPaise)}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-text-secondary italic">Bill pending</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {order.status === 'DELIVERED' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            navigate(`/customer/requests/new?reorder=${order.id}`)
                          }}
                          className="inline-flex items-center gap-1 rounded-control border border-primary/50 bg-primary-subtle/60 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-subtle transition-colors shadow-sm"
                          title="Repeat this medicine order"
                        >
                          <RotateCw className="size-3.5" />
                          Repeat Order
                        </button>
                      )}
                      <span className="inline-flex rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-muted">
                        View Details →
                      </span>
                    </div>
                  </div>
                </Link>
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
    </>
  )
}
