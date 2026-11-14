import { api } from '../services/api'

/**
 * Downloads an invoice PDF directly to the user's device as a binary blob.
 * This guarantees the PDF downloads properly across all browsers, cookies, and CORS modes.
 */
export async function downloadInvoicePdf(endpointUrl: string, fallbackFilename = 'Invoice.pdf') {
  try {
    const response = await api.get(endpointUrl, {
      responseType: 'blob',
    })

    const blob = new Blob([response.data], { type: 'application/pdf' })
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fallbackFilename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1500)
  } catch (error) {
    console.error('PDF download via axios blob failed, attempting direct link:', error)
    // Fallback: direct window.open
    const base = import.meta.env.VITE_API_URL || '/api'
    const fullUrl = endpointUrl.startsWith('http')
      ? endpointUrl
      : `${base.replace(/\/api$/, '')}${endpointUrl.startsWith('/') ? '' : '/'}${endpointUrl}`
    window.open(fullUrl, '_blank')
  }
}

