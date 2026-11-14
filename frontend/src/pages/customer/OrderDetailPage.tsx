import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  QrCode,
  RotateCw,
  ShieldAlert,
  Truck,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DangerButton, PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { FormAlert } from '../../components/ui/FormAlert'
import { FormTextarea } from '../../components/ui/FormTextarea'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import {
  approveCustomerInvoice,
  cancelCustomerOrder,
  fetchCustomerOrderDetail,
  fetchStoreSettings,
  rejectCustomerInvoice,
} from '../../services/customer.service'
import type { OrderStatus } from '../../types/dashboard'
import type { StoreSettingsData } from '../../types/invoice'
import { getErrorMessage } from '../../utils/apiError'
import { formatDateTime, formatPaise } from '../../utils/format'
import { ORDER_STATUS_DISPLAY } from '../../utils/statusLabels'
import { downloadInvoicePdf } from '../../utils/downloadPdf'

const TIMELINE_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'PENDING_ADMIN_REVIEW', label: 'Request Sent', description: 'Store received your order' },
  { status: 'UNDER_REVIEW', label: 'Under Review', description: 'Checking stock on shelves' },
  { status: 'WAITING_FOR_CUSTOMER_APPROVAL', label: 'Bill Ready', description: 'Review & approve your bill' },
  { status: 'CONFIRMED', label: 'Confirmed', description: 'Packing medicines' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', description: 'Rider is on the way' },
  { status: 'DELIVERED', label: 'Delivered', description: 'Order completed' },
]

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const showToast = useToast()

  const { data: order, error, isLoading, reload } = useAsyncData(
    () => fetchCustomerOrderDetail(id!),
    [id],
  )

  const [storeSettings, setStoreSettings] = useState<StoreSettingsData | null>(null)

  // Cancellation Modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Rejection Modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

  // Approval state
  const [isApproving, setIsApproving] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH'>('UPI')
  const [acceptSubstitutes, setAcceptSubstitutes] = useState(true)

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)

  useEffect(() => {
    fetchStoreSettings()
      .then(setStoreSettings)
      .catch(() => {
        // Fallback silently if settings cannot be loaded
      })
  }, [])

  async function handleCancelSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for cancellation.')
      return
    }

    setIsCancelling(true)
    setCancelError(null)

    try {
      await cancelCustomerOrder(order!.id, cancelReason.trim())
      showToast('Order has been cancelled.', 'success')
      setIsCancelModalOpen(false)
      reload()
    } catch (err) {
      setCancelError(getErrorMessage(err))
    } finally {
      setIsCancelling(false)
    }
  }

  async function handleApproveBill() {
    if (!order?.invoice) return
    setIsApproving(true)
    setApprovalError(null)

    try {
      await approveCustomerInvoice(order.invoice.id, {
        paymentMethod,
        acceptSubstitutes,
      })
      showToast('Bill approved! Your order is now confirmed for delivery.', 'success')
      reload()
    } catch (err) {
      setApprovalError(getErrorMessage(err, 'Failed to approve bill.'))
    } finally {
      setIsApproving(false)
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!order?.invoice) return
    if (!rejectReason.trim()) {
      setRejectError('Please state why you are rejecting this bill.')
      return
    }

    setIsRejecting(true)
    setRejectError(null)

    try {
      await rejectCustomerInvoice(order.invoice.id, rejectReason.trim())
      showToast('Bill rejected. The store has been notified to revise it.', 'success')
      setIsRejectModalOpen(false)
      reload()
    } catch (err) {
      setRejectError(getErrorMessage(err, 'Failed to reject bill.'))
    } finally {
      setIsRejecting(false)
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading order details..." />
  }

  if (error || !order) {
    return (
      <DashboardCard>
        <ErrorState message={error ? getErrorMessage(error) : 'Order not found'} onRetry={reload} />
      </DashboardCard>
    )
  }

  const statusInfo = ORDER_STATUS_DISPLAY[order.status] ?? {
    label: order.status,
    tone: 'neutral',
  }

  const isCancelled = order.status === 'CANCELLED'
  const isFailed = order.status === 'DELIVERY_FAILED'
  const canRespondToInvoice = Boolean(order.allowedActions?.canRespondToInvoice && order.invoice)
  const hasSubstitutes = order.invoice?.lineItems?.some((item: any) => item.isSubstitute)

  return (
    <>
      <div className="mb-4">
        <Link
          to="/customer/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          Back to My Orders
        </Link>
      </div>

      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed on ${formatDateTime(order.createdAt)}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>

            {order.status === 'DELIVERED' && (
              <Link to={`/customer/requests/new?reorder=${order.id}`}>
                <PrimaryButton icon={RotateCw} className="text-xs">
                  Repeat Order
                </PrimaryButton>
              </Link>
            )}

            {order.allowedActions?.canCancel && (
              <SecondaryButton
                onClick={() => {
                  setCancelReason('')
                  setCancelError(null)
                  setIsCancelModalOpen(true)
                }}
              >
                Cancel Order
              </SecondaryButton>
            )}
          </div>
        }
      />

      {/* Action Required Banner when waiting for approval */}
      {order.status === 'WAITING_FOR_CUSTOMER_APPROVAL' && order.invoice && (
        <div className="mb-6 rounded-control border border-warning/40 bg-warning-subtle/50 p-4 text-sm text-text">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h4 className="font-heading font-semibold text-text">Bill Ready - Please Review & Approve</h4>
              <p className="mt-1 text-xs text-text-secondary">
                The pharmacy has prepared your medicine bill. Please review the prices and medicines below, choose your payment method, and approve to confirm dispatch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order Delivered & Received Celebration Banner */}
      {order.status === 'DELIVERED' && (
        <div className="mb-6 rounded-control border border-success/40 bg-success-subtle/60 p-4 text-sm text-text flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-6 text-success shrink-0 mt-0.5" />
            <div>
              <h4 className="font-heading font-bold text-text text-base">
                Order Delivered & Received!
              </h4>
              <p className="mt-0.5 text-xs text-text-secondary">
                Your medicines have been safely delivered. Need regular medicines refilled? Click repeat order below!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/customer/requests/new?reorder=${order.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-control bg-primary px-4 py-2 text-xs font-semibold text-surface transition-colors hover:bg-primary-dark shadow-sm"
            >
              <RotateCw className="size-3.5" />
              Repeat This Order
            </Link>
            <Link
              to="/customer/orders"
              className="inline-flex items-center justify-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      )}

      {/* Cancellation Notice if cancelled */}
      {isCancelled && (
        <div className="mb-6 flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-4 text-sm text-danger">
          <ShieldAlert className="size-5 shrink-0" />
          <div>
            <h4 className="font-semibold">This order was cancelled</h4>
            <p className="mt-1 text-danger/90">
              Reason: {order.cancellation?.reason || 'Cancelled by customer'}
            </p>
          </div>
        </div>
      )}

      {/* Status Progress Timeline */}
      {!isCancelled && !isFailed && (
        <DashboardCard title="Order Progress" description="Live status of your medicine request">
          <div className="relative mt-2">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPassed = order.statusHistory.some((h) => h.status === step.status)
                const isCurrent = order.status === step.status

                return (
                  <div
                    key={step.status}
                    className={`relative flex flex-col rounded-control border p-3.5 text-xs ${
                      isCurrent
                        ? 'border-primary bg-primary-subtle/30 font-medium'
                        : isPassed
                        ? 'border-border bg-surface text-text'
                        : 'border-border/40 bg-surface-muted/30 text-text-secondary/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isPassed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                      ) : (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-border text-[10px] font-bold">
                          {idx + 1}
                        </span>
                      )}
                      <span className={`font-semibold ${isCurrent ? 'text-primary' : ''}`}>
                        {step.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-text-secondary leading-snug">
                      {step.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </DashboardCard>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        {/* Left Column: Bill & Medicines */}
        <div className="space-y-6 lg:col-span-2">
          {/* Bill & Invoice Card (if generated) */}
          {order.invoice && (
            <DashboardCard
              title={`Pharmacy Bill #${order.orderNumber} (v${order.invoice.version})`}
              description={`Prepared by store - Total ${formatPaise(order.invoice.grandTotalPaise)}`}
              action={
                <button
                  type="button"
                  onClick={() => downloadInvoicePdf(`/customers/me/invoices/${order.invoice?.id}/pdf`, `Invoice-${order.orderNumber}.pdf`)}
                  className="inline-flex items-center gap-1 rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-muted transition cursor-pointer"
                >
                  <Download className="size-3.5" />
                  Download PDF
                </button>
              }
            >
              <div className="space-y-4">
                {/* Line Items Table */}
                <div className="overflow-x-auto rounded-control border border-border/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted/60 text-text-secondary border-b border-border/80">
                      <tr>
                        <th className="p-2.5 font-medium">Item Description</th>
                        <th className="p-2.5 text-right font-medium">Qty</th>
                        <th className="p-2.5 text-right font-medium">Unit Price</th>
                        <th className="p-2.5 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {order.invoice.lineItems.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-surface-muted/30">
                          <td className="p-2.5 font-medium text-text">
                            {item.description}
                            {item.isSubstitute && (
                              <span className="ml-2 inline-flex rounded bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                                Substitute
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right text-text">{item.quantity}</td>
                          <td className="p-2.5 text-right text-text">{formatPaise(item.unitPricePaise)}</td>
                          <td className="p-2.5 text-right font-semibold text-text">
                            {formatPaise(item.lineTotalPaise || item.quantity * item.unitPricePaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bill Pricing Totals */}
                <div className="space-y-1.5 border-t border-border/60 pt-3 text-xs sm:ml-auto sm:w-72">
                  <div className="flex justify-between text-text-secondary">
                    <span>Medicines Subtotal</span>
                    <span>{formatPaise(order.invoice.subtotalPaise)}</span>
                  </div>
                  {order.invoice.discountPaise > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>-{formatPaise(order.invoice.discountPaise)}</span>
                    </div>
                  )}
                  {order.invoice.taxPaise > 0 && (
                    <div className="flex justify-between text-text-secondary">
                      <span>GST / Tax</span>
                      <span>+{formatPaise(order.invoice.taxPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-secondary">
                    <span>Delivery Charge</span>
                    <span>
                      {order.invoice.deliveryChargePaise === 0
                        ? 'FREE'
                        : formatPaise(order.invoice.deliveryChargePaise)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/80 pt-2 text-sm font-bold text-text">
                    <span>Grand Total Payable</span>
                    <span className="text-primary">{formatPaise(order.invoice.grandTotalPaise)}</span>
                  </div>
                </div>

                {order.invoice.remarks && (
                  <div className="rounded-control bg-surface-muted p-3 text-xs">
                    <span className="font-semibold text-text">Pharmacist Remarks: </span>
                    <span className="text-text-secondary">{order.invoice.remarks}</span>
                  </div>
                )}

                {/* Customer Approval Section */}
                {canRespondToInvoice && (
                  <div className="mt-6 border-t border-border pt-5 space-y-5">
                    <h4 className="font-heading font-semibold text-sm text-text">Choose Payment & Approve</h4>

                    {approvalError && <FormAlert tone="error">{approvalError}</FormAlert>}

                    {/* Substitute medicines acceptance */}
                    {hasSubstitutes && (
                      <div className="p-3 rounded-control border border-warning/40 bg-warning-subtle/30">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acceptSubstitutes}
                            onChange={(e) => setAcceptSubstitutes(e.target.checked)}
                            className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-xs text-text">
                            I accept the alternative / substitute medicines proposed by the pharmacist.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Payment Method Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-text mb-2">Select Payment Method</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('UPI')}
                          className={`flex items-start gap-3 p-3.5 rounded-control border text-left transition ${
                            paymentMethod === 'UPI'
                              ? 'border-primary bg-primary-subtle/30 shadow-sm ring-1 ring-primary'
                              : 'border-border bg-surface hover:bg-surface-muted'
                          }`}
                        >
                          <QrCode className="size-5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-xs text-text">Pay via Store UPI QR</div>
                            <div className="text-[11px] text-text-secondary mt-0.5">
                              Scan with GPay, PhonePe, Paytm, etc.
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('CASH')}
                          className={`flex items-start gap-3 p-3.5 rounded-control border text-left transition ${
                            paymentMethod === 'CASH'
                              ? 'border-primary bg-primary-subtle/30 shadow-sm ring-1 ring-primary'
                              : 'border-border bg-surface hover:bg-surface-muted'
                          }`}
                        >
                          <Banknote className="size-5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-xs text-text">Cash on Delivery</div>
                            <div className="text-[11px] text-text-secondary mt-0.5">
                              Pay cash to the delivery rider upon arrival.
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Store UPI QR Code Display for Instant Payment */}
                    {paymentMethod === 'UPI' && (
                      <div className="rounded-control border border-border bg-card p-4 sm:p-5 text-center space-y-3">
                        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-text">
                          <QrCode className="size-4 text-primary" />
                          Scan Pharmacy UPI QR Code to Pay
                        </div>

                        {storeSettings?.upiQrUrl ? (
                          <div className="inline-block p-2 bg-white rounded-control border border-border shadow-sm">
                            <img
                              src={storeSettings.upiQrUrl}
                              alt="Pharmacy UPI QR Code"
                              className="size-48 sm:size-52 object-contain mx-auto"
                            />
                          </div>
                        ) : (
                          <div className="size-48 flex flex-col items-center justify-center rounded-control border border-dashed border-border mx-auto p-4 text-text-secondary">
                            <QrCode className="size-10 opacity-40 mb-1" />
                            <span className="text-xs">QR code on file</span>
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="text-xs text-text-secondary">Payable Amount:</div>
                          <div className="text-base font-bold text-primary">
                            {formatPaise(order.invoice.grandTotalPaise)}
                          </div>
                          {storeSettings?.upiId && (
                            <p className="text-xs font-mono text-text bg-background inline-block px-3 py-1 rounded border border-border mt-1">
                              UPI ID: {storeSettings.upiId}
                            </p>
                          )}
                          <p className="text-[11px] text-text-secondary mt-2">
                            You can scan and pay right now or pay when the delivery rider arrives.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions: Approve or Reject */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <DangerButton
                        onClick={() => {
                          setRejectReason('')
                          setRejectError(null)
                          setIsRejectModalOpen(true)
                        }}
                      >
                        <XCircle className="size-4 mr-1.5" />
                        Reject Bill
                      </DangerButton>

                      <PrimaryButton
                        onClick={handleApproveBill}
                        isLoading={isApproving}
                        icon={CheckCircle2}
                      >
                        Approve Bill & Place Order
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </div>
            </DashboardCard>
          )}

          {/* Prescription Photos */}
          {order.photos && order.photos.length > 0 && (
            <DashboardCard
              title={`Prescription Photos (${order.photos.length})`}
              description="Click any image to view full size"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {order.photos.map((photo) => {
                  const imageUrl = `/uploads/${photo.id}`
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setPreviewPhoto(imageUrl)}
                      className="group relative aspect-square overflow-hidden rounded-control border border-border bg-surface-muted transition-all hover:border-primary"
                    >
                      <img
                        src={imageUrl}
                        alt={photo.name || 'Prescription photo'}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="rounded bg-surface/90 px-2 py-1 text-xs font-semibold text-text">
                          Enlarge
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </DashboardCard>
          )}

          {/* Requested Medicines */}
          <DashboardCard
            title={`Requested Medicines (${order.requestedItems.length})`}
            description="Medicines listed in this request"
          >
            {order.requestedItems.length === 0 ? (
              <p className="text-sm italic text-text-secondary">
                No individual medicines typed. Please refer to the attached prescription photo(s).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-text-secondary">
                      <th className="pb-2 font-medium">Medicine Description</th>
                      <th className="pb-2 text-right font-medium">Qty</th>
                      <th className="pb-2 text-right font-medium">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {order.requestedItems.map((item, idx) => (
                      <tr key={idx} className="py-2.5">
                        <td className="py-2.5 font-medium text-text">{item.description}</td>
                        <td className="py-2.5 text-right text-text">{item.quantity}</td>
                        <td className="py-2.5 text-right">
                          {item.isUnavailable ? (
                            <span className="inline-flex rounded bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">
                              Unavailable
                            </span>
                          ) : (
                            <span className="text-xs text-text-secondary">Checking stock</span>
                          )}
                          {item.alternativeNote && (
                            <div className="mt-0.5 text-[11px] text-text-secondary">
                              Alt: {item.alternativeNote}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {order.customerInstructions && (
              <div className="mt-4 rounded-control bg-surface-muted p-3 text-xs">
                <span className="font-semibold text-text">Your Instructions: </span>
                <span className="text-text-secondary">{order.customerInstructions}</span>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Right Column: Address & History */}
        <div className="space-y-6">
          {/* Active Store QR Code for Confirmed UPI orders */}
          {order.status === 'CONFIRMED' && order.payment?.method === 'UPI' && storeSettings?.upiQrUrl && (
            <DashboardCard title="Store UPI QR Code" description="Scan to pay for this order">
              <div className="text-center space-y-2">
                <div className="inline-block p-2 bg-white rounded-control border border-border shadow-sm">
                  <img
                    src={storeSettings.upiQrUrl}
                    alt="Pharmacy UPI QR Code"
                    className="size-44 object-contain mx-auto"
                  />
                </div>
                {storeSettings.upiId && (
                  <p className="text-xs font-mono text-text bg-background px-2 py-1 rounded border border-border">
                    {storeSettings.upiId}
                  </p>
                )}
                <p className="text-xs font-semibold text-primary">
                  Payable: {formatPaise(order.invoice?.grandTotalPaise ?? 0)}
                </p>
              </div>
            </DashboardCard>
          )}

          {/* Delivery Address */}
          <DashboardCard title="Delivery Address" description="Destination for this order">
            <div className="flex items-start gap-3">
              <MapPin className="size-5 shrink-0 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-text">{order.address?.fullAddress}</p>
                <p className="text-text-secondary">
                  {order.address?.area}, {order.address?.city}
                </p>
                <p className="text-text-secondary">
                  {order.address?.state} - {order.address?.pincode}
                </p>
                {order.address?.deliveryInstructions && (
                  <p className="mt-2 text-xs italic text-text-secondary">
                    Instructions: {order.address.deliveryInstructions}
                  </p>
                )}
              </div>
            </div>
          </DashboardCard>

          {/* Assigned Rider (Phase 6 preview) */}
          {order.delivery?.rider && (
            <DashboardCard title="Delivery Rider" description="Assigned delivery partner">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h4 className="font-heading font-semibold text-text">{order.delivery.rider.fullName}</h4>
                  <p className="text-xs text-text-secondary">
                    Vehicle: {order.delivery.rider.riderProfile?.vehicleNumber || 'Assigned'}
                  </p>
                </div>
              </div>
            </DashboardCard>
          )}

          {/* Status Timeline History */}
          <DashboardCard title="Activity History">
            <div className="space-y-3">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <Clock className="size-3.5 shrink-0 text-text-secondary mt-0.5" />
                  <div>
                    <div className="font-medium text-text">
                      {ORDER_STATUS_DISPLAY[h.status]?.label ?? h.status}
                    </div>
                    {h.note && <div className="text-text-secondary">{h.note}</div>}
                    <div className="text-[10px] text-text-secondary/70">{formatDateTime(h.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Reject Bill Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Pharmacy Bill"
        footer={
          <>
            <SecondaryButton onClick={() => setIsRejectModalOpen(false)}>
              Back
            </SecondaryButton>
            <DangerButton onClick={handleRejectSubmit} isLoading={isRejecting}>
              Confirm Rejection
            </DangerButton>
          </>
        }
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          {rejectError && <FormAlert tone="error">{rejectError}</FormAlert>}

          <p className="text-xs text-text-secondary">
            Please let the pharmacist know why you are rejecting this bill. They will receive your feedback and revise the bill for you.
          </p>

          <FormTextarea
            label="Reason for Rejection *"
            placeholder="e.g. Substitute medicine price is too high, please remove item #2, wrong quantity..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
            rows={3}
            maxLength={300}
          />
        </form>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Order"
        footer={
          <>
            <SecondaryButton onClick={() => setIsCancelModalOpen(false)}>
              Keep Order
            </SecondaryButton>
            <DangerButton onClick={handleCancelSubmit} isLoading={isCancelling}>
              Confirm Cancellation
            </DangerButton>
          </>
        }
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4">
          {cancelError && <FormAlert tone="error">{cancelError}</FormAlert>}

          <p className="text-sm text-text-secondary">
            Are you sure you want to cancel order <strong>{order.orderNumber}</strong>? Please let the
            store know why:
          </p>

          <FormTextarea
            label="Reason for Cancellation *"
            placeholder="e.g. Ordered by mistake, bought from local pharmacy, no longer needed"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
            rows={3}
            maxLength={300}
          />
        </form>
      </Modal>

      {/* Full Size Image Preview Modal */}
      <Modal
        isOpen={Boolean(previewPhoto)}
        onClose={() => setPreviewPhoto(null)}
        title="Prescription Preview"
        footer={
          <SecondaryButton onClick={() => setPreviewPhoto(null)}>
            Close
          </SecondaryButton>
        }
      >
        {previewPhoto && (
          <div className="text-center">
            <img
              src={previewPhoto}
              alt="Prescription preview"
              className="max-h-[70vh] w-auto mx-auto rounded-control object-contain"
            />
          </div>
        )}
      </Modal>
    </>
  )
}
