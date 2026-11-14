import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { SecondaryButton } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { ROLE_HOME } from '../../routes/navigation'
import { getErrorMessage } from '../../utils/apiError'
import { ChangePasswordForm } from '../account/ChangePasswordForm'

/** Accounts given a temporary password are sent here until they choose their own. */
export default function ChangePasswordPage() {
  const { user, logout } = useAuth()
  const showToast = useToast()
  const navigate = useNavigate()

  if (!user) return null

  async function handleLogout() {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold text-text">Choose your own password</h1>
      <p className="mt-1 mb-6 text-sm text-text-secondary">
        Hello {user.fullName}. You are using a temporary password from the store, so please replace it to continue.
      </p>

      <ChangePasswordForm
        currentPasswordLabel="Temporary password"
        onChanged={() => {
          showToast('Your password has been changed.')
          navigate(ROLE_HOME[user.role], { replace: true })
        }}
      />

      <SecondaryButton icon={LogOut} onClick={handleLogout} className="mt-3 w-full">
        Log out
      </SecondaryButton>
    </div>
  )
}
