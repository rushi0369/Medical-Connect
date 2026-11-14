import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  MapPin,
  Navigation,
  Package,
  Phone,
  QrCode,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DangerButton, PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { FormAlert } from '../../components/ui/FormAlert'
import { FormSelect } from '../../components/ui/FormSelect'
import { FormTextarea } from '../../components/ui/FormTextarea'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import { fetchStoreSettings } from '../../services/admin.service'
import {
  confirmRiderOnlinePayment,
  fetchRiderDeliveryDetail,
  recordRiderCashCollection,
  updateRiderDeliveryAction,
  type DeliveryFailureReason,
} from '../../services/rider.service'
import type { StoreSettingsData } from '../../types/invoice'
import { getErrorMessage } from '../../utils/apiError'
import { formatPaise } from '../../utils/format'

const FAILURE_REASONS = [
  { value: 'CUSTOMER_UNAVAILABLE', label: 'Customer is unavailable / not home' },
  { value: 'INCORRECT_ADDRESS', label: 'Incorrect or unreachable address' },
  { value: 'CUSTOMER_REFUSED', label: 'Customer refused delivery' },
  { value: 'UNABLE_TO_CONTACT', label: 'Unable to reach customer phone' },
  { value: 'OTHER', label: 'Other reason' },
]

export default function RiderDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const showToast = useToast()

  const { data: detail, error, isLoading, reload } = useAsyncData(
    () => fetchRiderDeliveryDetail(id!),
    [id],
  )

  const [storeSettings, setStoreSettings] = useState<StoreSettingsData | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Cash collection modal
  const [isCashModalOpen, setIsCashModalOpen] = useState(false)
  const [isCollectingCash, setIsCollectingCash] = useState(false)
  const [cashError, setCashError] = useState<string | null>(null)
  const [isConfirmingOnline, setIsConfirmingOnline] = useState(false)

  // Fail delivery modal
  const [isFailModalOpen, setIsFailModalOpen] = useState(false)
  const [failReason, setFailReason] = useState<DeliveryFailureReason>('CUSTOMER_UNAVAILABLE')
  const [failNotes, setFailNotes] = useState('')
  const [isFailing, setIsFailing] = useState(false)
  const [failError, setFailError] = useState<string | null>(null)

  useEffect(() => {
    fetchStoreSettings()
      .then(setStoreSettings)
      .catch(() => {})
  }, [])

  if (isLoading && !detail) {
    return <LoadingState label="Loading delivery task..." />
  }

  if (error || !detail) {
    return (
      <DashboardCard>
        <ErrorState message={error ? getErrorMessage(error) : 'Delivery not found'} onRetry={reload} />
      </DashboardCard>
    )
  }

  const { delivery, order, customer, items, grandTotalPaise, payment, allowedActions } = detail
  const isCash = payment?.method === 'CASH'
  const isPaid = ['PAID', 'CASH_COLLECTED', 'SETTLED'].includes(payment?.status ?? '')

  async function handleStatusAction(action: 'start' | 'reach' | 'deliver') {
    setIsUpdatingStatus(true)
    try {
      await updateRiderDeliveryAction(delivery.id, { action })
      const labels = {
        start: 'Order marked Out for Delivery!',
        reach: 'Reached customer location recorded!',
        deliver: 'Order delivered successfully! Great job.',
      }
      showToast(labels[action], 'success')
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  async function handleCashCollectionSubmit() {
    if (!grandTotalPaise) return
    setIsCollectingCash(true)
    setCashError(null)
    try {
      await recordRiderCashCollection(delivery.id, grandTotalPaise)
      showToast(`Collected ${formatPaise(grandTotalPaise)} in cash successfully!`, 'success')
      setIsCashModalOpen(false)
      reload()
    } catch (err) {
      setCashError(getErrorMessage(err, 'Failed to record cash.'))
    } finally {
      setIsCollectingCash(false)
    }
  }

  async function handleConfirmOnlinePayment() {
    setIsConfirmingOnline(true)
    try {
      await confirmRiderOnlinePayment(delivery.id)
      showToast(
        `Online UPI payment of ${grandTotalPaise != null ? formatPaise(grandTotalPaise) : ''} confirmed by you!`,
        'success',
      )
      reload()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to confirm online payment.'), 'error')
    } finally {
      setIsConfirmingOnline(false)
    }
  }

  async function handleFailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsFailing(true)
    setFailError(null)
    try {
      await updateRiderDeliveryAction(delivery.id, {
        action: 'fail',
        reason: failReason,
        notes: failNotes.trim() || undefined,
      })
      showToast('Delivery marked as failed. Store has been notified.', 'success')
      setIsFailModalOpen(false)
      navigate('/rider/deliveries')
    } catch (err) {
      setFailError(getErrorMessage(err, 'Failed to report issue.'))
    } finally {
      setIsFailing(false)
    }
  }

  const mapsQuery = order.address
    ? encodeURIComponent(`${order.address.fullAddress}, ${order.address.area}, ${order.address.city} ${order.address.pincode}`)
    : ''

  return (
    <>
      <div className="mb-4">
        <Link
          to="/rider/deliveries"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          Back to Assigned Deliveries
        </Link>
      </div>

      <PageHeader
        title={`Delivery: Order #${order.orderNumber}`}
        description={`Status: ${delivery.status.replace(/_/g, ' ')}`}
        actions={
          <div className="flex items-center gap-2">
            {allowedActions.canFail && (
              <SecondaryButton
                icon={AlertTriangle}
                onClick={() => {
                  setFailError(null)
                  setIsFailModalOpen(true)
                }}
              >
                Report Issue
              </SecondaryButton>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Customer & Location */}
        <div className="space-y-6 lg:col-span-2">
          {/* Customer & Address Card */}
          <DashboardCard title="Customer & Delivery Destination">
            <div className="space-y-4 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-control bg-surface-muted/50 border border-border">
                <div>
                  <h4 className="font-heading font-semibold text-text">{customer.fullName}</h4>
                  <p className="text-xs text-text-secondary mt-0.5">Customer Contact</p>
                </div>
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2 text-xs font-semibold text-surface hover:bg-primary-dark transition"
                >
                  <Phone className="size-4" />
                  Call {customer.phone}
                </a>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-control border border-border bg-card">
                <MapPin className="size-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-bold text-text text-sm">{order.address.fullAddress}</p>
                  <p className="text-text-secondary mt-0.5">
                    {order.address.area}, {order.address.city} - {order.address.pincode}
                  </p>
                  {order.address.deliveryInstructions && (
                    <div className="mt-2 p-2 rounded bg-surface-muted border border-border/80 italic text-text-secondary">
                      Delivery instructions: {order.address.deliveryInstructions}
                    </div>
                  )}

                  {mapsQuery && (
                    <div className="mt-3">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-control border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
                      >
                        <Navigation className="size-3.5" />
                        Navigate with Google Maps
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DashboardCard>

          {/* Medicines Checklist */}
          <DashboardCard
            title={`Medicines to Deliver (${items.length} items)`}
            description="Verify packed medicines against this checklist before handing over"
          >
            <div className="divide-y divide-border/60 rounded-control border border-border/80 overflow-hidden mt-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 text-xs bg-card hover:bg-surface-muted/30">
                  <div className="flex items-center gap-2.5">
                    <Package className="size-4 text-primary shrink-0" />
                    <span className="font-medium text-text">{item.description}</span>
                  </div>
                  <span className="font-bold text-text bg-surface-muted px-2.5 py-1 rounded border border-border">
                    Qty: {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Right Column: Payment & Status Actions */}
        <div className="space-y-6">
          {/* Payment Card & Store UPI QR Code */}
          <DashboardCard
            title="Payment Details"
            description={isCash ? 'Cash on Delivery' : 'Store UPI QR Payment'}
          >
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span className="text-xs text-text-secondary">Amount Payable:</span>
                <span className="font-heading text-lg font-bold text-primary">
                  {grandTotalPaise != null ? formatPaise(grandTotalPaise) : '—'}
                </span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Payment Status:</span>
                {isPaid ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success/15 px-2.5 py-1 rounded">
                    <ShieldCheck className="size-3.5" />
                    Paid / Collected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning bg-warning/15 px-2.5 py-1 rounded">
                    Unpaid
                  </span>
                )}
              </div>

              {/* CASH ON DELIVERY FLOW */}
              {isCash && (
                <div className="rounded-control border border-border bg-card p-4 text-center space-y-3">
                  <Banknote className="size-8 text-primary mx-auto" />
                  <div>
                    <h5 className="font-bold text-xs text-text">Collect Cash from Customer</h5>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Collect exactly {grandTotalPaise != null ? formatPaise(grandTotalPaise) : 'amount'} in cash before handing medicines over.
                    </p>
                  </div>

                  {allowedActions.canCollectCash && (
                    <PrimaryButton
                      onClick={() => setIsCashModalOpen(true)}
                      className="w-full text-xs"
                      icon={Banknote}
                    >
                      Record Cash Received
                    </PrimaryButton>
                  )}
                </div>
              )}

              {/* STORE UPI QR CODE SCANNER FLOW (User Requirement: QR shown on Rider screen) */}
              {!isCash && (
                <div className="rounded-control border border-border bg-card p-4 text-center space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-text">
                    <QrCode className="size-4 text-primary" />
                    Show Store UPI QR to Customer
                  </div>

                  {storeSettings?.upiQrUrl ? (
                    <div className="inline-block p-2 bg-white rounded-control border border-border shadow-sm">
                      <img
                        src={storeSettings.upiQrUrl}
                        alt="Store UPI QR Code"
                        className="size-48 object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="size-44 flex flex-col items-center justify-center rounded-control border border-dashed border-border mx-auto text-text-secondary">
                      <QrCode className="size-10 opacity-30 mb-1" />
                      <span className="text-xs">No QR Code on file</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-xs text-text-secondary">Payable:</div>
                    <div className="text-base font-bold text-primary">
                      {grandTotalPaise != null ? formatPaise(grandTotalPaise) : '—'}
                    </div>
                    {storeSettings?.upiId && (
                      <p className="text-xs font-mono text-text bg-background inline-block px-2.5 py-1 rounded border border-border">
                        UPI: {storeSettings.upiId}
                      </p>
                    )}
                    <p className="text-[11px] text-text-secondary mt-1">
                      Customer scans this QR on your phone using GPay, PhonePe, Paytm, etc.
                    </p>

                    {!isPaid && (
                      <div className="pt-3 border-t border-border/70 space-y-1.5">
                        <PrimaryButton
                          onClick={handleConfirmOnlinePayment}
                          isLoading={isConfirmingOnline}
                          className="w-full text-xs"
                          icon={CheckCircle2}
                        >
                          Payment Done by Customer (Confirm UPI)
                        </PrimaryButton>
                        <p className="text-[10px] text-text-secondary">
                          Click once the customer completes the payment on their phone.
                        </p>
                      </div>
                    )}

                    {isPaid && (
                      <div className="p-2.5 rounded bg-success-subtle text-success text-xs font-semibold flex items-center justify-center gap-1.5">
                        <ShieldCheck className="size-4" />
                        Online UPI Payment Verified
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DashboardCard>

          {/* Delivery Workflow Actions Card */}
          <DashboardCard title="Delivery Action Steps">
            <div className="space-y-3 pt-1">
              {allowedActions.canStart && (
                <PrimaryButton
                  onClick={() => handleStatusAction('start')}
                  isLoading={isUpdatingStatus}
                  className="w-full"
                  icon={Truck}
                >
                  Start Delivery (Out for Delivery)
                </PrimaryButton>
              )}

              {allowedActions.canReach && (
                <PrimaryButton
                  onClick={() => handleStatusAction('reach')}
                  isLoading={isUpdatingStatus}
                  className="w-full"
                  icon={Navigation}
                >
                  Reached Customer Location
                </PrimaryButton>
              )}

              {allowedActions.canDeliver && (
                <PrimaryButton
                  onClick={() => handleStatusAction('deliver')}
                  isLoading={isUpdatingStatus}
                  className="w-full bg-success hover:bg-success/90"
                  icon={CheckCircle2}
                >
                  Mark Delivered & Finish
                </PrimaryButton>
              )}

              {!allowedActions.canDeliver && delivery.status === 'REACHED_CUSTOMER' && !isPaid && (
                <div className="rounded-control bg-warning/10 border border-warning/30 p-3.5 text-xs text-center space-y-2.5">
                  <p className="font-semibold text-warning">
                    {isCash
                      ? 'Collect cash from customer to complete delivery.'
                      : 'Customer must complete UPI payment before delivery confirmation.'}
                  </p>
                  {!isCash ? (
                    <PrimaryButton
                      onClick={handleConfirmOnlinePayment}
                      isLoading={isConfirmingOnline}
                      className="w-full text-xs"
                      icon={CheckCircle2}
                    >
                      Confirm Customer Paid Online ({grandTotalPaise != null ? formatPaise(grandTotalPaise) : ''})
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton
                      onClick={() => setIsCashModalOpen(true)}
                      className="w-full text-xs"
                      icon={Banknote}
                    >
                      Record Cash Received
                    </PrimaryButton>
                  )}
                </div>
              )}

              {delivery.status === 'DELIVERED' && (
                <div className="rounded-control bg-success-subtle/70 border border-success/40 p-4 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-success font-heading font-bold text-sm">
                    <CheckCircle2 className="size-5" />
                    Delivery Completed & Done!
                  </div>
                  <p className="text-xs text-text-secondary">
                    Medicines handed over, payment confirmed, and store notified.
                  </p>
                  <PrimaryButton
                    onClick={() => navigate('/rider/deliveries')}
                    className="w-full text-xs"
                    icon={CheckCircle2}
                  >
                    Okay (Back to Deliveries)
                  </PrimaryButton>
                </div>
              )}

              {delivery.status === 'DELIVERY_FAILED' && (
                <div className="rounded-control bg-danger/15 p-4 text-center text-xs font-semibold text-danger flex items-center justify-center gap-2">
                  <XCircle className="size-4" />
                  Delivery Marked as Failed ({delivery.failureReason})
                </div>
              )}
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Collect Cash Confirmation Modal */}
      <Modal
        isOpen={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        title="Confirm Cash Collection"
        footer={
          <>
            <SecondaryButton onClick={() => setIsCashModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleCashCollectionSubmit} isLoading={isCollectingCash}>
              Confirm & Save
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {cashError && <FormAlert tone="error">{cashError}</FormAlert>}

          <p className="text-xs text-text-secondary">
            Please confirm that you have received the exact amount in cash from{' '}
            <strong className="text-text">{customer.fullName}</strong>:
          </p>

          <div className="p-4 rounded-control border border-border bg-card text-center">
            <span className="text-xs text-text-secondary">Cash to Collect:</span>
            <div className="font-heading text-2xl font-bold text-primary mt-1">
              {grandTotalPaise != null ? formatPaise(grandTotalPaise) : '—'}
            </div>
          </div>
        </div>
      </Modal>

      {/* Report Delivery Failed Modal */}
      <Modal
        isOpen={isFailModalOpen}
        onClose={() => setIsFailModalOpen(false)}
        title="Report Delivery Issue / Failure"
        footer={
          <>
            <SecondaryButton onClick={() => setIsFailModalOpen(false)}>
              Back
            </SecondaryButton>
            <DangerButton onClick={handleFailSubmit} isLoading={isFailing}>
              Confirm Delivery Failed
            </DangerButton>
          </>
        }
      >
        <form onSubmit={handleFailSubmit} className="space-y-4">
          {failError && <FormAlert tone="error">{failError}</FormAlert>}

          <p className="text-xs text-text-secondary">
            If you could not complete the drop-off, select the reason below. The order will be flagged and returned to store dispatch.
          </p>

          <FormSelect
            label="Reason for Failure *"
            value={failReason}
            onChange={(e) => setFailReason(e.target.value as DeliveryFailureReason)}
          >
            {FAILURE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </FormSelect>

          <FormTextarea
            label="Additional Notes / Details"
            placeholder="e.g. Called 3 times, neighbor said customer is out of town until evening..."
            value={failNotes}
            onChange={(e) => setFailNotes(e.target.value)}
            rows={3}
            maxLength={300}
          />
        </form>
      </Modal>
    </>
  )
}
