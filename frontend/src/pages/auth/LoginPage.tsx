import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'
import { PrimaryButton } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/FormAlert'
import { FormCheckbox } from '../../components/ui/FormCheckbox'
import { FormInput } from '../../components/ui/FormInput'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../utils/apiError'
import { requiredText } from '../../utils/validation'

const loginSchema = z.object({
  identifier: requiredText('Enter your email or mobile number.'),
  password: z.string().min(1, 'Enter your password.'),
  rememberMe: z.boolean(),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', rememberMe: false },
  })

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    try {
      // On success the login page's guard sends each role to its own dashboard.
      await login(values)
    } catch (error) {
      setFormError(getErrorMessage(error))
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold text-text">Log in to CK Medical</h1>
      <p className="mt-1 text-sm text-text-secondary">For customers, riders and store staff.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {searchParams.get('reset') === 'done' && !formError && (
          <FormAlert tone="success">Your password has been reset. You can now log in.</FormAlert>
        )}
        {formError && <FormAlert>{formError}</FormAlert>}

        <FormInput
          label="Email or mobile number"
          autoComplete="username"
          error={errors.identifier?.message}
          {...register('identifier')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <FormCheckbox label="Remember me for 30 days" {...register('rememberMe')} />
          <Link to="/forgot-password" className="py-3 text-sm font-medium text-primary-dark underline underline-offset-2 hover:text-text">
            Forgot password?
          </Link>
        </div>

        <PrimaryButton type="submit" icon={LogIn} isLoading={isSubmitting} className="w-full">
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        New customer?{' '}
        <Link to="/register" className="font-semibold text-primary-dark underline underline-offset-2 hover:text-text">
          Create an account
        </Link>
      </p>
    </div>
  )
}
