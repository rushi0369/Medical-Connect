const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })

/** All money is stored in whole paise. Rs 330.50 is stored as 33050. */
export const formatPaise = (paise: number) => rupees.format(paise / 100)

export const formatDateTime = (value: string) => dateTime.format(new Date(value))
export const formatDate = (value: string) => dateOnly.format(new Date(value))

export function initialsOf(fullName: string) {
  const words = fullName.trim().split(/\s+/)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}
