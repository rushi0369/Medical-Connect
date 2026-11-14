import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

interface ModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  // Hides the close button and ignores Esc, for a step that must be acknowledged.
  isDismissible?: boolean
}

/** Built on the browser's own dialog, which handles focus trapping and Esc correctly. */
export function Modal({ isOpen, title, onClose, children, footer, isDismissible = true }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault()
        if (isDismissible) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-border bg-surface p-0 text-text shadow-overlay backdrop:bg-text/50"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="modal-title" className="text-lg font-semibold text-text">
          {title}
        </h2>
        {isDismissible && <IconButton icon={X} label="Close" onClick={onClose} />}
      </div>
      <div className="px-5 py-4 text-sm">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
    </dialog>
  )
}
