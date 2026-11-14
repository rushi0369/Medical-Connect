import { Edit2, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { ROLE_LABEL } from '../../routes/navigation'
import type { SavedAddress } from '../../types/user'
import { ChangePasswordForm } from './ChangePasswordForm'
import { EditProfileModal } from './EditProfileModal'

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-text">{value}</dd>
    </div>
  )
}

function AddressCard({ address }: { address: SavedAddress }) {
  return (
    <li className="rounded-control border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-heading text-sm font-semibold text-text">{address.label}</span>
        {address.isDefault && <StatusBadge tone="success">Default</StatusBadge>}
      </div>
      <p className="mt-2 text-sm text-text">{address.fullAddress}</p>
      <p className="text-sm text-text-secondary">
        {address.area}, {address.city}, {address.state} {address.pincode}
      </p>
      {address.deliveryInstructions && (
        <p className="mt-2 text-sm text-text-secondary">Instructions: {address.deliveryInstructions}</p>
      )}
    </li>
  )
}

/** The profile page for all three roles. */
export default function AccountPage({ title }: { title: string }) {
  const { user } = useAuth()
  const showToast = useToast()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  if (!user) return null

  return (
    <>
      <PageHeader title={title} description="Your account details and password." />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <DashboardCard
            title="Account details"
            action={
              user.role === 'CUSTOMER' ? (
                <SecondaryButton
                  icon={Edit2}
                  className="py-1 px-2.5 text-xs"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  Edit Profile
                </SecondaryButton>
              ) : undefined
            }
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Full name" value={user.fullName} />
              <Detail label="Account type" value={ROLE_LABEL[user.role]} />
              <Detail label="Mobile number" value={user.phone} />
              <Detail label="Email" value={user.email ?? 'Not added'} />
              {user.riderProfile && (
                <>
                  <Detail label="Rider ID" value={user.riderProfile.riderId} />
                  <Detail label="Vehicle number" value={user.riderProfile.vehicleNumber ?? 'Not added'} />
                </>
              )}
            </dl>
          </DashboardCard>

          {user.role === 'CUSTOMER' && (
            <DashboardCard
              title="Saved addresses"
              action={
                <Link
                  to="/customer/addresses"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Manage addresses →
                </Link>
              }
            >
              {user.addresses?.length ? (
                <ul className="space-y-3">
                  {user.addresses.map((address) => (
                    <AddressCard key={address.id} address={address} />
                  ))}
                </ul>
              ) : (
                <EmptyState icon={MapPin} title="No saved addresses" />
              )}
            </DashboardCard>
          )}
        </div>

        <DashboardCard title="Change password" description="This logs you out on your other devices.">
          <ChangePasswordForm onChanged={() => showToast('Your password has been changed.', 'success')} />
        </DashboardCard>
      </div>

      {isEditModalOpen && (
        <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      )}
    </>
  )
}
