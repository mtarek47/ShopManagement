/**
 * Format number as BDT currency
 */
export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0
  return `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format date as readable string
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format datetime
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Generate invoice number: INV-YYYYMMDD-XXXXX
 */
export const generateInvoiceNo = () => {
  const date = new Date()
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '')
  const randPart = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
  return `INV-${datePart}-${randPart}`
}

/**
 * Debounce function
 */
export const debounce = (fn, delay) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Calculate discount
 */
export const applyDiscount = (price, discount, type = 'flat') => {
  if (type === 'percent') {
    return price - (price * discount) / 100
  }
  return price - discount
}

/**
 * Truncate text
 */
export const truncate = (str, n = 30) => {
  if (!str) return ''
  return str.length > n ? str.slice(0, n - 3) + '...' : str
}
