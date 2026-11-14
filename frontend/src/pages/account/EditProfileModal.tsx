import { useState } from 'react'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { FormInput } from '../../components/ui/FormInput'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { updateCustomerProfile } from '../../services/customer.service'
import { getErrorMessage } from '../../utils/apiError'

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, setUser } = useAuth()
  const showToast = useToast()

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const updated = await updateCustomerProfile({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
      })
      setUser(updated)
      showToast('Profile updated successfully.', 'success')
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile Details"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={isSubmitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSubmit} isLoading={isSubmitting}>
            Save Changes
          </PrimaryButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-control bg-danger-subtle p-3 text-sm text-danger">{error}</div>
        )}

        <FormInput
          label="Full Name *"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
          maxLength={100}
        />

        <FormInput
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
        />

        <div>
          <FormInput label="Mobile Number" value={user?.phone ?? ''} disabled />
          <p className="mt-1 text-xs text-text-secondary">
            Mobile numbers cannot be changed directly as they are linked to your login.
          </p>
        </div>
      </form>
    </Modal>
  )
}
