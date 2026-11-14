import { Check, QrCode, Upload } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { PrimaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { FormAlert } from '../../components/ui/FormAlert'
import { FormInput } from '../../components/ui/FormInput'
import { FormTextarea } from '../../components/ui/FormTextarea'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchStoreSettings, saveStoreSettings } from '../../services/admin.service'
import { getErrorMessage } from '../../utils/apiError'

export default function AdminSettingsPage() {
  const { data: initialSettings, error: fetchError, isLoading, reload } = useAsyncData(fetchStoreSettings, [])

  const [storeName, setStoreName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [upiId, setUpiId] = useState('')
  const [fullAddress, setFullAddress] = useState('')
  const [area, setArea] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [lat, setLat] = useState<string>('')
  const [lng, setLng] = useState<string>('')

  const [qrFile, setQrFile] = useState<File | null>(null)
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialSettings) {
      setStoreName(initialSettings.storeName || '')
      setContactPhone(initialSettings.contactPhone || '')
      setUpiId(initialSettings.upiId || '')
      if (initialSettings.address) {
        setFullAddress(initialSettings.address.fullAddress || '')
        setArea(initialSettings.address.area || '')
        setCity(initialSettings.address.city || '')
        setState(initialSettings.address.state || '')
        setPincode(initialSettings.address.pincode || '')
        if (initialSettings.address.location) {
          setLat(initialSettings.address.location.lat != null ? String(initialSettings.address.location.lat) : '')
          setLng(initialSettings.address.location.lng != null ? String(initialSettings.address.location.lng) : '')
        }
      }
    }
  }, [initialSettings])

  useEffect(() => {
    if (!qrFile) {
      setQrPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(qrFile)
    setQrPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [qrFile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!storeName.trim()) {
      setErrorMessage('Store name is required.')
      return
    }

    try {
      setIsSubmitting(true)
      const formData = new FormData()
      formData.append('storeName', storeName.trim())
      if (contactPhone.trim()) formData.append('contactPhone', contactPhone.trim())
      if (upiId.trim()) formData.append('upiId', upiId.trim())

      const addressObj: {
        fullAddress: string
        area: string
        city: string
        state: string
        pincode: string
        location?: { lat: number; lng: number }
      } = {
        fullAddress: fullAddress.trim(),
        area: area.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
      }
      if (lat.trim() && lng.trim() && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
        addressObj.location = {
          lat: Number(lat.trim()),
          lng: Number(lng.trim()),
        }
      }
      formData.append('address', JSON.stringify(addressObj))

      if (qrFile) {
        formData.append('upiQr', qrFile)
      }

      await saveStoreSettings(formData)
      setSuccessMessage('Store settings and UPI QR code saved successfully!')
      setQrFile(null)
      reload()
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Failed to save store settings.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !initialSettings) {
    return <LoadingState label="Loading store settings..." />
  }

  if (fetchError && !initialSettings) {
    return <ErrorState message={getErrorMessage(fetchError, 'Failed to load store settings.')} onRetry={reload} />
  }

  const existingQrUrl = initialSettings?.upiQrUrl

  return (
    <>
      <PageHeader
        title="Store Settings & UPI QR"
        description="Configure your pharmacy profile, location, and the UPI QR code shown to customers and delivery riders for instant payments."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {successMessage && <FormAlert tone="success">{successMessage}</FormAlert>}
        {errorMessage && <FormAlert tone="error">{errorMessage}</FormAlert>}

        {/* UPI QR & Payment Section */}
        <DashboardCard
          title="Store UPI QR Code & Payment Setup"
          description="Upload your pharmacy UPI QR code image. Customers and riders can scan this directly to make payments without any third-party payment gateway."
        >
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <FormInput
                  label="Store UPI ID (VPA)"
                  placeholder="e.g. ckmedical@okaxis or yourpharmacy@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  hint="Your UPI ID will be displayed alongside the QR code."
                />

                <div className="mt-4">
                  <label className="block text-sm font-medium text-text mb-2">
                    Upload UPI QR Code Image
                  </label>
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-control hover:border-primary/60 transition cursor-pointer bg-card/50">
                    <QrCode className="size-8 text-primary mb-2" />
                    <span className="text-sm font-medium text-text">
                      {qrFile ? qrFile.name : 'Choose a QR Code image (JPG, PNG, WEBP)'}
                    </span>
                    <span className="text-xs text-text-secondary mt-1">Maximum size 10MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setQrFile(file)
                      }}
                    />
                  </label>
                  {qrFile && (
                    <p className="mt-2 text-xs text-success flex items-center gap-1">
                      <Check className="size-3.5" /> Selected: {qrFile.name} (will be saved when you click Save Settings)
                    </p>
                  )}
                </div>
              </div>

              {/* QR Preview Card */}
              <div className="flex flex-col items-center justify-center p-6 rounded-control border border-border bg-card">
                <p className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <QrCode className="size-4 text-primary" />
                  Live QR Preview
                </p>
                {qrPreviewUrl ? (
                  <div className="text-center">
                    <img
                      src={qrPreviewUrl}
                      alt="Selected QR Preview"
                      className="size-56 object-contain rounded-control border border-border/80 shadow-sm p-2 bg-white mx-auto"
                    />
                    <p className="text-xs text-primary font-medium mt-2">New QR image preview</p>
                  </div>
                ) : existingQrUrl ? (
                  <div className="text-center">
                    <img
                      src={existingQrUrl}
                      alt="Current UPI QR Code"
                      className="size-56 object-contain rounded-control border border-border/80 shadow-sm p-2 bg-white mx-auto"
                    />
                    <p className="text-xs text-text-secondary mt-2">Current Active Store QR</p>
                  </div>
                ) : (
                  <div className="size-56 flex flex-col items-center justify-center rounded-control border border-dashed border-border text-text-secondary text-center p-4">
                    <QrCode className="size-12 opacity-30 mb-2" />
                    <p className="text-xs">No QR code uploaded yet.</p>
                    <p className="text-xs text-text-secondary mt-1">Upload an image to show it to customers & riders.</p>
                  </div>
                )}
                {upiId && (
                  <p className="mt-3 text-xs font-mono bg-background px-3 py-1 rounded border border-border text-text">
                    UPI ID: {upiId}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DashboardCard>

        {/* Store Profile Section */}
        <DashboardCard title="Pharmacy Profile" description="General details printed on customer invoices and receipts.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <FormInput
              label="Store / Pharmacy Name"
              placeholder="e.g. CK Medical Store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />
            <FormInput
              label="Contact Phone"
              placeholder="e.g. +91 98765 43210"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
        </DashboardCard>

        {/* Store Address Section */}
        <DashboardCard title="Store Address" description="The physical location used to calculate delivery distance.">
          <div className="space-y-4 pt-2">
            <FormTextarea
              label="Full Address (Street / Building)"
              placeholder="Shop No. 4, Ground Floor, Health Square, Near City Hospital..."
              rows={2}
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <FormInput
                label="Area / Locality"
                placeholder="e.g. Navrangpura"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
              <FormInput
                label="City"
                placeholder="e.g. Ahmedabad"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <FormInput
                label="State"
                placeholder="e.g. Gujarat"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
              <FormInput
                label="Pincode"
                placeholder="e.g. 394110"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <FormInput
                label="Latitude (GPS)"
                placeholder="e.g. 21.4035"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                hint="Used as store start point for road distance calculation."
              />
              <FormInput
                label="Longitude (GPS)"
                placeholder="e.g. 72.9274"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                hint="Used as store start point for road distance calculation."
              />
            </div>
          </div>
        </DashboardCard>

        <div className="flex justify-end pt-2">
          <PrimaryButton type="submit" isLoading={isSubmitting} icon={Upload}>
            Save Store Settings
          </PrimaryButton>
        </div>
      </form>
    </>
  )
}
