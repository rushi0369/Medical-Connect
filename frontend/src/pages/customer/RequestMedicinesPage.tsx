import { AlertCircle, ArrowLeft, Pill, Plus, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { controlClasses } from '../../components/ui/Field'
import { FileUploader } from '../../components/ui/FileUploader'
import { FormSelect } from '../../components/ui/FormSelect'
import { FormTextarea } from '../../components/ui/FormTextarea'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import { createMedicineRequest, fetchCustomerAddresses, fetchCustomerOrderDetail } from '../../services/customer.service'
import type { RequestedItem } from '../../types/order'
import { getErrorMessage } from '../../utils/apiError'

export default function RequestMedicinesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reorderOrderId = searchParams.get('reorder')
  const showToast = useToast()

  const { data: addresses, isLoading: loadingAddresses } = useAsyncData(fetchCustomerAddresses, [])

  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [photos, setPhotos] = useState<File[]>([])
  const [items, setItems] = useState<RequestedItem[]>([])
  const [instructions, setInstructions] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reorderSource, setReorderSource] = useState<{ orderNumber: string } | null>(null)
  const [loadingReorder, setLoadingReorder] = useState(false)

  // Automatically select the default address once loaded
  useEffect(() => {
    if (addresses && !selectedAddressId && addresses.length > 0) {
      const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0]
      setSelectedAddressId(defaultAddr.id)
    }
  }, [addresses, selectedAddressId])

  // Load medicines from past order when reordering
  useEffect(() => {
    if (!reorderOrderId) return
    let isCancelled = false
    setLoadingReorder(true)

    fetchCustomerOrderDetail(reorderOrderId)
      .then((pastOrder) => {
        if (isCancelled) return
        setReorderSource({ orderNumber: pastOrder.orderNumber })

        // Extract medicines from past order (prefer requestedItems, fallback to invoice line items)
        const previousItems: RequestedItem[] =
          pastOrder.requestedItems && pastOrder.requestedItems.length > 0
            ? pastOrder.requestedItems.map((item) => ({
                description: item.description,
                quantity: item.quantity || 1,
              }))
            : pastOrder.invoice?.lineItems && pastOrder.invoice.lineItems.length > 0
            ? pastOrder.invoice.lineItems.map((item: { description: string; quantity: number }) => ({
                description: item.description,
                quantity: item.quantity || 1,
              }))
            : []

        if (previousItems.length > 0) {
          setItems(previousItems)
        }

        // Match past order address if available
        if (pastOrder.address && addresses && addresses.length > 0) {
          const match = addresses.find(
            (a) =>
              a.pincode === pastOrder.address.pincode &&
              a.fullAddress.toLowerCase() === pastOrder.address.fullAddress.toLowerCase(),
          )
          if (match) {
            setSelectedAddressId(match.id)
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          showToast(getErrorMessage(err, 'Could not pre-fill items from previous order.'), 'error')
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingReorder(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [reorderOrderId, addresses, showToast])

  function addItem() {
    setItems([...items, { description: '', quantity: 1 }])
  }

  function updateItem(index: number, changes: Partial<RequestedItem>) {
    const updated = [...items]
    updated[index] = { ...updated[index], ...changes }
    setItems(updated)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedAddressId) {
      setErrorMessage('Please select a delivery address.')
      return
    }

    const validItems = items.filter((item) => item.description.trim().length > 0)

    if (photos.length === 0 && validItems.length === 0) {
      setErrorMessage('Please upload at least one prescription photo or list at least one medicine.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await createMedicineRequest({
        addressId: selectedAddressId,
        photos,
        requestedItems: validItems,
        customerInstructions: instructions.trim() || undefined,
      })

      showToast(`Request ${res.orderNumber} placed! The store will review availability.`, 'success')
      navigate(`/customer/orders/${res.orderId}`)
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingAddresses) {
    return <LoadingState label="Preparing request form..." />
  }

  return (
    <>
      <div className="mb-4">
        <Link
          to="/customer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text"
        >
          <ArrowLeft className="size-3.5" />
          Back to Dashboard
        </Link>
      </div>

      <PageHeader
        title={reorderSource ? `Repeat Order (#${reorderSource.orderNumber})` : 'Request Medicines'}
        description={
          reorderSource
            ? 'Review and reorder medicines from your previous delivery, with the option to add new medicines.'
            : "Upload photos of your doctor's prescription or type the medicines you need."
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {loadingReorder && (
          <div className="rounded-control border border-border bg-surface-muted/50 p-3 text-xs text-text-secondary flex items-center gap-2">
            <RotateCw className="size-3.5 animate-spin" />
            Loading previous order medicines...
          </div>
        )}

        {reorderSource && (
          <div className="rounded-control border border-primary/40 bg-primary-subtle/50 p-4 text-xs">
            <div className="flex items-center gap-2 font-heading font-bold text-primary text-sm">
              <RotateCw className="size-4 text-primary" />
              Repeating Medicines from Order #{reorderSource.orderNumber}
            </div>
            <p className="mt-1 text-text-secondary leading-relaxed">
              We have pre-filled your medicines list below. You can adjust quantities, remove items, or click{' '}
              <strong className="text-text font-semibold">+ Add Another Item</strong> to add any new medicines or upload a new doctor prescription!
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger-subtle p-4 text-sm text-danger">
            <AlertCircle className="size-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Prescription Photos */}
        <DashboardCard
          title="1. Prescription Photos (Optional if typing medicines)"
          description="Upload clear photos of doctor prescriptions or medicine strips (JPG, PNG, WEBP)."
        >
          <div className="space-y-4">
            <FileUploader
              label="Choose or take photos"
              files={photos}
              onChange={setPhotos}
              maxFiles={6}
              maxSizeMb={10}
            />

            {photos.length === 0 && (
              <p className="text-xs text-text-secondary">
                No prescription photo? You can type the medicine names and strengths below instead.
              </p>
            )}
          </div>
        </DashboardCard>

        {/* Section 2: Written Medicines List */}
        <DashboardCard
          title="2. Medicine Names & Quantities (Optional if prescription uploaded)"
          description="List any specific medicines, brands, or daily requirements."
        >
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-control border border-dashed border-border p-5 text-center">
                <Pill className="mx-auto size-7 text-text-secondary/60" />
                <p className="mt-2 text-sm text-text-secondary">No medicines added to the list yet.</p>
                <SecondaryButton icon={Plus} onClick={addItem} className="mt-3">
                  Add Medicine
                </SecondaryButton>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        placeholder="e.g. Paracetamol 650mg, Dolo, Cetirizine"
                        value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                        required
                        maxLength={200}
                        className={`h-11 ${controlClasses}`}
                      />
                    </div>
                    <div className="w-24 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        required
                        className={`h-11 ${controlClasses}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded p-2 text-danger/80 hover:bg-danger-subtle hover:text-danger"
                      title="Remove medicine"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}

                <SecondaryButton icon={Plus} onClick={addItem} className="mt-2">
                  Add Another Item
                </SecondaryButton>
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Section 3: Delivery Address & Instructions */}
        <DashboardCard title="3. Delivery Address & Instructions" description="Where should our rider deliver your medicines?">
          <div className="space-y-4">
            {addresses && addresses.length > 0 ? (
              <FormSelect
                label="Select Delivery Destination *"
                value={selectedAddressId}
                onChange={(e) => setSelectedAddressId(e.target.value)}
                required
              >
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `[${a.label}] ` : ''}
                    {a.fullAddress}, {a.area}, {a.city} {a.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </FormSelect>
            ) : (
              <div className="rounded-control bg-warning-subtle/50 p-4 text-sm text-warning">
                <p>You have no saved addresses yet.</p>
                <Link to="/customer/addresses" className="mt-2 inline-block font-semibold text-primary underline">
                  Add an address in Saved Addresses first →
                </Link>
              </div>
            )}

            <FormTextarea
              label="Special Instructions for Store or Rider (Optional)"
              placeholder="e.g. Call before arrival, leave with security, urgent requirement"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
        </DashboardCard>

        {/* Submit Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface p-5 border border-border">
          <div className="text-sm text-text-secondary">
            {photos.length > 0 && <span className="mr-3 font-medium text-text">📸 {photos.length} photo(s)</span>}
            {items.filter((i) => i.description.trim()).length > 0 && (
              <span className="font-medium text-text">
                💊 {items.filter((i) => i.description.trim()).length} medicine(s)
              </span>
            )}
            {photos.length === 0 && items.filter((i) => i.description.trim()).length === 0 && (
              <span className="text-warning">Attach a photo or enter at least one medicine.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <SecondaryButton onClick={() => navigate('/customer')}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              disabled={!photos.length && !items.filter((i) => i.description.trim()).length}
              isLoading={isSubmitting}
            >
              Send Request to Store
            </PrimaryButton>
          </div>
        </div>
      </form>
    </>
  )
}
