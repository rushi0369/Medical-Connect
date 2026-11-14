import { Edit2, MapPin, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { FormCheckbox } from '../../components/ui/FormCheckbox'
import { FormInput } from '../../components/ui/FormInput'
import { FormTextarea } from '../../components/ui/FormTextarea'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import {
  addCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  type SaveAddressInput,
} from '../../services/customer.service'
import type { SavedAddress } from '../../types/user'
import { getErrorMessage } from '../../utils/apiError'

interface AddressFormData {
  label: string
  fullAddress: string
  area: string
  city: string
  state: string
  pincode: string
  deliveryInstructions: string
  isDefault: boolean
}

const emptyForm: AddressFormData = {
  label: '',
  fullAddress: '',
  area: '',
  city: '',
  state: '',
  pincode: '',
  deliveryInstructions: '',
  isDefault: false,
}

export default function SavedAddressesPage() {
  const { user, setUser } = useAuth()
  const showToast = useToast()
  const { data: addresses, error, isLoading, reload } = useAsyncData(fetchCustomerAddresses, [])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null)
  const [formData, setFormData] = useState<AddressFormData>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [addressToDelete, setAddressToDelete] = useState<SavedAddress | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function openCreateModal() {
    setEditingAddress(null)
    setFormData(emptyForm)
    setFormError(null)
    setIsModalOpen(true)
  }

  function openEditModal(addr: SavedAddress) {
    setEditingAddress(addr)
    setFormData({
      label: addr.label,
      fullAddress: addr.fullAddress,
      area: addr.area,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      deliveryInstructions: addr.deliveryInstructions ?? '',
      isDefault: addr.isDefault,
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)

    const payload: SaveAddressInput = {
      label: formData.label.trim() || undefined,
      fullAddress: formData.fullAddress.trim(),
      area: formData.area.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      pincode: formData.pincode.trim(),
      deliveryInstructions: formData.deliveryInstructions.trim() || undefined,
      isDefault: formData.isDefault,
    }

    try {
      let updatedList: SavedAddress[]
      if (editingAddress) {
        updatedList = await updateCustomerAddress(editingAddress.id, payload)
        showToast('Address updated successfully.', 'success')
      } else {
        updatedList = await addCustomerAddress(payload)
        showToast('New address saved successfully.', 'success')
      }
      if (user) setUser({ ...user, addresses: updatedList })
      setIsModalOpen(false)
      reload()
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSetDefault(addr: SavedAddress) {
    try {
      const updatedList = await setDefaultCustomerAddress(addr.id)
      if (user) setUser({ ...user, addresses: updatedList })
      showToast(`${addr.label || 'Address'} set as default.`, 'success')
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    }
  }

  async function handleDeleteConfirm() {
    if (!addressToDelete) return
    setIsDeleting(true)
    try {
      const updatedList = await deleteCustomerAddress(addressToDelete.id)
      if (user) setUser({ ...user, addresses: updatedList })
      showToast('Address removed.', 'success')
      setAddressToDelete(null)
      reload()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Saved Addresses"
        description="Manage your delivery destinations for quick medicine requests."
        actions={
          <PrimaryButton icon={Plus} onClick={openCreateModal}>
            Add Address
          </PrimaryButton>
        }
      />

      {error ? (
        <DashboardCard>
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        </DashboardCard>
      ) : isLoading || !addresses ? (
        <LoadingState label="Loading saved addresses..." />
      ) : addresses.length === 0 ? (
        <DashboardCard>
          <EmptyState
            icon={MapPin}
            title="No addresses found"
            message="Add your home or work address to receive medicine deliveries."
            action={
              <PrimaryButton icon={Plus} onClick={openCreateModal}>
                Add Your First Address
              </PrimaryButton>
            }
          />
        </DashboardCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`flex flex-col justify-between rounded-control border p-5 transition-shadow hover:shadow-sm ${
                addr.isDefault ? 'border-primary/50 bg-primary-subtle/20' : 'border-border bg-surface'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-semibold text-text">{addr.label || 'Address'}</span>
                    {addr.isDefault && <StatusBadge tone="success">Default</StatusBadge>}
                  </div>
                </div>

                <p className="mt-3 text-sm text-text">{addr.fullAddress}</p>
                <p className="text-sm text-text-secondary">
                  {addr.area}, {addr.city}
                </p>
                <p className="text-sm text-text-secondary">
                  {addr.state} - {addr.pincode}
                </p>

                {addr.deliveryInstructions && (
                  <p className="mt-3 rounded bg-surface-muted p-2 text-xs text-text-secondary">
                    <span className="font-medium text-text">Instructions:</span> {addr.deliveryInstructions}
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <div>
                  {!addr.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Star className="size-3.5" />
                      Set as default
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(addr)}
                    className="rounded p-1.5 text-text-secondary hover:bg-surface-muted hover:text-text"
                    title="Edit address"
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressToDelete(addr)}
                    className="rounded p-1.5 text-danger/80 hover:bg-danger/10 hover:text-danger"
                    title="Delete address"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddress ? 'Edit Address' : 'Add New Address'}
        footer={
          <>
            <SecondaryButton onClick={() => setIsModalOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleSave} isLoading={isSubmitting}>
              {editingAddress ? 'Save Changes' : 'Add Address'}
            </PrimaryButton>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-control bg-danger-subtle p-3 text-sm text-danger">{formError}</div>
          )}

          <FormInput
            label="Label (e.g. Home, Office, Clinic)"
            placeholder="Home"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            maxLength={50}
          />

          <FormTextarea
            label="Full Address *"
            placeholder="House/Flat No, Building, Street"
            value={formData.fullAddress}
            onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
            required
            rows={2}
            maxLength={300}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Area / Locality *"
              placeholder="e.g. Bandra West"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              required
              maxLength={100}
            />

            <FormInput
              label="City *"
              placeholder="e.g. Mumbai"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
              maxLength={100}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="State *"
              placeholder="e.g. Maharashtra"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
              maxLength={100}
            />

            <FormInput
              label="Pincode (6 digits) *"
              placeholder="400050"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              required
              maxLength={6}
            />
          </div>

          <FormInput
            label="Delivery Instructions"
            placeholder="e.g. Ring the doorbell, near landmark"
            value={formData.deliveryInstructions}
            onChange={(e) => setFormData({ ...formData, deliveryInstructions: e.target.value })}
            maxLength={300}
          />

          {!editingAddress?.isDefault && (
            <FormCheckbox
              id="isDefault"
              label="Set as default delivery address"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
            />
          )}
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(addressToDelete)}
        title="Delete Address"
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setAddressToDelete(null)}
      >
        <p>Are you sure you want to delete &ldquo;{addressToDelete?.label || 'this address'}&rdquo;?</p>
      </ConfirmationDialog>
    </>
  )
}
