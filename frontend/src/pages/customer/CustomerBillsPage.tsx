import { Download, Eye, FileText, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchCustomerInvoices } from '../../services/customer.service'
import type { InvoiceStatus } from '../../types/invoice'
import { getErrorMessage } from '../../utils/apiError'
import { downloadInvoicePdf } from '../../utils/downloadPdf'
import { formatDateTime, formatPaise } from '../../utils/format'

const INVOICE_STATUS_TONE: Record<InvoiceStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Preparing', tone: 'neutral' },
  SENT: { label: 'Action Required: Needs Approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  REVISED: { label: 'Revised by Store', tone: 'neutral' },
}

export default function CustomerBillsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, error, isLoading, reload } = useAsyncData(
    () =>
      fetchCustomerInvoices({
        page,
        pageSize: 15,
        status: status || undefined,
      }),
    [page, status],
  )

  const invoices = data?.data ?? []
  const meta = data?.meta

  return (
    <>
      <PageHeader
        title="My Bills & Invoices"
        description="Review bills sent by the store, view pricing breakdown, approve orders, and download PDF receipts."
      />

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-border/80 pb-3">
        {[
          { value: '', label: 'All Bills' },
          { value: 'SENT', label: 'Needs My Approval' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ].map((tab) => (
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

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading ? (
        <LoadingState label="Loading bills..." />
      ) : invoices.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={Receipt}
            title={status ? 'No bills match this filter' : 'No bills found'}
            message="When the pharmacy prepares a bill for your medicine request, it will appear here for your review and approval."
          />
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-border rounded-control border border-border bg-surface">
            {invoices.map((inv) => {
              const statusDisplay = INVOICE_STATUS_TONE[inv.status] ?? {
                label: inv.status,
                tone: 'neutral',
              }

              return (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 p-5 transition-colors hover:bg-surface-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-heading font-semibold text-text">
                        Bill #{inv.orderNumber || 'ORDER'} (v{inv.version})
                      </span>
                      <StatusBadge tone={statusDisplay.tone}>{statusDisplay.label}</StatusBadge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                      <span>Date: {formatDateTime(inv.createdAt)}</span>
                      <span>Medicines: {inv.lineItems?.length ?? 0}</span>
                      {inv.rejectionReason && (
                        <span className="text-danger font-medium">Rejection reason: {inv.rejectionReason}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3 sm:border-0 sm:pt-0 sm:text-right">
                    <div>
                      <div className="text-xs text-text-secondary">Amount Payable</div>
                      <div className="font-heading text-base font-bold text-text">
                        {formatPaise(inv.grandTotalPaise)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadInvoicePdf(`/customers/me/invoices/${inv.id}/pdf`, `Invoice-${inv.orderNumber || inv.id}.pdf`)}
                        className="inline-flex items-center gap-1 rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-muted transition cursor-pointer"
                        title="Download Invoice PDF"
                      >
                        <Download className="size-3.5" />
                        <span>PDF</span>
                      </button>

                      <Link
                        to={`/customer/orders/${inv.orderId}`}
                        className={`inline-flex items-center gap-1 rounded-control px-3 py-1.5 text-xs font-semibold ${
                          inv.status === 'SENT'
                            ? 'bg-primary text-surface hover:bg-primary-dark shadow-sm'
                            : 'bg-surface-muted text-text hover:bg-border'
                        }`}
                      >
                        {inv.status === 'SENT' ? (
                          <>
                            <FileText className="size-3.5" /> Review & Pay
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" /> View Order
                          </>
                        )}
                      </Link>
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
