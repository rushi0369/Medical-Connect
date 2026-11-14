import { zodResolver } from '@hookform/resolvers/zod'
import { Save, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { PrimaryButton } from '../../components/ui/Button'
import { secondaryButtonClasses } from '../../components/ui/buttonStyles'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { FormAlert } from '../../components/ui/FormAlert'
import { FormInput } from '../../components/ui/FormInput'
import { FormTextarea } from '../../components/ui/FormTextarea'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import { createRider, fetchRider, updateRider } from '../../services/rider.service'
import type { Rider } from '../../types/user'
import { applyFieldErrors, getErrorMessage } from '../../utils/apiError'
import { optionalEmailField, phoneField, requiredText } from '../../utils/validation'
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog'

const riderSchema = z.object({
  fullName: requiredText('Enter the rider\'s full name.').min(2, 'Enter the rider\'s full name.'),
  phone: phoneField,
  email: optionalEmailField,
  vehicleNumber: z.string().trim().max(20, 'That vehicle number is too long.'),
  notes: z.string().trim().max(500, 'Please keep notes under 500 characters.'),
})

type RiderValues = z.infer<typeof riderSchema>

const RIDERS_PATH = '/admin/riders'

export default function RiderFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const showToast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ rider: Rider; temporaryPassword: string } | null>(null)

  const existing = useAsyncData<Rider | null>(
    (signal) => (id ? fetchRider(id, signal) : Promise.resolve(null)),
    [id],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RiderValues>({
    resolver: zodResolver(riderSchema),
    defaultValues: { fullName: '', phone: '', email: '', vehicleNumber: '', notes: '' },
  })

  useEffect(() => {
    if (!existing.data) return
    reset({
      fullName: existing.data.fullName,
      phone: existing.data.phone,
      email: existing.data.email ?? '',
      vehicleNumber: existing.data.riderProfile.vehicleNumber ?? '',
      notes: existing.data.riderProfile.notes ?? '',
    })
  }, [existing.data, reset])

  async function onSubmit(values: RiderValues) {
    setFormError(null)
    try {
      if (id) {
        await updateRider(id, values)
        showToast('Rider details have been saved.')
        navigate(RIDERS_PATH)
      } else {
        setCreated(await createRider(values))
      }
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  const title = isEditing ? 'Edit rider' : 'Add rider'

  return (
    <>
      <PageHeader
        title={title}
        description={
          isEditing
            ? `Rider ID: ${existing.data?.riderProfile.riderId ?? '...'}`
            : 'Create a login for a new rider. Riders cannot sign up by themselves.'
        }
        breadcrumbs={[
          { label: 'Dashboard', to: '/admin' },
          { label: 'Rider Management', to: RIDERS_PATH },
          { label: title },
        ]}
      />

      <div className="max-w-2xl">
        <DashboardCard>
          {existing.error ? (
            <ErrorState message={getErrorMessage(existing.error)} onRetry={existing.reload} />
          ) : isEditing && existing.isLoading ? (
            <LoadingState label="Loading rider..." />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {formError && <FormAlert>{formError}</FormAlert>}

              <FormInput label="Full name" error={errors.fullName?.message} {...register('fullName')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  label="Mobile number"
                  type="tel"
                  inputMode="tel"
                  hint="The rider logs in with this."
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <FormInput label="Email" type="email" isOptional error={errors.email?.message} {...register('email')} />
              </div>
              <FormInput
                label="Vehicle number"
                isOptional
                placeholder="For example: GJ05AB1234"
                error={errors.vehicleNumber?.message}
                {...register('vehicleNumber')}
              />
              <FormTextarea label="Notes" isOptional rows={3} error={errors.notes?.message} {...register('notes')} />

              <div className="flex flex-wrap gap-2 pt-2">
                <PrimaryButton type="submit" icon={isEditing ? Save : UserPlus} isLoading={isSubmitting}>
                  {isEditing ? 'Save changes' : 'Create rider'}
                </PrimaryButton>
                <Link to={RIDERS_PATH} className={secondaryButtonClasses}>
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </DashboardCard>
      </div>

      <TemporaryPasswordDialog
        title="Rider account created"
        rider={created?.rider ?? null}
        temporaryPassword={created?.temporaryPassword ?? null}
        onClose={() => navigate(RIDERS_PATH)}
      />
    </>
  )
}
