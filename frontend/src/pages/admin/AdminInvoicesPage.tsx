import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Download,
  Eye,
  MessageCircle,
  Receipt,
  Trash2,
} from 'lucide-react'
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
  approveAdminInvoice,
  assignRiderToOrder,
  bulkDeleteAdminInvoices,
  deleteAdminInvoice,
  fetchAdminInvoices,
  fetchAvailableRiders,
  type AvailableRider,
} from '../../services/admin.service'
import type { Invoice, InvoiceStatus } from '../../types/invoice'
import { getErrorMessage } from '../../utils/apiError'
import { downloadInvoicePdf } from '../../utils/downloadPdf'
import { formatDateTime, formatPaise } from '../../utils/format'

const INVOICE_STATUS_TONE: Record<InvoiceStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SENT: { label: 'Waiting for Customer', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected by Customer', tone: 'danger' },
  REVISED: { label: 'Revised / Withdrawn', tone: 'neutral' },
}

export default function AdminInvoicesPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const showToast = useToast()

  // Modal State for Confirm & Assign Rider
  const [activeInvoiceForDispatch, setActiveInvoiceForDispatch] = useState<Invoice | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH'>('UPI')
  const [availableRiders, setAvailableRiders] = useState<AvailableRider[]>([])
  const [selectedRiderId, setSelectedRiderId] = useState<string>('')
  const [isLoadingRiders, setIsLoadingRiders] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)

  // Selection and Deletion State
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [isDeletingSingle, setIsDeletingSingle] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  const { data, error, isLoading, reload } = useAsyncData(
    () =>
      fetchAdminInvoices({
        page,
        pageSize: 15,
        status: status || undefined,
      }),
    [page, status],
  )

  const invoices = data?.data ?? []
  const meta = data?.meta

  const allCurrentIds = invoices.map((inv) => inv.id)
  const isAllSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedInvoiceIds.includes(id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter((id) => !allCurrentIds.includes(id)))
    } else {
      const combined = Array.from(new Set([...selectedInvoiceIds, ...allCurrentIds]))
      setSelectedInvoiceIds(combined)
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedInvoiceIds.includes(id)) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter((item) => item !== id))
    } else {
      setSelectedInvoiceIds([...selectedInvoiceIds, id])
    }
  }

  async function handleConfirmDeleteSingle() {
    if (!invoiceToDelete) return
    setIsDeletingSingle(true)
    try {
      await deleteAdminInvoice(invoiceToDelete.id)
      showToast(
        `Invoice INV-${invoiceToDelete.orderNumber || ''}-v${invoiceToDelete.version} permanently deleted.`,
        'success',
      )
      setSelectedInvoiceIds(selectedInvoiceIds.filter((id) => id !== invoiceToDelete.id))
      setInvoiceToDelete(null)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete invoice.'), 'error')
    } finally {
      setIsDeletingSingle(false)
    }
  }

  async function handleConfirmBulkDelete() {
    if (selectedInvoiceIds.length === 0) return
    setIsDeletingBulk(true)
    try {
      await bulkDeleteAdminInvoices(selectedInvoiceIds)
      showToast(`${selectedInvoiceIds.length} invoice(s) permanently deleted from database.`, 'success')
      setSelectedInvoiceIds([])
      setIsBulkDeleteModalOpen(false)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete selected invoices.'), 'error')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  function openDispatchModal(inv: Invoice) {
    setActiveInvoiceForDispatch(inv)
    setSelectedRiderId('')
    setDispatchError(null)
    setIsLoadingRiders(true)
    fetchAvailableRiders()
      .then((riders) => {
        setAvailableRiders(riders)
        const freeRider = riders.find((r) => r.activeDeliveries === 0)
        if (freeRider) setSelectedRiderId(freeRider.id)
        else if (riders.length > 0) setSelectedRiderId(riders[0].id)
      })
      .catch((err) => {
        setDispatchError(getErrorMessage(err, 'Failed to load active riders.'))
      })
      .finally(() => {
        setIsLoadingRiders(false)
      })
  }

  async function handleDispatchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeInvoiceForDispatch || !selectedRiderId) return

    setIsDispatching(true)
    setDispatchError(null)

    try {
      // 1. If invoice is SENT (awaiting customer), approve on customer's behalf first (customer said YES on WhatsApp)
      if (activeInvoiceForDispatch.status === 'SENT') {
        await approveAdminInvoice(activeInvoiceForDispatch.id, paymentMethod)
      }

      // 2. Assign the chosen rider to the order
      await assignRiderToOrder(activeInvoiceForDispatch.orderId, selectedRiderId)

      const rider = availableRiders.find((r) => r.id === selectedRiderId)
      showToast(
        `Order confirmed and assigned to ${rider?.fullName || 'rider'}! They can now deliver.`,
        'success',
      )

      setActiveInvoiceForDispatch(null)
      reload()
    } catch (err) {
      setDispatchError(getErrorMessage(err, 'Failed to confirm order and assign rider.'))
    } finally {
      setIsDispatching(false)
    }
  }

  function handleSendWhatsApp(inv: Invoice) {
    const rawPhone = (inv.customerPhone || '').replace(/\D/g, '')
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone
    const pdfUrl = `${window.location.origin}/api/admin/invoices/${inv.id}/pdf`

    const message = `🏥 *CK Medical - Medicine Bill*
Hello *${inv.customerName || 'Customer'}*, your medicine bill has been prepared!

📋 *Bill Summary:*
• Order: #${inv.orderNumber || 'ORDER'} (Bill v${inv.version})
• Total Items: ${inv.lineItems?.length ?? 0}
• Grand Total: ${formatPaise(inv.grandTotalPaise)}

📄 *Download & View PDF Bill:*
${pdfUrl}

👉 *Please reply "YES" to this message to confirm your order so we can assign a delivery rider.*`

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
    showToast(`WhatsApp opened for ${inv.customerName || 'customer'} (${inv.customerPhone || phone})`, 'success')
  }

  return (
    <>
      <PageHeader
        title="Billing & Invoices"
        description="Track all customer bills, version revisions, and generated invoices."
      />

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-border/80 pb-3">
        {[
          { value: '', label: 'All Bills' },
          { value: 'DRAFT', label: 'Drafts' },
          { value: 'SENT', label: 'Awaiting Customer' },
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
        <LoadingState label="Loading invoices..." />
      ) : invoices.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={Receipt}
            title={status ? 'No bills match this filter' : 'No bills generated yet'}
            message="Bills created during order review will appear in this list."
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
                Select All ({invoices.length} on this page)
              </span>
            </label>

            {selectedInvoiceIds.length > 0 && (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-text-secondary">
                  <strong className="text-text">{selectedInvoiceIds.length}</strong> bill(s) selected
                </span>
                <DangerButton
                  icon={Trash2}
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="text-xs py-1.5 px-3"
                >
                  Delete Selected ({selectedInvoiceIds.length})
                </DangerButton>
              </div>
            )}
          </div>

          <div className="divide-y divide-border rounded-control border border-border bg-surface">
            {invoices.map((inv) => {
              const statusDisplay = INVOICE_STATUS_TONE[inv.status] ?? {
                label: inv.status,
                tone: 'neutral',
              }

              const isDelivered = inv.orderStatus === 'DELIVERED'
              const hasRider = Boolean(inv.currentRider)
              const canAssignRider = !isDelivered && (!hasRider || inv.orderStatus === 'CONFIRMED')

              return (
                <div
                  key={inv.id}
                  className={`flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    selectedInvoiceIds.includes(inv.id) ? 'bg-primary-subtle/30' : 'hover:bg-surface-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedInvoiceIds.includes(inv.id)}
                      onChange={() => toggleSelectOne(inv.id)}
                      className="mt-1 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                      title="Select invoice"
                    />

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-heading font-semibold text-text">
                          INV-{inv.orderNumber || 'ORDER'}-v{inv.version}
                        </span>
                        <StatusBadge tone={statusDisplay.tone}>{statusDisplay.label}</StatusBadge>

                        {isDelivered && (
                          <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                            <CheckCircle2 className="size-3" />
                            Delivered (Done)
                          </span>
                        )}
                        {!isDelivered && hasRider && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <Bike className="size-3" />
                            Rider Assigned
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-text flex flex-wrap items-center gap-2">
                        <span>Customer: {inv.customerName || 'Customer'}</span>
                        {inv.customerPhone && (
                          <a
                            href={`tel:${inv.customerPhone}`}
                            className="text-xs text-primary font-mono hover:underline"
                            title="Call Customer"
                          >
                            📱 {inv.customerPhone}
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                        <span>Created {formatDateTime(inv.createdAt)}</span>
                        <span>Items: {inv.lineItems?.length ?? 0}</span>
                        {inv.rejectionReason && (
                          <span className="text-danger font-medium">Rejection note: {inv.rejectionReason}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-3 border-t border-border/40 pt-3 sm:border-0 sm:pt-0">
                    <div>
                      <div className="text-xs text-text-secondary sm:text-right">Grand Total</div>
                      <div className="font-heading font-semibold text-text text-base sm:text-right">
                        {formatPaise(inv.grandTotalPaise)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* WhatsApp Bill Action */}
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(inv)}
                        disabled={!inv.customerPhone}
                        className="inline-flex items-center gap-1.5 rounded-control bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#20ba59] transition disabled:opacity-50"
                        title={
                          inv.customerPhone
                            ? 'Send bill and PDF download link to customer via WhatsApp'
                            : 'Customer phone number not available'
                        }
                      >
                        <MessageCircle className="size-3.5" />
                        WhatsApp Bill
                      </button>

                      {/* Customer Said YES -> Assign Rider Flow */}
                      {inv.status === 'SENT' && (
                        <button
                          type="button"
                          onClick={() => openDispatchModal(inv)}
                          className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-surface hover:bg-primary-dark transition shadow-sm"
                          title="Customer confirmed 'YES' on WhatsApp: Confirm order and assign a delivery rider immediately"
                        >
                          <Bike className="size-3.5" />
                          They Said YES (Assign)
                        </button>
                      )}

                      {/* If Approved and Needs Rider Assignment */}
                      {inv.status === 'APPROVED' && canAssignRider && (
                        <button
                          type="button"
                          onClick={() => openDispatchModal(inv)}
                          className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-surface hover:bg-primary-dark transition shadow-sm"
                          title="Assign an active rider to deliver this confirmed order"
                        >
                          <Bike className="size-3.5" />
                          Assign Rider
                        </button>
                      )}

                      {/* PDF Download */}
                      <button
                        type="button"
                        onClick={() => downloadInvoicePdf(`/admin/invoices/${inv.id}/pdf`, `Invoice-${inv.orderNumber || inv.id}.pdf`)}
                        className="inline-flex items-center gap-1 rounded-control border border-border px-2.5 py-1.5 text-xs font-semibold text-text hover:bg-surface-muted transition cursor-pointer"
                        title="Download Invoice PDF"
                      >
                        <Download className="size-3.5" />
                        <span>PDF</span>
                      </button>

                      {/* Order Detail Link */}
                      <Link
                        to={`/admin/orders/${inv.orderId}`}
                        className="inline-flex items-center gap-1 rounded-control border border-border px-2.5 py-1.5 text-xs font-semibold text-text hover:bg-surface-muted transition"
                        title="View Full Order & Prescriptions"
                      >
                        <Eye className="size-3.5" />
                        Order
                      </Link>

                      {/* Delete Invoice Button */}
                      <button
                        type="button"
                        onClick={() => setInvoiceToDelete(inv)}
                        className="inline-flex items-center gap-1 rounded-control border border-danger/40 bg-danger-subtle/40 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger-subtle/80 transition cursor-pointer"
                        title="Delete this invoice permanently from database"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete</span>
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

      {/* Confirm & Assign Rider Modal */}
      <Modal
        isOpen={Boolean(activeInvoiceForDispatch)}
        onClose={() => setActiveInvoiceForDispatch(null)}
        title={
          activeInvoiceForDispatch?.status === 'SENT'
            ? 'Customer Approved on WhatsApp - Confirm & Assign Rider'
            : 'Assign Delivery Rider'
        }
      >
        {activeInvoiceForDispatch && (
          <form onSubmit={handleDispatchSubmit} className="space-y-4">
            <div className="rounded-control bg-surface-muted p-3 text-xs space-y-1">
              <p>
                <strong>Order:</strong> #{activeInvoiceForDispatch.orderNumber} (Bill v
                {activeInvoiceForDispatch.version})
              </p>
              <p>
                <strong>Customer:</strong> {activeInvoiceForDispatch.customerName} • 📱{' '}
                {activeInvoiceForDispatch.customerPhone || 'Phone on file'}
              </p>
              <p>
                <strong>Amount:</strong> {formatPaise(activeInvoiceForDispatch.grandTotalPaise)}
              </p>
            </div>

            {dispatchError && (
              <div className="rounded-control bg-danger-subtle p-3 text-xs text-danger">
                {dispatchError}
              </div>
            )}

            {/* Payment Method Choice (if confirming bill now) */}
            {activeInvoiceForDispatch.status === 'SENT' && (
              <div>
                <label className="text-xs font-medium text-text mb-1.5 block">
                  Select Agreed Payment Method:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-control border cursor-pointer ${
                      paymentMethod === 'UPI'
                        ? 'border-primary bg-primary/5 font-semibold text-primary'
                        : 'border-border bg-surface text-text'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="UPI"
                      checked={paymentMethod === 'UPI'}
                      onChange={() => setPaymentMethod('UPI')}
                      className="text-primary"
                    />
                    Store UPI QR Code
                  </label>
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-control border cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'border-primary bg-primary/5 font-semibold text-primary'
                        : 'border-border bg-surface text-text'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="CASH"
                      checked={paymentMethod === 'CASH'}
                      onChange={() => setPaymentMethod('CASH')}
                      className="text-primary"
                    />
                    Cash on Delivery
                  </label>
                </div>
              </div>
            )}

            {/* Rider Selection List */}
            <div>
              <label className="text-xs font-medium text-text mb-1.5 block">
                Select Active Delivery Rider:
              </label>

              {isLoadingRiders ? (
                <LoadingState label="Loading available riders..." />
              ) : availableRiders.length === 0 ? (
                <div className="rounded-control border border-border p-4 text-center text-xs text-text-secondary">
                  No active delivery riders found. Please make sure riders are created and marked active in Rider Management.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availableRiders.map((r) => {
                    const isSelected = selectedRiderId === r.id
                    return (
                      <label
                        key={r.id}
                        onClick={() => setSelectedRiderId(r.id)}
                        className={`flex items-center justify-between rounded-control border p-3 cursor-pointer transition ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border/70 bg-surface hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selectedRider"
                            value={r.id}
                            checked={isSelected}
                            onChange={() => setSelectedRiderId(r.id)}
                            className="text-primary"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-semibold text-xs text-text">
                                {r.fullName}
                              </span>
                              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                                {r.riderId || 'Rider'}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary mt-0.5">📱 {r.phone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              r.activeDeliveries === 0
                                ? 'bg-success-subtle text-success'
                                : 'bg-warning-subtle text-warning'
                            }`}
                          >
                            {r.activeDeliveries === 0 ? 'Free (0 active)' : `${r.activeDeliveries} active`}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <SecondaryButton type="button" onClick={() => setActiveInvoiceForDispatch(null)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                type="submit"
                icon={Bike}
                isLoading={isDispatching}
                disabled={!selectedRiderId || isDispatching || availableRiders.length === 0}
              >
                {activeInvoiceForDispatch.status === 'SENT'
                  ? 'Confirm Order & Assign Rider'
                  : 'Assign Rider to Deliver'}
              </PrimaryButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Single Invoice Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(invoiceToDelete)}
        onClose={() => {
          if (!isDeletingSingle) setInvoiceToDelete(null)
        }}
        title={`Delete Invoice INV-${invoiceToDelete?.orderNumber || ''}-v${invoiceToDelete?.version || ''}`}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <SecondaryButton onClick={() => setInvoiceToDelete(null)} disabled={isDeletingSingle}>
              Cancel
            </SecondaryButton>
            <DangerButton onClick={handleConfirmDeleteSingle} isLoading={isDeletingSingle}>
              Delete Permanently
            </DangerButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle/30 p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Permanent Database Deletion</p>
              <p className="mt-0.5 text-text-secondary">
                Are you sure you want to delete invoice{' '}
                <strong className="text-text font-semibold">
                  INV-{invoiceToDelete?.orderNumber || 'ORDER'}-v{invoiceToDelete?.version}
                </strong>
                ?
              </p>
            </div>
          </div>

          <div className="rounded-control bg-surface-muted p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-text-secondary">Customer:</span>
              <span className="font-semibold text-text">{invoiceToDelete?.customerName || 'Customer'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Grand Total:</span>
              <span className="font-semibold text-primary">
                {invoiceToDelete?.grandTotalPaise != null ? formatPaise(invoiceToDelete.grandTotalPaise) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Status:</span>
              <span className="font-semibold text-text">{invoiceToDelete?.status}</span>
            </div>
          </div>

          <p className="text-xs text-text-secondary">
            This invoice will be permanently removed from MongoDB Atlas database. This action cannot be reversed.
          </p>
        </div>
      </Modal>

      {/* Bulk Invoices Delete Confirmation Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (!isDeletingBulk) setIsBulkDeleteModalOpen(false)
        }}
        title={`Delete ${selectedInvoiceIds.length} Selected Invoices`}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <SecondaryButton onClick={() => setIsBulkDeleteModalOpen(false)} disabled={isDeletingBulk}>
              Cancel
            </SecondaryButton>
            <DangerButton onClick={handleConfirmBulkDelete} isLoading={isDeletingBulk}>
              Delete All Selected ({selectedInvoiceIds.length})
            </DangerButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle/30 p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Permanent Bulk Deletion</p>
              <p className="mt-0.5 text-text-secondary">
                You have selected <strong className="text-text font-semibold">{selectedInvoiceIds.length} invoices</strong> to delete from the database.
              </p>
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            These invoices will be permanently deleted from MongoDB Atlas database. Are you sure you want to proceed?
          </p>
        </div>
      </Modal>
    </>
  )
}