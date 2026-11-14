import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PrimaryButton } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/FormAlert'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { useAuth } from '../../hooks/useAuth'
import { changePassword } from '../../services/auth.service'
import { applyFieldErrors, getErrorMessage } from '../../utils/apiError'
import { newPasswordField, PASSWORD_HINT } from '../../utils/validation'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, 'Type your new password again.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  })

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

interface ChangePasswordFormProps {
  currentPasswordLabel?: string
  onChanged: () => void
}

/** Used both on the profile page and when a temporary password must be replaced. */
export function ChangePasswordForm({ currentPasswordLabel = 'Current password', onChanged }: ChangePasswordFormProps) {
  const { setUser } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function onSubmit({ currentPassword, newPassword }: ChangePasswordValues) {
    setFormError(null)
    try {
      const updated = await changePassword({ currentPassword, newPassword })
      setUser(updated)
      reset()
      onChanged()
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <PasswordInput
        label={currentPasswordLabel}
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <PasswordInput
        label="New password"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <PasswordInput
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <PrimaryButton type="submit" icon={KeyRound} isLoading={isSubmitting}>
        Change password
      </PrimaryButton>
    </form>
  )
}
