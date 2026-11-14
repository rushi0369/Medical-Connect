import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Pencil,
  QrCode,
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
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import {
  bulkDeleteAdminPayments,
  deleteAdminPayment,
  fetchAdminPayments,
  fetchAdminPaymentSummary,
  recordPaymentRefund,
  settleCashPayments,
  settleRiderCash,
  updateAdminPayment,
  type AdminPaymentItem,
  type AdminPaymentSummary,
} from '../../services/admin.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime, formatPaise } from '../../utils/format'

const METHOD_TABS = [
  { value: '', label: 'All Payments' },
  { value: 'UPI', label: 'Store UPI QR' },
  { value: 'CASH', label: 'Cash on Delivery' },
]

const STATUS_TABS = [
  { value: '', label: 'All Status' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CASH_COLLECTED', label: 'Cash Collected' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'UNPAID', label: 'Unpaid' },
]

export default function AdminPaymentsPage() {
  const [page, setPage] = useState(1)
  const [method, setMethod] = useState('')
  const [settlement, setSettlement] = useState('')
  const [status, setStatus] = useState('')
  const showToast = useToast()

  // Settle Rider Cash Modal
  const [settlingRider, setSettlingRider] = useState<{ id: string; name: string; amountPaise: number } | null>(null)
  const [isSettling, setIsSettling] = useState(false)

  // Refund Modal
  const [refundPayment, setRefundPayment] = useState<AdminPaymentItem | null>(null)
  const [refundRef, setRefundRef] = useState('')
  const [isRefunding, setIsRefunding] = useState(false)

  // Selection & Bulk Deletion
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([])
  const [paymentToDelete, setPaymentToDelete] = useState<AdminPaymentItem | null>(null)
  const [isDeletingSingle, setIsDeletingSingle] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  // Edit Payment Modal
  const [paymentToEdit, setPaymentToEdit] = useState<AdminPaymentItem | null>(null)
  const [editForm, setEditForm] = useState({
    status: 'PAID',
    method: 'UPI',
    amountRupees: '',
    paymentReference: '',
    settlementStatus: 'SETTLED',
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const {
    data: paymentsData,
    error: paymentsError,
    isLoading: isLoadingPayments,
    reload: reloadPayments,
  } = useAsyncData(
    () =>
      fetchAdminPayments({
        page,
        pageSize: 15,
        method: method || undefined,
        status: status || undefined,
        settlement: settlement || undefined,
      }),
    [page, method, status, settlement],
  )

  const {
    data: summaryData,
    reload: reloadSummary,
  } = useAsyncData<AdminPaymentSummary>(fetchAdminPaymentSummary, [])

  const payments = paymentsData?.data ?? []
  const meta = paymentsData?.meta

  const allCurrentIds = payments.map((p) => p.id)
  const isAllSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedPaymentIds.includes(id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedPaymentIds(selectedPaymentIds.filter((id) => !allCurrentIds.includes(id)))
    } else {
      setSelectedPaymentIds(Array.from(new Set([...selectedPaymentIds, ...allCurrentIds])))
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedPaymentIds.includes(id)) {
      setSelectedPaymentIds(selectedPaymentIds.filter((item) => item !== id))
    } else {
      setSelectedPaymentIds([...selectedPaymentIds, id])
    }
  }

  function openEditModal(p: AdminPaymentItem) {
    setPaymentToEdit(p)
    setEditForm({
      status: p.status,
      method: p.method,
      amountRupees: (p.amountPaise / 100).toString(),
      paymentReference: p.paymentReference || '',
      settlementStatus: p.settlementStatus || (p.method === 'CASH' ? 'PENDING' : 'NOT_APPLICABLE'),
    })
    setEditError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentToEdit) return

    const parsedRupees = parseFloat(editForm.amountRupees)
    if (isNaN(parsedRupees) || parsedRupees < 0) {
      setEditError('Please enter a valid payment amount.')
      return
    }

    setIsSavingEdit(true)
    setEditError(null)
    try {
      await updateAdminPayment(paymentToEdit.id, {
        status: editForm.status,
        method: editForm.method,
        amountPaise: Math.round(parsedRupees * 100),
        paymentReference: editForm.paymentReference.trim(),
        settlementStatus: editForm.settlementStatus,
      })
      showToast('Payment updated successfully in database.', 'success')
      setPaymentToEdit(null)
      reloadPayments()
      reloadSummary()
    } catch (err) {
      setEditError(getErrorMessage(err, 'Failed to update payment.'))
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleConfirmDeleteSingle() {
    if (!paymentToDelete) return
    setIsDeletingSingle(true)
    try {
      await deleteAdminPayment(paymentToDelete.id)
      showToast('Payment record deleted permanently from database.', 'success')
      setSelectedPaymentIds(selectedPaymentIds.filter((id) => id !== paymentToDelete.id))
      setPaymentToDelete(null)
      reloadPayments()
      reloadSummary()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete payment.'), 'error')
    } finally {
      setIsDeletingSingle(false)
    }
  }

  async function handleConfirmDeleteBulk() {
    if (selectedPaymentIds.length === 0) return
    setIsDeletingBulk(true)
    try {
      await bulkDeleteAdminPayments(selectedPaymentIds)
      showToast(`Deleted ${selectedPaymentIds.length} payment records permanently.`, 'success')
      setSelectedPaymentIds([])
      setIsBulkDeleteModalOpen(false)
      reloadPayments()
      reloadSummary()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete payments.'), 'error')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  async function handleSettleRider() {
    if (!settlingRider) return
    setIsSettling(true)
    try {
      await settleRiderCash(settlingRider.id)
      showToast(`Settled all cash from ${settlingRider.name}!`, 'success')
      setSettlingRider(null)
      reloadPayments()
      reloadSummary()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to settle rider cash.'), 'error')
    } finally {
      setIsSettling(false)
    }
  }

  async function handleSinglePaymentSettle(paymentId: string) {
    try {
      await settleCashPayments([paymentId])
      showToast('Cash marked as settled with pharmacy counter.', 'success')
      reloadPayments()
      reloadSummary()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to settle payment.'), 'error')
    }
  }

  async function handleRefundSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!refundPayment) return
    setIsRefunding(true)
    try {
      await recordPaymentRefund(refundPayment.id, refundRef.trim() || undefined)
      showToast('Refund recorded successfully!', 'success')
      setRefundPayment(null)
      setRefundRef('')
      reloadPayments()
      reloadSummary()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to record refund.'), 'error')
    } finally {
      setIsRefunding(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Payments & Settlements"
        description="Verify Store UPI QR payments, edit payment details, settle cash, and delete records."
      />

      {/* KPI Cards */}
      {summaryData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <DashboardCard>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-control bg-success/15 flex items-center justify-center text-success">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <span className="text-xs text-text-secondary">Cash Settled</span>
                <p className="font-heading font-bold text-lg text-text">
                  {formatPaise(summaryData.cashSettled.amountPaise)}
                </p>
                <span className="text-[10px] text-text-secondary">
                  {summaryData.cashSettled.count} settled collections
                </span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-control bg-warning/15 flex items-center justify-center text-warning">
                <Banknote className="size-5" />
              </div>
              <div>
                <span className="text-xs text-text-secondary">Cash With Riders</span>
                <p className="font-heading font-bold text-lg text-warning">
                  {formatPaise(summaryData.cashPendingSettlement.amountPaise)}
                </p>
                <span className="text-[10px] text-text-secondary">
                  {summaryData.cashPendingSettlement.count} collections awaiting deposit
                </span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-control bg-primary/15 flex items-center justify-center text-primary">
                <QrCode className="size-5" />
              </div>
              <div>
                <span className="text-xs text-text-secondary">UPI Payments</span>
                <p className="font-heading font-bold text-lg text-primary">
                  {formatPaise(summaryData.upiVerified.amountPaise)}
                </p>
                <span className="text-[10px] text-text-secondary">
                  {summaryData.upiVerified.count} verified transactions
                </span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-control bg-info-subtle flex items-center justify-center text-info">
                <CreditCard className="size-5" />
              </div>
              <div>
                <span className="text-xs text-text-secondary">Total Processed</span>
                <p className="font-heading font-bold text-lg text-text">
                  {formatPaise(summaryData.cashSettled.amountPaise + summaryData.upiVerified.amountPaise)}
                </p>
                <span className="text-[10px] text-text-secondary">All payment channels</span>
              </div>
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {METHOD_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setMethod(tab.value)
                setPage(1)
              }}
              className={`rounded-control px-3 py-1.5 text-xs font-semibold transition-colors ${
                method === tab.value
                  ? 'bg-primary text-surface'
                  : 'bg-surface text-text-secondary hover:bg-surface-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="text-border mx-1">|</span>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
              }}
              className={`rounded-control px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                status === tab.value
                  ? 'bg-primary/20 text-primary font-bold border border-primary/40'
                  : 'bg-surface text-text-secondary hover:bg-surface-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setSettlement(settlement === 'PENDING' ? '' : 'PENDING')
              setPage(1)
            }}
            className={`rounded-control px-3 py-1.5 font-semibold transition ${
              settlement === 'PENDING'
                ? 'bg-warning text-surface'
                : 'bg-surface border border-border text-text-secondary hover:text-text'
            }`}
          >
            Pending Settlement Only
          </button>
        </div>
      </div>

      {paymentsError ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(paymentsError)} onRetry={reloadPayments} />
        </DashboardCard>
      ) : isLoadingPayments ? (
        <LoadingState label="Loading payments ledger..." />
      ) : payments.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={CreditCard}
            title="No payments found"
            message="Payments for orders will appear here as soon as customers approve bills or riders collect cash."
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
                Select All ({payments.length} on this page)
              </span>
            </label>

            {selectedPaymentIds.length > 0 && (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-text-secondary">
                  <strong className="text-text">{selectedPaymentIds.length}</strong> payment(s) selected
                </span>
                <DangerButton
                  icon={Trash2}
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="text-xs py-1.5 px-3"
                >
                  Delete Selected ({selectedPaymentIds.length})
                </DangerButton>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-control border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/80 bg-surface-muted/50 text-text-secondary font-semibold">
                <tr>
                  <th className="p-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="p-3.5">Order</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Payment Status</th>
                  <th className="p-3.5">Cash Settlement</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payments.map((p) => {
                  const isUpi = p.method === 'UPI'
                  const isCash = p.method === 'CASH'
                  const isSettled = p.settlementStatus === 'SETTLED'
                  const isPendingSettlement = p.settlementStatus === 'PENDING'
                  const riderName =
                    typeof p.collectedBy === 'object' && p.collectedBy
                      ? p.collectedBy.fullName
                      : p.collectedByName || null

                  return (
                    <tr
                      key={p.id}
                      className={`transition ${
                        selectedPaymentIds.includes(p.id) ? 'bg-primary-subtle/30' : 'hover:bg-surface-muted/30'
                      }`}
                    >
                      <td className="p-3.5">
                        <input
                          type="checkbox"
                          checked={selectedPaymentIds.includes(p.id)}
                          onChange={() => toggleSelectOne(p.id)}
                          className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5">
                        {p.orderId ? (
                          <Link
                            to={`/admin/orders/${p.orderId}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {p.orderNumber || 'Order'}
                          </Link>
                        ) : (
                          <span className="text-text-secondary font-mono">{p.orderNumber || '—'}</span>
                        )}
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          {formatDateTime(p.createdAt)}
                        </p>
                      </td>
                      <td className="p-3.5 font-medium text-text">
                        {p.customerName || 'Customer'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${
                            isUpi
                              ? 'bg-primary/10 text-primary'
                              : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {isUpi ? <QrCode className="size-3" /> : <Banknote className="size-3" />}
                          {isUpi ? 'Store UPI QR' : 'Cash on Delivery'}
                        </span>
                        {riderName && (
                          <p className="text-[10px] text-text-secondary mt-1 flex items-center gap-1 font-medium">
                            <span>🛵</span>
                            <span>
                              Rider: <strong className="text-text font-semibold">{riderName}</strong>
                            </span>
                          </p>
                        )}
                      </td>
                      <td className="p-3.5 font-heading font-bold text-sm text-text">
                        {formatPaise(p.amountPaise)}
                      </td>
                      <td className="p-3.5">
                        <StatusBadge
                          tone={
                            ['PAID', 'SETTLED'].includes(p.status)
                              ? 'success'
                              : p.status === 'CASH_COLLECTED'
                              ? 'warning'
                              : p.status === 'REFUNDED'
                              ? 'neutral'
                              : 'neutral'
                          }
                        >
                          {p.status.replace(/_/g, ' ')}
                        </StatusBadge>
                        {p.paymentReference && (
                          <p className="text-[10px] font-mono text-text-secondary mt-0.5">
                            Ref: {p.paymentReference}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5">
                        {isCash ? (
                          isSettled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                              <CheckCircle2 className="size-3" />
                              Settled with Pharmacy
                            </span>
                          ) : isPendingSettlement ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                              <Clock className="size-3" />
                              Held by Rider
                            </span>
                          ) : (
                            <span className="text-text-secondary text-[11px]">Awaiting Collection</span>
                          )
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-success font-semibold text-[11px] inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3" />
                              Direct Store UPI
                            </span>
                            {riderName && (
                              <p className="text-[10px] text-text-secondary">
                                Doorstep verified by {riderName}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCash && isPendingSettlement && (
                            <button
                              type="button"
                              onClick={() => handleSinglePaymentSettle(p.id)}
                              className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/25 transition"
                            >
                              <CheckCircle2 className="size-3" />
                              Settle
                            </button>
                          )}
                          {p.status === 'REFUND_PENDING' && (
                            <button
                              type="button"
                              onClick={() => setRefundPayment(p)}
                              className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-1 text-[11px] font-semibold text-danger hover:bg-danger/25 transition"
                            >
                              Refund
                            </button>
                          )}

                          {/* Edit Payment Button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-text hover:bg-surface-muted transition"
                            title="Edit Payment Record"
                          >
                            <Pencil className="size-3" />
                            <span>Edit</span>
                          </button>

                          {/* Delete Payment Button */}
                          <button
                            type="button"
                            onClick={() => setPaymentToDelete(p)}
                            className="inline-flex items-center gap-1 rounded border border-danger/30 bg-danger-subtle/30 px-2 py-1 text-[11px] font-medium text-danger hover:bg-danger-subtle/80 transition"
                            title="Delete Payment Record Permanently"
                          >
                            <Trash2 className="size-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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

      {/* Edit Payment Modal */}
      <Modal
        isOpen={Boolean(paymentToEdit)}
        onClose={() => setPaymentToEdit(null)}
        title={`Edit Payment (${paymentToEdit?.orderNumber || 'Order'})`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-control bg-danger-subtle border border-danger/30 text-xs text-danger font-medium">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text">Payment Method</label>
              <select
                value={editForm.method}
                onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-text"
              >
                <option value="UPI">Store UPI QR</option>
                <option value="CASH">Cash on Delivery</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-text">Payment Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-text"
              >
                <option value="PAID">Paid</option>
                <option value="CASH_COLLECTED">Cash Collected</option>
                <option value="SETTLED">Settled</option>
                <option value="UNPAID">Unpaid</option>
                <option value="REFUND_PENDING">Refund Pending</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text">Amount (₹ Rupees)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.amountRupees}
                onChange={(e) => setEditForm({ ...editForm, amountRupees: e.target.value })}
                className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-text"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text">Cash Settlement Status</label>
              <select
                value={editForm.settlementStatus}
                onChange={(e) => setEditForm({ ...editForm, settlementStatus: e.target.value })}
                className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-text"
              >
                <option value="SETTLED">Settled with Counter</option>
                <option value="PENDING">Pending (Held by Rider)</option>
                <option value="NOT_APPLICABLE">Not Applicable (UPI)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text">Payment Reference / UTR Number</label>
            <input
              type="text"
              value={editForm.paymentReference}
              onChange={(e) => setEditForm({ ...editForm, paymentReference: e.target.value })}
              placeholder="e.g. UPI-MC-123456 or Bank UTR"
              className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-text"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <SecondaryButton onClick={() => setPaymentToEdit(null)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" isLoading={isSavingEdit}>
              Save Changes to DB
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* Single Payment Delete Modal */}
      <Modal
        isOpen={Boolean(paymentToDelete)}
        onClose={() => setPaymentToDelete(null)}
        title="Delete Payment Record"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control bg-danger-subtle p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Permanently delete this payment record from the database?</p>
              <p className="mt-1">
                Amount: <strong>{paymentToDelete ? formatPaise(paymentToDelete.amountPaise) : ''}</strong> | Order:{' '}
                <strong>#{paymentToDelete?.orderNumber || 'ORDER'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <SecondaryButton onClick={() => setPaymentToDelete(null)}>Cancel</SecondaryButton>
            <DangerButton onClick={handleConfirmDeleteSingle} isLoading={isDeletingSingle}>
              Delete Permanently
            </DangerButton>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Payments Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="Delete Selected Payments"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-control bg-danger-subtle p-3 text-xs text-danger">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Are you sure you want to delete {selectedPaymentIds.length} payment records permanently?
              </p>
              <p className="mt-1">This operation deletes the records from MongoDB Atlas and cannot be undone.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <SecondaryButton onClick={() => setIsBulkDeleteModalOpen(false)}>Cancel</SecondaryButton>
            <DangerButton onClick={handleConfirmDeleteBulk} isLoading={isDeletingBulk}>
              Yes, Delete {selectedPaymentIds.length} Payments
            </DangerButton>
          </div>
        </div>
      </Modal>

      {/* Settle Rider Cash Modal */}
      <Modal
        isOpen={Boolean(settlingRider)}
        onClose={() => setSettlingRider(null)}
        title="Confirm Rider Cash Deposit"
      >
        {settlingRider && (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Confirm that delivery rider <strong className="text-text">{settlingRider.name}</strong> has deposited all collected cash at the pharmacy counter:
            </p>

            <div className="p-4 rounded-control border border-border bg-surface text-center">
              <span className="text-xs text-text-secondary">Total Cash to Receive:</span>
              <p className="font-heading text-2xl font-bold text-primary mt-1">
                {formatPaise(settlingRider.amountPaise)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <SecondaryButton onClick={() => setSettlingRider(null)}>Cancel</SecondaryButton>
              <PrimaryButton
                onClick={handleSettleRider}
                isLoading={isSettling}
                icon={CheckCircle2}
              >
                Confirm Cash Received & Settle
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Refund Modal */}
      <Modal
        isOpen={Boolean(refundPayment)}
        onClose={() => setRefundPayment(null)}
        title="Record Refund to Customer"
      >
        <form onSubmit={handleRefundSubmit} className="space-y-4">
          <p className="text-xs text-text-secondary">
            Enter the reference number or note for the manual refund processed for order{' '}
            <strong>{refundPayment?.orderNumber}</strong>.
          </p>

          <div>
            <label className="text-xs font-medium text-text">Refund Reference / UTR Number</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref 3829104829"
              value={refundRef}
              onChange={(e) => setRefundRef(e.target.value)}
              className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-xs text-text"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <SecondaryButton onClick={() => setRefundPayment(null)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" isLoading={isRefunding}>
              Save Refund Record
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
