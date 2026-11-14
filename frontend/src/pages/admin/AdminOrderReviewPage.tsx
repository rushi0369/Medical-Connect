import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  MessageCircle,
  Plus,
  Route,
  Send,
  Trash2,
  Undo2,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { controlClasses } from '../../components/ui/Field'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import {
  assignRiderToOrder,
  calculateOrderDistance,
  fetchAdminOrderDetail,
  fetchAvailableRiders,
  saveAdminInvoiceDraft,
  saveAdminOrderReviewNotes,
  sendAdminInvoice,
  startAdminOrderReview,
  withdrawAdminInvoice,
  type AvailableRider,
} from '../../services/admin.service'
import { getErrorMessage } from '../../utils/apiError'
import { downloadInvoicePdf } from '../../utils/downloadPdf'
import { formatDateTime } from '../../utils/format'
import { ORDER_STATUS_DISPLAY } from '../../utils/statusLabels'

interface EditableLineItem {
  description: string
  quantity: number
  unitPriceRupees: number
  isSubstitute: boolean
  substituteFor: string
}

export default function AdminOrderReviewPage() {
  const { id } = useParams<{ id: string }>()
  const showToast = useToast()

  const { data: order, error, isLoading, reload } = useAsyncData(
    () => fetchAdminOrderDetail(id!),
    [id],
  )

  // Review Notes State
  const [adminRemarks, setAdminRemarks] = useState('')
  const [itemReviews, setItemReviews] = useState<{ [key: string]: { isUnavailable: boolean; alternativeNote: string } }>({})
  const [isSavingReview, setIsSavingReview] = useState(false)

  // Bill Editor State
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([])
  const [discountRupees, setDiscountRupees] = useState<number>(0)
  const [taxRupees, setTaxRupees] = useState<number>(0)
  const [deliveryChargeRupees, setDeliveryChargeRupees] = useState<number>(30)
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null)
  const [deliveryDurationMinutes, setDeliveryDurationMinutes] = useState<number | null>(null)
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false)
  const [distanceInfo, setDistanceInfo] = useState<string | null>(null)
  const [invoiceRemarks, setInvoiceRemarks] = useState('')
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)

  const navigate = useNavigate()

  // Rider Assignment State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [availableRiders, setAvailableRiders] = useState<AvailableRider[]>([])
  const [selectedRiderId, setSelectedRiderId] = useState('')
  const [isLoadingRiders, setIsLoadingRiders] = useState(false)
  const [isAssigningRider, setIsAssigningRider] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  async function openAssignModal() {
    setIsAssignModalOpen(true)
    setSelectedRiderId('')
    setAssignError(null)
    setIsLoadingRiders(true)
    try {
      const list = await fetchAvailableRiders()
      setAvailableRiders(list)
    } catch (err) {
      setAssignError(getErrorMessage(err, 'Failed to load available riders.'))
    } finally {
      setIsLoadingRiders(false)
    }
  }

  async function handleAssignRiderSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!order || !selectedRiderId) return

    setIsAssigningRider(true)
    setAssignError(null)
    try {
      await assignRiderToOrder(order.id, selectedRiderId)
      showToast('Rider assigned successfully! The delivery task is now on their phone.', 'success')
      setIsAssignModalOpen(false)
      reload()
    } catch (err) {
      setAssignError(getErrorMessage(err, 'Failed to assign rider.'))
    } finally {
      setIsAssigningRider(false)
    }
  }

  async function handleCalculateDistance() {
    if (!order) return
    setIsCalculatingDistance(true)
    setDistanceInfo(null)
    try {
      const res = await calculateOrderDistance(order.id)
      if (res.distanceKm != null) {
        setDeliveryDistanceKm(res.distanceKm)
        setDeliveryDurationMinutes(res.durationMinutes ?? null)
        if (res.chargePaise != null) {
          setDeliveryChargeRupees(res.chargePaise / 100)
        }
        setDistanceInfo(
          `${res.distanceKm} km (~${res.durationMinutes ?? 15} mins)${res.isEstimated ? ' [Estimated]' : ''}`,
        )
        showToast(`Road distance: ${res.distanceKm} km. Tier fee applied.`, 'success')
      } else {
        setDistanceInfo(res.message || 'Map pin missing. Please enter charge manually.')
      }
    } catch {
      setDistanceInfo('Could not calculate distance. Please enter charge manually.')
    } finally {
      setIsCalculatingDistance(false)
    }
  }

  // Populate bill items from existing invoice or requested items
  useEffect(() => {
    if (!order) return

    setAdminRemarks(order.adminRemarks ?? '')

    const reviews: { [key: string]: { isUnavailable: boolean; alternativeNote: string } } = {}
    for (const item of order.requestedItems) {
      if (item.id) {
        reviews[item.id] = {
          isUnavailable: item.isUnavailable ?? false,
          alternativeNote: item.alternativeNote ?? '',
        }
      }
    }
    setItemReviews(reviews)

    if (order.invoice) {
      const inv = order.invoice
      setLineItems(
        inv.lineItems.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPriceRupees: item.unitPricePaise / 100,
          isSubstitute: item.isSubstitute ?? false,
          substituteFor: item.substituteFor ?? '',
        })),
      )
      setDiscountRupees(inv.discountPaise / 100)
      setTaxRupees(inv.taxPaise / 100)
      setDeliveryChargeRupees(inv.deliveryChargePaise / 100)
      setInvoiceRemarks(inv.remarks ?? '')
    } else if (order.requestedItems.length > 0) {
      setLineItems(
        order.requestedItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPriceRupees: 0,
          isSubstitute: false,
          substituteFor: '',
        })),
      )
    } else {
      setLineItems([{ description: '', quantity: 1, unitPriceRupees: 0, isSubstitute: false, substituteFor: '' }])
    }
  }, [order])

  // Start Review
  async function handleStartReview() {
    try {
      await startAdminOrderReview(order!.id)
      showToast('Order review started.', 'success')
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  // Save Review Notes
  async function handleSaveReviewNotes() {
    setIsSavingReview(true)
    try {
      const payload = {
        adminRemarks: adminRemarks.trim() || undefined,
        requestedItems: order!.requestedItems
          .filter((item) => item.id && itemReviews[item.id])
          .map((item) => ({
            id: item.id!,
            isUnavailable: itemReviews[item.id!].isUnavailable,
            alternativeNote: itemReviews[item.id!].alternativeNote.trim() || undefined,
          })),
      }
      await saveAdminOrderReviewNotes(order!.id, payload)
      showToast('Stock review notes saved.', 'success')
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsSavingReview(false)
    }
  }

  // Bill calculations
  const subtotalRupees = lineItems.reduce((sum, item) => sum + item.quantity * (item.unitPriceRupees || 0), 0)
  const grandTotalRupees = Math.max(0, subtotalRupees - (discountRupees || 0) + (taxRupees || 0) + (deliveryChargeRupees || 0))

  function addLineItem() {
    setLineItems([
      ...lineItems,
      { description: '', quantity: 1, unitPriceRupees: 0, isSubstitute: false, substituteFor: '' },
    ])
  }

  function updateLineItem(index: number, changes: Partial<EditableLineItem>) {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], ...changes }
    setLineItems(updated)
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  function handleSendWhatsApp() {
    if (!order) return
    const rawPhone = (order.customer?.phone || '').replace(/\D/g, '')
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone
    const pdfUrl = `${window.location.origin}/api/admin/invoices/${order.invoice?.id}/pdf`

    const message = `🏥 *CK Medical - Medicine Bill*
Hello *${order.customer?.fullName || 'Customer'}*, your medicine bill is ready!

📋 *Order Details:*
• Order: #${order.orderNumber}
• Items: ${lineItems.length} medicines
• Total Amount: ₹${grandTotalRupees.toFixed(2)}

📄 *Download & View Bill PDF:*
${pdfUrl}

👉 *Please reply "YES" to this message to confirm your order so we can assign a delivery rider.*`

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
    showToast(`WhatsApp opened for ${order.customer?.fullName} (${order.customer?.phone})`, 'success')
  }

  // Save Bill Draft
  async function handleSaveDraft() {
    const validItems = lineItems.filter((i) => i.description.trim().length > 0)
    if (validItems.length === 0) {
      showToast('Add at least one medicine item to the bill.', 'error')
      return
    }

    setIsSavingDraft(true)
    try {
      const payload = {
        lineItems: validItems.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPricePaise: Math.round(item.unitPriceRupees * 100),
          isSubstitute: item.isSubstitute,
          substituteFor: item.isSubstitute ? item.substituteFor.trim() || undefined : undefined,
        })),
        discountPaise: Math.round((discountRupees || 0) * 100),
        taxPaise: Math.round((taxRupees || 0) * 100),
        deliveryChargePaise: Math.round((deliveryChargeRupees || 0) * 100),
        deliveryDistanceKm: deliveryDistanceKm,
        deliveryDurationMinutes: deliveryDurationMinutes,
        remarks: invoiceRemarks.trim() || undefined,
      }

      await saveAdminInvoiceDraft(order!.id, payload)
      showToast('Bill draft saved successfully.', 'success')
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsSavingDraft(false)
    }
  }

  // Send Bill to Customer
  async function handleSendInvoice() {
    setIsSending(true)
    try {
      await handleSaveDraft()
      await sendAdminInvoice(order!.id)
      showToast('Bill sent to customer for review and approval!', 'success')
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsSending(false)
    }
  }

  // Withdraw Bill
  async function handleWithdrawInvoice() {
    setIsWithdrawing(true)
    try {
      await withdrawAdminInvoice(order!.id)
      showToast('Bill withdrawn. You can now edit and re-send.', 'success')
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsWithdrawing(false)
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading order review..." />
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

  const isUnderReview = order.status === 'UNDER_REVIEW'
  const isAwaitingApproval = order.status === 'WAITING_FOR_CUSTOMER_APPROVAL'
  const isPendingReview = order.status === 'PENDING_ADMIN_REVIEW'
  const isBillEditable = Boolean(order.allowedActions?.canEditBill || isUnderReview)

  return (
    <>
      <div className="mb-4">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          Back to Order Requests
        </Link>
      </div>

      <PageHeader
        title={`Review Order ${order.orderNumber}`}
        description={`Submitted on ${formatDateTime(order.createdAt)}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>

            {isPendingReview && (
              <PrimaryButton onClick={handleStartReview}>
                Start Review
              </PrimaryButton>
            )}

            {isAwaitingApproval && (
              <SecondaryButton icon={Undo2} onClick={handleWithdrawInvoice} isLoading={isWithdrawing}>
                Withdraw Bill
              </SecondaryButton>
            )}

            {order.status === 'CONFIRMED' && (
              <PrimaryButton icon={Bike} onClick={openAssignModal}>
                Assign Rider
              </PrimaryButton>
            )}

            {order.allowedActions?.canReassignRider && (
              <SecondaryButton icon={Bike} onClick={openAssignModal}>
                Reassign Rider
              </SecondaryButton>
            )}

            {order.status === 'DELIVERED' && (
              <PrimaryButton icon={CheckCircle2} onClick={() => navigate('/admin/orders')}>
                Done (Okay)
              </PrimaryButton>
            )}

            {order.invoice && (
              <button
                type="button"
                onClick={() => downloadInvoicePdf(`/admin/invoices/${order.invoice?.id}/pdf`, `Invoice-${order.orderNumber}.pdf`)}
                className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-surface-muted transition cursor-pointer"
              >
                <Download className="size-3.5" />
                Download PDF
              </button>
            )}
          </div>
        }
      />

      {/* Confirmed Dispatch Action Banner */}
      {order.status === 'CONFIRMED' && (
        <div className="mb-6 rounded-control border border-success/40 bg-success-subtle/50 p-4 text-sm text-text flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="font-heading font-semibold text-text flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" />
              Customer Approved the Bill & Placed Order
            </h4>
            <p className="mt-1 text-xs text-text-secondary">
              This order is confirmed and waiting for dispatch. Assign an active rider to deliver the medicines.
            </p>
          </div>
          <PrimaryButton icon={Bike} onClick={openAssignModal}>
            Assign Rider to Deliver
          </PrimaryButton>
        </div>
      )}

      {/* Completed & Delivered Celebration Banner */}
      {order.status === 'DELIVERED' && (
        <div className="mb-6 rounded-control border border-success/40 bg-success-subtle/60 p-4 text-sm text-text flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-6 text-success shrink-0 mt-0.5" />
            <div>
              <h4 className="font-heading font-bold text-text text-base">
                Order Completed & Delivered!
              </h4>
              <p className="mt-0.5 text-xs text-text-secondary">
                Successfully delivered {order.delivery?.rider ? `by ${order.delivery.rider.fullName}` : ''} • All medicines received by customer.
              </p>
            </div>
          </div>
          <PrimaryButton onClick={() => navigate('/admin/orders')} className="text-xs">
            Okay (Done)
          </PrimaryButton>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Left Column: Customer & Prescriptions & Availability Notes */}
        <div className="space-y-6 lg:col-span-1">
          {/* Customer Details */}
          <DashboardCard title="Customer Information">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="size-4 text-primary" />
                <span className="font-semibold text-text">{order.customer?.fullName}</span>
              </div>
              <p className="text-xs text-text-secondary">📱 {order.customer?.phone}</p>
              {order.customer?.email && <p className="text-xs text-text-secondary">✉️ {order.customer.email}</p>}

              <div className="border-t border-border/60 pt-3">
                <div className="flex items-start gap-2 text-xs text-text">
                  <MapPin className="size-3.5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">{order.address?.fullAddress}</p>
                    <p className="text-text-secondary">
                      {order.address?.area}, {order.address?.city} - {order.address?.pincode}
                    </p>
                    {order.address?.deliveryInstructions && (
                      <p className="mt-1 text-text-secondary italic">Note: {order.address.deliveryInstructions}</p>
                    )}
                  </div>
                </div>
              </div>

              {order.customerInstructions && (
                <div className="rounded-control bg-surface-muted p-2.5 text-xs">
                  <span className="font-semibold text-text">Customer instructions:</span>
                  <p className="mt-0.5 text-text-secondary">{order.customerInstructions}</p>
                </div>
              )}
            </div>
          </DashboardCard>

          {/* Assigned Rider Information */}
          {order.delivery?.rider ? (
            <DashboardCard title="Assigned Delivery Rider">
              <div className="space-y-3 text-xs pt-1">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      <Bike className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-sm text-text">
                        {order.delivery.rider.fullName}
                      </h4>
                      <p className="text-text-secondary">
                        ID: {order.delivery.rider.riderId || 'Rider'} • 📱 {order.delivery.rider.phone}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {order.delivery.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {order.allowedActions?.canReassignRider && (
                  <div className="pt-2 border-t border-border/60 flex justify-end">
                    <SecondaryButton icon={Bike} onClick={openAssignModal} className="text-xs">
                      Reassign Rider
                    </SecondaryButton>
                  </div>
                )}
              </div>
            </DashboardCard>
          ) : order.status === 'CONFIRMED' ? (
            <DashboardCard title="Delivery Dispatch">
              <div className="text-center p-3 space-y-2">
                <Bike className="size-8 text-primary mx-auto opacity-70" />
                <p className="text-xs font-semibold text-text">No Rider Assigned Yet</p>
                <p className="text-[11px] text-text-secondary">
                  Customer has confirmed the bill. Please assign a rider to begin delivery.
                </p>
                <PrimaryButton icon={Bike} onClick={openAssignModal} className="w-full text-xs">
                  Assign Rider Now
                </PrimaryButton>
              </div>
            </DashboardCard>
          ) : null}

          {/* Prescription Photos */}
          {order.photos && order.photos.length > 0 && (
            <DashboardCard
              title={`Prescription Photos (${order.photos.length})`}
              description="Click image to zoom and verify doctor handwriting"
            >
              <div className="grid grid-cols-2 gap-2.5">
                {order.photos.map((photo) => {
                  const url = `/uploads/${photo.id}`
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setPreviewPhoto(url)}
                      className="group relative aspect-square overflow-hidden rounded-control border border-border bg-surface-muted transition-all hover:border-primary"
                    >
                      <img
                        src={url}
                        alt="Prescription preview"
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

          {/* Availability Notes & Alternatives */}
          <DashboardCard
            title="Availability & Shelf Check"
            description="Mark out-of-stock items and suggest generic alternatives"
          >
            <div className="space-y-3">
              {order.requestedItems.map((item, idx) => {
                const review = item.id ? itemReviews[item.id] ?? { isUnavailable: false, alternativeNote: '' } : null
                return (
                  <div key={idx} className="rounded-control border border-border/80 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text">
                        {item.description} (x{item.quantity})
                      </span>
                      {review && (
                        <label className="flex items-center gap-1.5 text-danger font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={review.isUnavailable}
                            onChange={(e) =>
                              setItemReviews({
                                ...itemReviews,
                                [item.id!]: { ...review, isUnavailable: e.target.checked },
                              })
                            }
                            className="size-3.5 accent-danger"
                          />
                          Unavailable
                        </label>
                      )}
                    </div>

                    {review?.isUnavailable && (
                      <input
                        placeholder="Suggest alternative medicine/brand..."
                        value={review.alternativeNote}
                        onChange={(e) =>
                          setItemReviews({
                            ...itemReviews,
                            [item.id!]: { ...review, alternativeNote: e.target.value },
                          })
                        }
                        className={`h-9 text-xs ${controlClasses}`}
                      />
                    )}
                  </div>
                )
              })}

              <div className="space-y-1 pt-1">
                <label className="text-xs font-medium text-text">Admin Remarks to Customer</label>
                <textarea
                  placeholder="e.g. Mox 500mg provided in place of Amoxicillin with doctor approval"
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  rows={2}
                  className={`py-1.5 text-xs ${controlClasses}`}
                />
              </div>

              {isUnderReview && (
                <div className="flex justify-end pt-1">
                  <SecondaryButton onClick={handleSaveReviewNotes} isLoading={isSavingReview}>
                    Save Shelf Notes
                  </SecondaryButton>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Right Column: Interactive Bill Editor */}
        <div className="space-y-6 lg:col-span-2">
          <DashboardCard
            title={order.invoice ? `Invoice (Version ${order.invoice.version})` : 'Prepare Bill'}
            description="Type item names, quantities, and prices to generate customer bill"
          >
            {isPendingReview ? (
              <div className="rounded-control bg-warning-subtle/50 p-6 text-center text-warning">
                <Clock className="mx-auto size-8" />
                <h4 className="mt-2 font-semibold">Order is waiting for review</h4>
                <p className="mt-1 text-sm text-text-secondary">
                  Click &ldquo;Start Review&rdquo; at the top to begin checking medicines and preparing the bill.
                </p>
                <PrimaryButton onClick={handleStartReview} className="mt-4">
                  Start Review Now
                </PrimaryButton>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border font-semibold text-text-secondary">
                        <th className="pb-2">Medicine / Item</th>
                        <th className="pb-2 w-20 text-center">Qty</th>
                        <th className="pb-2 w-28 text-right">Unit Price (₹)</th>
                        <th className="pb-2 w-28 text-right">Total (₹)</th>
                        {isBillEditable && <th className="pb-2 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="py-2">
                          <td className="py-2 pr-2">
                            {isBillEditable ? (
                              <div className="space-y-1">
                                <input
                                  placeholder="Medicine description"
                                  value={item.description}
                                  onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                                  className={`h-9 ${controlClasses}`}
                                />
                                <div className="flex items-center gap-2 pt-0.5">
                                  <label className="flex items-center gap-1 text-[11px] text-text-secondary cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={item.isSubstitute}
                                      onChange={(e) => updateLineItem(idx, { isSubstitute: e.target.checked })}
                                      className="size-3 accent-primary"
                                    />
                                    Substitute for:
                                  </label>
                                  {item.isSubstitute && (
                                    <input
                                      placeholder="Original item name"
                                      value={item.substituteFor}
                                      onChange={(e) => updateLineItem(idx, { substituteFor: e.target.value })}
                                      className={`h-7 text-[11px] ${controlClasses}`}
                                    />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="font-medium text-text">{item.description}</span>
                                {item.isSubstitute && (
                                  <div className="text-[11px] text-text-secondary">
                                    (Alt for {item.substituteFor || 'prescribed item'})
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-1 text-center">
                            {isBillEditable ? (
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateLineItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                className={`h-9 text-center ${controlClasses}`}
                              />
                            ) : (
                              <span className="text-text">{item.quantity}</span>
                            )}
                          </td>
                          <td className="py-2 px-1 text-right">
                            {isBillEditable ? (
                              <input
                                type="number"
                                min={0}
                                step="0.5"
                                value={item.unitPriceRupees}
                                onChange={(e) => updateLineItem(idx, { unitPriceRupees: parseFloat(e.target.value) || 0 })}
                                className={`h-9 text-right ${controlClasses}`}
                              />
                            ) : (
                              <span className="text-text">₹{item.unitPriceRupees.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-2 pl-2 text-right font-medium text-text">
                            ₹{(item.quantity * (item.unitPriceRupees || 0)).toFixed(2)}
                          </td>
                          {isBillEditable && (
                            <td className="py-2 pl-1 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(idx)}
                                className="rounded p-1 text-danger/80 hover:bg-danger-subtle hover:text-danger"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isBillEditable && (
                  <SecondaryButton icon={Plus} onClick={addLineItem} className="text-xs">
                    Add Line Item
                  </SecondaryButton>
                )}

                {/* Totals Breakdown */}
                <div className="border-t border-border/80 pt-4">
                  <div className="ml-auto max-w-xs space-y-2 text-xs">
                    <div className="flex justify-between text-text-secondary">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-text">₹{subtotalRupees.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary">Discount (₹):</span>
                      {isBillEditable ? (
                        <input
                          type="number"
                          min={0}
                          value={discountRupees}
                          onChange={(e) => setDiscountRupees(parseFloat(e.target.value) || 0)}
                          className={`h-8 w-24 text-right ${controlClasses}`}
                        />
                      ) : (
                        <span className="text-danger">-₹{(discountRupees || 0).toFixed(2)}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary">Tax / GST (₹):</span>
                      {isBillEditable ? (
                        <input
                          type="number"
                          min={0}
                          value={taxRupees}
                          onChange={(e) => setTaxRupees(parseFloat(e.target.value) || 0)}
                          className={`h-8 w-24 text-right ${controlClasses}`}
                        />
                      ) : (
                        <span className="text-text">₹{(taxRupees || 0).toFixed(2)}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary">Delivery Charge (₹):</span>
                      <div className="flex items-center gap-1.5">
                        {isBillEditable ? (
                          <>
                            <button
                              type="button"
                              onClick={handleCalculateDistance}
                              disabled={isCalculatingDistance}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition disabled:opacity-50"
                              title="Auto calculate road distance from store to customer"
                            >
                              <Route className="size-3" />
                              {isCalculatingDistance ? 'Calc...' : 'Calc Distance'}
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={deliveryChargeRupees}
                              onChange={(e) => setDeliveryChargeRupees(parseFloat(e.target.value) || 0)}
                              className={`h-8 w-20 text-right ${controlClasses}`}
                            />
                          </>
                        ) : (
                          <span className="text-text">₹{(deliveryChargeRupees || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    {distanceInfo && (
                      <div className="text-[11px] text-primary text-right font-medium">
                        {distanceInfo}
                      </div>
                    )}

                    <div className="flex justify-between border-t border-border/80 pt-2 text-sm font-bold text-text">
                      <span>Grand Total:</span>
                      <span className="text-primary font-heading text-base">₹{grandTotalRupees.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Remarks & Bill Submission */}
                <div className="border-t border-border/80 pt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-text">Bill Remarks / Store Notes</label>
                    <textarea
                      placeholder="e.g. Free delivery on orders above Rs. 500"
                      value={invoiceRemarks}
                      onChange={(e) => setInvoiceRemarks(e.target.value)}
                      disabled={!isBillEditable}
                      rows={2}
                      className={`py-1.5 text-xs ${controlClasses}`}
                    />
                  </div>

                  {isBillEditable && (
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                      <SecondaryButton onClick={handleSaveDraft} isLoading={isSavingDraft}>
                        Save Bill Draft
                      </SecondaryButton>
                      <PrimaryButton icon={Send} onClick={handleSendInvoice} isLoading={isSending}>
                        Send Bill to Customer
                      </PrimaryButton>
                    </div>
                  )}

                  {isAwaitingApproval && (
                    <div className="rounded-control bg-info-subtle/50 p-4 text-xs text-info flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <span>
                        Bill version <strong>{order.invoice?.version}</strong> was sent on{' '}
                        {formatDateTime(order.invoice?.sentAt)}. Waiting for customer approval.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSendWhatsApp}
                          className="inline-flex items-center gap-1.5 rounded-control bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#20ba59] transition"
                          title="Send bill and PDF link to customer on WhatsApp"
                        >
                          <MessageCircle className="size-3.5" />
                          WhatsApp Bill
                        </button>
                        <SecondaryButton icon={Undo2} onClick={handleWithdrawInvoice} isLoading={isWithdrawing}>
                          Withdraw to Edit
                        </SecondaryButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      {/* Prescription Preview Zoom Modal */}
      <Modal isOpen={Boolean(previewPhoto)} onClose={() => setPreviewPhoto(null)} title="Prescription Verification">
        {previewPhoto && (
          <div className="text-center">
            <img
              src={previewPhoto}
              alt="Prescription full zoom"
              className="max-h-[75vh] w-auto mx-auto rounded-control object-contain"
            />
          </div>
        )}
      </Modal>

      {/* Rider Assignment Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Delivery Rider"
      >
        <form onSubmit={handleAssignRiderSubmit} className="space-y-4">
          <p className="text-xs text-text-secondary">
            Select an active delivery rider to assign order <strong>#{order?.orderNumber}</strong>. Only the selected rider will receive this delivery on their phone.
          </p>

          {assignError && (
            <div className="rounded-control bg-danger-subtle p-3 text-xs text-danger">
              {assignError}
            </div>
          )}

          {isLoadingRiders ? (
            <LoadingState label="Loading available riders..." />
          ) : availableRiders.length === 0 ? (
            <div className="rounded-control border border-border/70 p-4 text-center text-xs text-text-secondary">
              No active delivery riders found. Please make sure riders are created and marked as active in Rider Management.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
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
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-semibold text-sm text-text">
                            {r.fullName}
                          </span>
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                            {r.riderId || 'Rider'}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">📱 {r.phone}</p>
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
                        {r.activeDeliveries === 0 ? 'Free (0 active)' : `${r.activeDeliveries} in progress`}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
            <SecondaryButton type="button" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              icon={Bike}
              isLoading={isAssigningRider}
              disabled={!selectedRiderId || isAssigningRider || availableRiders.length === 0}
            >
              Assign Rider
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
