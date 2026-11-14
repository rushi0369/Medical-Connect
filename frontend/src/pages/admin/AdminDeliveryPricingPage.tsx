import { Plus, RotateCcw, Save, Tag, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button'
import { DashboardCard } from '../../components/ui/DashboardCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { FormAlert } from '../../components/ui/FormAlert'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useToast } from '../../hooks/useToast'
import {
  fetchDeliveryPricing,
  saveDeliveryPricing,
  type DeliveryPricingTier,
} from '../../services/admin.service'
import { getErrorMessage } from '../../utils/apiError'
import { formatPaise } from '../../utils/format'

const DEFAULT_TIERS: DeliveryPricingTier[] = [
  { minKm: 0, maxKm: 2, chargePaise: 2000 },
  { minKm: 2, maxKm: 5, chargePaise: 3000 },
  { minKm: 5, maxKm: 8, chargePaise: 4000 },
  { minKm: 8, maxKm: 12, chargePaise: 6000 },
  { minKm: 12, maxKm: null, chargePaise: null },
]

export default function AdminDeliveryPricingPage() {
  const showToast = useToast()
  const { data: pricing, error, isLoading, reload } = useAsyncData(fetchDeliveryPricing, [])

  const [tiers, setTiers] = useState<DeliveryPricingTier[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (pricing?.tiers && pricing.tiers.length > 0) {
      setTiers(pricing.tiers)
    } else {
      setTiers(DEFAULT_TIERS)
    }
  }, [pricing])

  function handleAddTier() {
    if (tiers.length === 0) {
      setTiers([{ minKm: 0, maxKm: 3, chargePaise: 2000 }])
      return
    }

    const last = tiers[tiers.length - 1]
    const newMin = last.maxKm ?? last.minKm + 5

    // If last tier was unbounded, close it and add unbounded new last
    const updated = [...tiers]
    if (last.maxKm == null) {
      updated[updated.length - 1] = {
        ...last,
        maxKm: newMin,
        chargePaise: last.chargePaise ?? 5000,
      }
    }

    updated.push({
      minKm: newMin,
      maxKm: null,
      chargePaise: null,
    })

    setTiers(updated)
  }

  function handleRemoveTier(index: number) {
    if (tiers.length <= 1) {
      setFormError('At least one delivery tier is required.')
      return
    }

    const updated = tiers.filter((_, idx) => idx !== index)
    // Make sure the last tier is unbounded if desired
    setTiers(updated)
  }

  function updateTierField(index: number, field: keyof DeliveryPricingTier, value: any) {
    const updated = [...tiers]
    updated[index] = { ...updated[index], [field]: value }

    // Keep contiguous boundaries if maxKm of tier i changed
    if (field === 'maxKm' && value != null && index < updated.length - 1) {
      updated[index + 1] = { ...updated[index + 1], minKm: value }
    }

    setTiers(updated)
  }

  async function handleSave() {
    setFormError(null)

    if (tiers.length === 0) {
      setFormError('At least one delivery tier is required.')
      return
    }

    // Validation
    if (tiers[0].minKm !== 0) {
      setFormError('The first delivery tier must start at 0 km.')
      return
    }

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i]
      const isLast = i === tiers.length - 1

      if (!isLast && tier.maxKm == null) {
        setFormError(`Tier ${i + 1} must have an upper limit (max km).`)
        return
      }

      if (tier.maxKm != null && tier.maxKm <= tier.minKm) {
        setFormError(`Tier ${i + 1}: max km must be greater than min km (${tier.minKm} km).`)
        return
      }

      if (!isLast && tier.chargePaise == null) {
        setFormError(`Tier ${i + 1}: charge cannot be empty for intermediate tiers.`)
        return
      }
    }

    setIsSaving(true)
    try {
      await saveDeliveryPricing(tiers)
      showToast('Delivery pricing tiers saved successfully!', 'success')
      reload()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save delivery pricing tiers.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && !pricing) {
    return <LoadingState label="Loading delivery pricing tiers..." />
  }

  if (error && !pricing) {
    return <ErrorState message={getErrorMessage(error, 'Failed to load delivery pricing.')} onRetry={reload} />
  }

  return (
    <>
      <PageHeader
        title="Delivery Pricing Tiers"
        description="Configure road distance pricing brackets used to automatically calculate customer delivery charges."
        actions={
          <div className="flex items-center gap-2">
            <SecondaryButton
              icon={RotateCcw}
              onClick={() => {
                setTiers(DEFAULT_TIERS)
                setFormError(null)
              }}
            >
              Reset to Defaults
            </SecondaryButton>
            <PrimaryButton icon={Save} isLoading={isSaving} onClick={handleSave}>
              Save Tiers
            </PrimaryButton>
          </div>
        }
      />

      <div className="space-y-6">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <DashboardCard
          title="Distance Brackets & Delivery Rates"
          description="Automatic road distance calculation matches orders against these tiers. For orders exceeding the highest tier, charge can be entered manually."
          action={
            <SecondaryButton icon={Plus} onClick={handleAddTier}>
              Add Tier
            </SecondaryButton>
          }
        >
          <div className="overflow-x-auto rounded-control border border-border mt-3">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted/60 text-xs font-semibold text-text-secondary border-b border-border">
                <tr>
                  <th className="p-3">Bracket / Tier</th>
                  <th className="p-3">Min Distance</th>
                  <th className="p-3">Max Distance</th>
                  <th className="p-3">Delivery Charge (₹)</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tiers.map((tier, idx) => {
                  const isLast = idx === tiers.length - 1
                  const chargeInRupees = tier.chargePaise != null ? tier.chargePaise / 100 : ''

                  return (
                    <tr key={idx} className="hover:bg-surface-muted/30">
                      <td className="p-3 font-semibold text-text">
                        Tier {idx + 1}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            disabled={idx === 0}
                            value={tier.minKm}
                            onChange={(e) => updateTierField(idx, 'minKm', Number(e.target.value))}
                            className="w-20 rounded border border-border bg-background px-2.5 py-1 text-xs text-text disabled:opacity-60"
                          />
                          <span className="text-xs text-text-secondary">km</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {isLast ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={tier.minKm + 0.1}
                              step="0.5"
                              placeholder="Any (and above)"
                              value={tier.maxKm ?? ''}
                              onChange={(e) =>
                                updateTierField(
                                  idx,
                                  'maxKm',
                                  e.target.value === '' ? null : Number(e.target.value),
                                )
                              }
                              className="w-24 rounded border border-border bg-background px-2.5 py-1 text-xs text-text"
                            />
                            <span className="text-xs text-text-secondary">km (or leave empty)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={tier.minKm + 0.1}
                              step="0.5"
                              value={tier.maxKm ?? ''}
                              onChange={(e) =>
                                updateTierField(
                                  idx,
                                  'maxKm',
                                  e.target.value === '' ? null : Number(e.target.value),
                                )
                              }
                              className="w-20 rounded border border-border bg-background px-2.5 py-1 text-xs text-text"
                            />
                            <span className="text-xs text-text-secondary">km</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary font-medium">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder={isLast && tier.chargePaise == null ? 'Manual / Free' : '0'}
                            value={chargeInRupees}
                            onChange={(e) =>
                              updateTierField(
                                idx,
                                'chargePaise',
                                e.target.value === '' ? null : Math.round(Number(e.target.value) * 100),
                              )
                            }
                            className="w-28 rounded border border-border bg-background px-2.5 py-1 text-xs text-text"
                          />
                          {tier.chargePaise != null && (
                            <span className="text-xs text-success font-medium">
                              ({formatPaise(tier.chargePaise)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          disabled={tiers.length <= 1}
                          className="text-text-secondary hover:text-danger disabled:opacity-30 transition p-1"
                          title="Remove Tier"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        {/* Pricing Summary preview */}
        <DashboardCard title="Quick Preview" description="How customers will be charged based on travel distance">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tiers.map((t, i) => (
              <div key={i} className="p-3.5 rounded-control border border-border/80 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">
                    {t.maxKm != null
                      ? `${t.minKm} km - ${t.maxKm} km`
                      : `Above ${t.minKm} km`}
                  </span>
                  <Tag className="size-3.5 text-primary" />
                </div>
                <div className="mt-2 text-sm font-bold text-primary">
                  {t.chargePaise != null ? formatPaise(t.chargePaise) : 'Manual Quote / Decided by Store'}
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </>
  )
}
