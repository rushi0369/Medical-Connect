import { ArrowLeft, Check, Copy, KeyRound, Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/FormAlert'
import { FormInput } from '../../components/ui/FormInput'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { requestPasswordReset, resetPassword } from '../../services/auth.service'
import { getErrorMessage } from '../../utils/apiError'
import { PASSWORD_HINT } from '../../utils/validation'

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // State
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [identifier, setIdentifier] = useState(searchParams.get('identifier') || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Details returned from Step 1
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [returnedOtp, setReturnedOtp] = useState<string | null>(null)
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null)
  const [hasCopiedOtp, setHasCopiedOtp] = useState(false)

  // STEP 1: Request OTP / Verification Code
  async function handleRequestCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!identifier.trim()) {
      setError('Please enter your mobile number or email address.')
      return
    }

    try {
      setIsLoading(true)
      const res = await requestPasswordReset(identifier.trim())
      const data = res.data

      setMaskedPhone(data?.maskedPhone || null)
      setReturnedOtp(data?.otp || null)
      setWhatsappUrl(data?.whatsappUrl || null)

      // Auto-fill OTP in demo/direct mode for convenience
      if (data?.otp) {
        setOtp(data.otp)
      }

      setSuccessMessage(
        res.message ||
          `Verification code generated for ${data?.maskedPhone || identifier}. Enter the 6-digit code below to choose your new password.`
      )
      setStep('verify')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to request password reset. Please check your mobile/email.'))
    } finally {
      setIsLoading(false)
    }
  }

  // STEP 2: Verify OTP & Reset Password
  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.')
      return
    }

    if (!newPassword) {
      setError('Please enter your new password.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must contain at least one letter and one number.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }

    try {
      setIsLoading(true)
      await resetPassword({
        identifier: identifier.trim(),
        otp: otp.trim(),
        newPassword,
      })

      setSuccessMessage('🎉 Password reset successfully! Redirecting you to login...')
      setTimeout(() => {
        navigate('/login?reset=done', { replace: true })
      }, 1500)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset password. Please check your verification code.'))
    } finally {
      setIsLoading(false)
    }
  }

  function handleCopyOtp() {
    if (!returnedOtp) return
    navigator.clipboard.writeText(returnedOtp)
    setHasCopiedOtp(true)
    setTimeout(() => setHasCopiedOtp(false), 2000)
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex size-10 items-center justify-center rounded-control bg-primary-subtle text-primary">
          <KeyRound className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">Reset Password</h1>
          <p className="text-xs text-text-secondary">CK Medical Pharmacy & Chemist</p>
        </div>
      </div>

      {step === 'request' ? (
        <>
          <p className="mt-2 text-sm text-text-secondary">
            Enter your registered mobile number or email. We will generate a secure 6-digit verification code so you
            can set a new password right away.
          </p>

          <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
            {error && <FormAlert tone="error">{error}</FormAlert>}
            {successMessage && <FormAlert tone="success">{successMessage}</FormAlert>}

            <FormInput
              label="Mobile Number or Email"
              placeholder="e.g. 9876543210 or yourname@gmail.com"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              hint="You can use your 10-digit mobile number or email."
            />

            <PrimaryButton type="submit" icon={Mail} isLoading={isLoading} className="w-full">
              Send Verification Code
            </PrimaryButton>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-text-secondary">
            <span>Remembered your password?</span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:text-primary-dark"
            >
              <ArrowLeft className="size-3.5" />
              Back to log in
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-text-secondary">
            A 6-digit verification code has been generated for{' '}
            <strong className="text-text">{maskedPhone || identifier}</strong>.
          </p>

          {/* Quick OTP Card & WhatsApp Option */}
          {returnedOtp && (
            <div className="mt-4 rounded-control border border-primary/30 bg-primary-subtle/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="size-4" />
                  Instant Reset Code:
                </span>
                <span className="text-[11px] text-text-secondary">Valid for 15 mins</span>
              </div>

              <div className="flex items-center justify-between gap-3 bg-surface rounded-control p-2.5 border border-border">
                <code className="text-xl font-mono font-bold tracking-widest text-primary pl-2">
                  {returnedOtp}
                </code>
                <div className="flex items-center gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={handleCopyOtp}
                    icon={hasCopiedOtp ? Check : Copy}
                    className="text-xs py-1 px-2.5"
                  >
                    {hasCopiedOtp ? 'Copied' : 'Copy'}
                  </SecondaryButton>
                  {otp !== returnedOtp && (
                    <button
                      type="button"
                      onClick={() => setOtp(returnedOtp)}
                      className="text-xs text-primary font-medium hover:underline px-2"
                    >
                      Fill Code
                    </button>
                  )}
                </div>
              </div>

              {whatsappUrl && (
                <div className="pt-1">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-[#25D366] hover:bg-[#20ba59] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
                  >
                    <MessageCircle className="size-4" />
                    <span>Open / Receive on WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
            {error && <FormAlert tone="error">{error}</FormAlert>}
            {successMessage && <FormAlert tone="success">{successMessage}</FormAlert>}

            <FormInput
              label="6-Digit Verification Code (OTP)"
              placeholder="e.g. 123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              hint="Enter the 6-digit code shown above or received on WhatsApp."
            />

            <PasswordInput
              label="New Password"
              autoComplete="new-password"
              hint={PASSWORD_HINT}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <PasswordInput
              label="Confirm New Password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <PrimaryButton type="submit" icon={KeyRound} isLoading={isLoading} className="w-full">
              Reset Password & Log In
            </PrimaryButton>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('request')
                  setError(null)
                  setSuccessMessage(null)
                }}
                className="text-xs text-text-secondary hover:text-text underline"
              >
                Change mobile / email
              </button>
              <Link to="/login" className="text-xs text-primary font-medium hover:underline">
                Back to log in
              </Link>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
