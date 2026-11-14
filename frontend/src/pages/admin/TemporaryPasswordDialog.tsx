import { Check, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/FormAlert'
import { Modal } from '../../components/ui/Modal'
import type { Rider } from '../../types/user'

interface TemporaryPasswordDialogProps {
  title: string
  rider: Rider | null
  temporaryPassword: string | null
  onClose: () => void
}

/** The only time this password is ever shown. Only a hash of it is stored. */
export function TemporaryPasswordDialog({ title, rider, temporaryPassword, onClose }: TemporaryPasswordDialogProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(temporaryPassword ?? '')
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  function handleSendWhatsApp() {
    if (!rider || !temporaryPassword) return
    const cleanPhone = rider.phone.replace(/\D/g, '')
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const message = `🛵 *CK MEDICAL STORE* | 🔑 *Delivery Rider Account Login*

Hello *${rider.fullName}*,
Your delivery rider account for CK Medical has been set up!

🆔 *Rider ID:* ${rider.riderProfile.riderId}
📱 *Login Mobile:* ${rider.phone}
🔐 *Temporary Password:* ${temporaryPassword}
🌐 *Login Portal:* ${window.location.origin}/login

Please log in on your phone and set your permanent password to view assigned deliveries.`

    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  function close() {
    setCopyState('idle')
    onClose()
  }

  return (
    <Modal
      isOpen={Boolean(rider && temporaryPassword)}
      title={title}
      onClose={close}
      isDismissible={false}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-control bg-[#25D366] hover:bg-[#20ba59] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
          >
            <MessageCircle className="size-4" />
            <span>Send via WhatsApp</span>
          </button>
          <PrimaryButton onClick={close}>Done (I have saved it)</PrimaryButton>
        </div>
      }
    >
      {rider && (
        <div className="space-y-4">
          <FormAlert tone="success">
            Give these details to {rider.fullName}. They will be asked to choose their own password when they first log
            in.
          </FormAlert>

          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-text-secondary">Rider ID</dt>
              <dd className="mt-0.5 font-medium text-text">{rider.riderProfile.riderId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-secondary">Log in with mobile number</dt>
              <dd className="mt-0.5 font-medium text-text">{rider.phone}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-secondary">Temporary password</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="rounded-control bg-surface-muted px-3 py-2 font-mono text-base font-semibold break-all text-text">
                  {temporaryPassword}
                </code>
                <SecondaryButton icon={copyState === 'copied' ? Check : Copy} onClick={copyPassword}>
                  {copyState === 'copied' ? 'Copied' : 'Copy'}
                </SecondaryButton>
              </dd>
              {copyState === 'failed' && (
                <p role="alert" className="mt-1 text-xs font-medium text-danger">
                  Could not copy automatically. Please select the password and copy it by hand.
                </p>
              )}
            </div>
          </dl>

          <p className="font-medium text-text">This password will not be shown again.</p>
        </div>
      )}
    </Modal>
  )
}
