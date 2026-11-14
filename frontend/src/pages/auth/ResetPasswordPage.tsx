import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { PrimaryButton } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/FormAlert'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { resetPassword } from '../../services/auth.service'
import { applyFieldErrors, getErrorMessage } from '../../utils/apiError'
import { newPasswordField, PASSWORD_HINT } from '../../utils/validation'

const resetSchema = z
  .object({
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, 'Type your password again.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  })

type ResetValues = z.infer<typeof resetSchema>

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  async function onSubmit({ newPassword }: ResetValues) {
    setFormError(null)
    try {
      await resetPassword({ token, newPassword })
      navigate('/login?reset=done', { replace: true })
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  if (!token) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
        <h1 className="text-2xl font-bold text-text">This link is not valid</h1>
        <p className="mt-2 text-sm text-text-secondary">Please request a new reset link and open it from your email.</p>
        <Link
          to="/forgot-password"
          className="mt-4 inline-block text-sm font-semibold text-primary-dark underline underline-offset-2 hover:text-text"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold text-text">Choose a new password</h1>
      <p className="mt-1 text-sm text-text-secondary">This also logs you out on your other devices.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {formError && (
          <FormAlert>
            {formError}{' '}
            <Link to="/forgot-password" className="font-semibold underline underline-offset-2">
              Request a new link
            </Link>
          </FormAlert>
        )}
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
        <PrimaryButton type="submit" icon={KeyRound} isLoading={isSubmitting} className="w-full">
          Save new password
        </PrimaryButton>
      </form>
    </div>
  )
}
