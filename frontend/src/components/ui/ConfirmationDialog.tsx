import type { ReactNode } from 'react'
import { DangerButton, PrimaryButton, SecondaryButton } from './Button'
import { Modal } from './Modal'

interface ConfirmationDialogProps {
  isOpen: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  isDestructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const ConfirmButton = isDestructive ? DangerButton : PrimaryButton

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <SecondaryButton onClick={onCancel} disabled={isLoading}>
            Cancel
          </SecondaryButton>
          <ConfirmButton onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </ConfirmButton>
        </>
      }
    >
      {children}
    </Modal>
  )
}
