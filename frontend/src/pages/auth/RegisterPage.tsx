import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { PrimaryButton } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/FormAlert'
import { FormInput } from '../../components/ui/FormInput'
import { FormTextarea } from '../../components/ui/FormTextarea'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { useAuth } from '../../hooks/useAuth'
import { applyFieldErrors, getErrorMessage } from '../../utils/apiError'
import {
  newPasswordField,
  optionalEmailField,
  PASSWORD_HINT,
  phoneField,
  requiredText,
} from '../../utils/validation'

const registerSchema = z
  .object({
    fullName: requiredText('Enter your full name.').min(2, 'Enter your full name.'),
    phone: phoneField,
    email: optionalEmailField,
    password: newPasswordField,
    confirmPassword: z.string().min(1, 'Type your password again.'),
    address: z.object({
      fullAddress: requiredText('Enter your full address.').min(5, 'Enter your full address.'),
      area: requiredText('Enter your area or locality.').min(2, 'Enter your area or locality.'),
      city: requiredText('Enter your city.').min(2, 'Enter your city.'),
      state: requiredText('Enter your state.').min(2, 'Enter your state.'),
      pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode.'),
      deliveryInstructions: z.string().trim().max(300, 'Please keep this under 300 characters.'),
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  })

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { register: createAccount } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      address: { fullAddress: '', area: '', city: '', state: '', pincode: '', deliveryInstructions: '' },
    },
  })

  async function onSubmit({ confirmPassword: _confirmPassword, ...values }: RegisterValues) {
    setFormError(null)
    try {
      await createAccount(values)
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold text-text">Create your account</h1>
      <p className="mt-1 text-sm text-text-secondary">Request medicines from the store and get them delivered.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-6">
        {formError && <FormAlert>{formError}</FormAlert>}

        <fieldset className="space-y-4">
          <legend className="mb-3 font-heading text-base font-semibold text-text">Your details</legend>
          <FormInput label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
          <FormInput
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <FormInput
            label="Email"
            type="email"
            isOptional
            autoComplete="email"
            hint="Needed to reset your password by email if you ever forget it."
            error={errors.email?.message}
            {...register('email')}
          />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            hint={PASSWORD_HINT}
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-heading text-base font-semibold text-text">Delivery address</legend>
          <FormTextarea
            label="Full address"
            rows={2}
            autoComplete="street-address"
            placeholder="House or flat number, building, street"
            error={errors.address?.fullAddress?.message}
            {...register('address.fullAddress')}
          />
          <FormInput label="Area or locality" error={errors.address?.area?.message} {...register('address.area')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="City"
              autoComplete="address-level2"
              error={errors.address?.city?.message}
              {...register('address.city')}
            />
            <FormInput
              label="State"
              autoComplete="address-level1"
              error={errors.address?.state?.message}
              {...register('address.state')}
            />
          </div>
          <FormInput
            label="Pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            error={errors.address?.pincode?.message}
            {...register('address.pincode')}
          />
          <FormTextarea
            label="Delivery instructions"
            rows={2}
            isOptional
            placeholder="For example: ring the bell twice"
            error={errors.address?.deliveryInstructions?.message}
            {...register('address.deliveryInstructions')}
          />
        </fieldset>

        <PrimaryButton type="submit" icon={UserPlus} isLoading={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating your account...' : 'Create account'}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary-dark underline underline-offset-2 hover:text-text">
          Log in
        </Link>
      </p>
    </div>
  )
}
