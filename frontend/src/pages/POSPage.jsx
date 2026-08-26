import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import useAuthStore from '../hooks/useAuthStore'
import { formatCurrency, generateInvoiceNo } from '../utils/helpers'
import toast from 'react-hot-toast'
import ThermalReceipt from '../components/ThermalReceipt'

// Fast Cash Tender Shortcuts
const FAST_CASH = [50, 100, 200, 500, 1000, 2000]

// Common Grocery Weight / Quantity Quick Presets
const QUICK_QTY_PRESETS = [
  { label: '250g (0.25)', val: 0.25 },
  { label: '500g (0.5)', val: 0.5 },
  { label: '1 kg', val: 1.0 },
  { label: '1.5 kg', val: 1.5 },
  { label: '2 kg', val: 2.0 },
  { label: '5 kg', val: 5.0 },
  { label: '1 pc', val: 1.0 },
  { label: '4 pcs (হালি)', val: 4.0 },
]

// Payment Method Labels
const PAYMENT_METHODS = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'ROCKET', 'STORE_CREDIT']

export default function POSPage() {
  const { user } = useAuthStore()

  // Loose / Non-Barcoded Catalog for Bottom Strip
  const [looseCatalog, setLooseCatalog] = useState([])
  const [categories, setCategories] = useState([])
  const [activeBottomCategory, setActiveBottomCategory] = useState('ALL')
  const [loadingLoose, setLoadingLoose] = useState(true)

  // Live Auto-Suggestion State for Input Bar
  const [itemQuery, setItemQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0)
  const [manualQty, setManualQty] = useState('1')

  // Cart State
  const [cart, setCart] = useState([])
  const [billDiscount, setBillDiscount] = useState(0)
  const [billDiscountType, setBillDiscountType] = useState('flat')
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [notes, setNotes] = useState('')

  // Payment state
  const [payments, setPayments] = useState([{ method: 'CASH', amount: '' }])

  // UI state
  const [showHelp, setShowHelp] = useState(false)
  const [showHeldCarts, setShowHeldCarts] = useState(false)
  const [heldCarts, setHeldCarts] = useState([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showOpenItemModal, setShowOpenItemModal] = useState(false)
  const [openItemForm, setOpenItemForm] = useState({ name: '', price: '', qty: '1', unit: 'pcs' })
  const [returnInvoice, setReturnInvoice] = useState('')
  const [returnSale, setReturnSale] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  const searchInputRef = useRef(null)
  const qtyInputRef = useRef(null)
  const suggestionsRef = useRef(null)

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const discountAmount =
    billDiscountType === 'percent'
      ? (subtotal * billDiscount) / 100
      : parseFloat(billDiscount) || 0
  const total = Math.max(0, subtotal - discountAmount)
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const change = totalPaid - total

  // Initial Load
  useEffect(() => {
    fetchInitialData()
    searchInputRef.current?.focus()
  }, [])

  const fetchInitialData = async () => {
    setLoadingLoose(true)
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products?limit=100'),
      ])
      setCategories(catRes.data.data || [])
      setLooseCatalog(prodRes.data.data?.products || [])
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoadingLoose(false)
    }
  }

  // Live Auto-Suggestion Search as user types
  useEffect(() => {
    const query = itemQuery.trim()
    if (query.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/products/search?q=${encodeURIComponent(query)}`)
        const results = res.data.data || []
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSelectedSuggestionIdx(0)
      } catch {
        /* silent */
      }
    }, 60)

    return () => clearTimeout(timer)
  }, [itemQuery])

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        if (cart.length > 0) {
          setPayments([{ method: 'CASH', amount: total.toString() }])
          setShowPaymentModal(true)
        } else {
          toast.error('Cart is empty!')
        }
      }
      if (e.key === 'F4') { e.preventDefault(); holdCart() }
      if (e.key === 'F8') { e.preventDefault(); fetchHeldCarts(); setShowHeldCarts(true) }
      if (e.key === 'Escape') {
        if (showSuggestions) {
          setShowSuggestions(false)
        } else {
          e.preventDefault()
          clearCart()
        }
      }
      if (e.key === '?' && e.target.tagName !== 'INPUT') { setShowHelp(true) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cart, total, showSuggestions])

  // Search Input Keydown (Arrow navigation + Enter)
  const handleSearchKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIdx((prev) => (prev + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const selected = suggestions[selectedSuggestionIdx]
        if (selected) {
          handleSelectProduct(selected)
        }
        return
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      handleDirectSubmit()
    }
  }

  const handleSelectProduct = (product) => {
    const qty = parseFloat(manualQty) || 1
    addToCart(product, qty)
    setItemQuery('')
    setShowSuggestions(false)
    setManualQty('1')
    searchInputRef.current?.focus()
  }

  const handleDirectSubmit = async () => {
    const q = itemQuery.trim()
    if (!q) return

    try {
      const res = await api.get(`/products/search?q=${encodeURIComponent(q)}`)
      const products = res.data.data || []
      if (products.length > 0) {
        handleSelectProduct(products[0])
      } else {
        toast.error(`Item not found: "${q}"`)
      }
    } catch {
      toast.error('Search error')
    }
  }

  const addToCart = (product, initialQty = 1) => {
    if (parseFloat(product.currentStock) <= 0) {
      toast.error(`"${product.name}" is out of stock!`)
      return
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        const newQty = existing.qty + initialQty
        if (newQty > parseFloat(product.currentStock)) {
          toast.error(`Only ${product.currentStock} ${product.unit} available in stock!`)
          return prev
        }
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, qty: newQty, subtotal: newQty * (parseFloat(i.unitPrice) - parseFloat(i.discountAmount)) }
            : i
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          barcode: product.barcode || product.sku || 'Loose',
          brand: product.brand?.name || '',
          unit: product.unit || 'pcs',
          unitPrice: parseFloat(product.salePrice),
          discountAmount: 0,
          qty: initialQty,
          maxStock: parseFloat(product.currentStock),
          subtotal: initialQty * parseFloat(product.salePrice),
        },
      ]
    })
    toast.success(`+ ${product.name} (${initialQty} ${product.unit || 'pcs'})`, { duration: 800 })
  }

  const handleAddOpenItem = (e) => {
    e.preventDefault()
    if (!openItemForm.name || !openItemForm.price) {
      return toast.error('Item name and price required')
    }
    const price = parseFloat(openItemForm.price)
    const qty = parseFloat(openItemForm.qty) || 1
    const dummyId = `custom-${Date.now()}`

    setCart((prev) => [
      ...prev,
      {
        productId: dummyId,
        name: openItemForm.name,
        barcode: 'OPEN-ITEM',
        brand: 'Misc',
        unit: openItemForm.unit,
        unitPrice: price,
        discountAmount: 0,
        qty: qty,
        maxStock: 9999,
        subtotal: qty * price,
      },
    ])
    setShowOpenItemModal(false)
    setOpenItemForm({ name: '', price: '', qty: '1', unit: 'pcs' })
    toast.success('Custom item added to cart')
  }

  const updateCartItem = (productId, field, value) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item
        const updated = { ...item, [field]: parseFloat(value) || 0 }
        if (field === 'qty' && updated.qty > item.maxStock) {
          toast.error(`Stock available: ${item.maxStock} ${item.unit}`)
          return item
        }
        updated.subtotal = Math.max(0, updated.qty * (updated.unitPrice - updated.discountAmount))
        return updated
      })
    )
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const clearCart = () => {
    setCart([])
    setPayments([{ method: 'CASH', amount: '' }])
    setBillDiscount(0)
    setSelectedCustomer(null)
    setCustomerSearch('')
    setNotes('')
    setItemQuery('')
    setManualQty('1')
    searchInputRef.current?.focus()
  }

  const holdCart = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    try {
      await api.post('/sales/hold', {
        label: `Cart (${cart.length} items) - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        cartJson: { cart, billDiscount, billDiscountType, customerId, selectedCustomer }
      })
      toast.success('Cart suspended [F8 to resume]')
      clearCart()
    } catch {
      toast.error('Failed to hold cart')
    }
  }

  const fetchHeldCarts = async () => {
    try {
      const res = await api.get('/sales/held-carts')
      setHeldCarts(res.data.data || [])
    } catch { /* silent */ }
  }

  const resumeCart = async (held) => {
    const { cart: c, billDiscount: bd, billDiscountType: bdt, customerId: cid, selectedCustomer: sc } = held.cartJson
    setCart(c || [])
    setBillDiscount(bd || 0)
    setBillDiscountType(bdt || 'flat')
    if (cid) setCustomerId(cid)
    if (sc) setSelectedCustomer(sc)
    await api.delete(`/sales/held-carts/${held.id}`)
    setShowHeldCarts(false)
    toast.success('Cart restored')
  }

  const searchCustomer = async () => {
    if (!customerSearch.trim()) return
    try {
      const res = await api.get(`/customers?search=${encodeURIComponent(customerSearch.trim())}&limit=5`)
      const customers = res.data.data?.customers || []
      if (customers.length >= 1) {
        setSelectedCustomer(customers[0])
        setCustomerId(customers[0].id)
        toast.success(`Customer: ${customers[0].name}`)
      } else {
        toast.error('Customer not found')
      }
    } catch { /* silent */ }
  }

  const submitSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (totalPaid < total) { toast.error('Payment amount is less than total bill'); return }

    setLoading(true)
    try {
      const validItems = cart.filter(i => !i.productId.startsWith('custom-'))
      const payload = {
        items: (validItems.length > 0 ? validItems : cart).map((i) => ({
          productId: i.productId.startsWith('custom-') ? looseCatalog[0]?.id || i.productId : i.productId,
          qty: i.qty,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
          subtotal: i.subtotal,
        })),
        subtotal,
        discountAmount,
        totalAmount: total,
        customerId: customerId || null,
        payments: payments.filter((p) => parseFloat(p.amount) > 0),
        notes,
      }
      const res = await api.post('/sales', payload)
      setLastReceipt(res.data.data)
      setShowPaymentModal(false)
      setShowReceiptModal(true)
      clearCart()
      fetchInitialData()
      toast.success(`Sale completed! Invoice: ${res.data.data.invoiceNo}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  const nonBarcodeItems = looseCatalog.filter((p) => {
    const isLoose = !p.barcode || p.unit === 'kg' || p.unit === 'litre' || p.unit === 'hali'
    if (!isLoose) return false
    if (activeBottomCategory === 'ALL') return true
    return p.categoryId === activeBottomCategory
  })

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 overflow-hidden font-sans select-none">
      {/* ─── LEFT/CENTER: ORGANIZED COMFORTABLE CASHIER TERMINAL ───────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-slate-100 p-3.5 space-y-3">
        {/* ─── TOP COMMAND CONSOLE (COMFORTABLE PADDING & CENTERED FEEL) ─────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft-sm shrink-0 z-30 space-y-3">
          {/* Header Title + Action Pills */}
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                ⚡ Fast Billing Counter
              </span>
              <span className="badge badge-gray text-[9px] py-0 px-1.5 font-mono">READY</span>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowOpenItemModal(true)}
                className="btn-secondary text-xs py-1 px-2.5 text-indigo-700 border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 font-semibold"
              >
                + Custom Item
              </button>
              <button
                onClick={holdCart}
                className="btn-secondary text-xs py-1 px-2 text-amber-700 hover:bg-amber-50 border-amber-200"
              >
                <span className="kbd-badge text-amber-700">F4</span> Hold
              </button>
              <button
                onClick={() => { fetchHeldCarts(); setShowHeldCarts(true) }}
                className="btn-secondary text-xs py-1 px-2"
              >
                <span className="kbd-badge">F8</span> Resume
              </button>
              <button
                onClick={() => setShowReturnModal(true)}
                className="btn-secondary text-xs py-1 px-2 text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                Return
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="btn-secondary w-7 h-7 p-0 text-center font-bold text-slate-500"
              >
                ?
              </button>
            </div>
          </div>

          {/* Primary Search & Quantity Entry Bar */}
          <div className="flex items-center gap-2.5">
            {/* Live Autocomplete Search Input */}
            <div className="relative flex-1">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  className="input text-xs font-medium pl-9 pr-8 py-2.5 w-full border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 text-slate-900"
                  placeholder="Type product name (আলু, চাল, egg, dal...), barcode or SKU..."
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                />
                <span className="absolute left-3 top-3 text-xs text-slate-400">🔍</span>
                {itemQuery && (
                  <button
                    onClick={() => { setItemQuery(''); setSuggestions([]); setShowSuggestions(false) }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* ─── LIVE AUTO-SUGGESTION POPUP ─────────────────────────────── */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-72 overflow-y-auto divide-y divide-slate-100 z-50"
                >
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                    <span>Matching Suggestions ({suggestions.length})</span>
                    <span>Use ↑↓ keys + Enter</span>
                  </div>
                  {suggestions.map((p, idx) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                        idx === selectedSuggestionIdx ? 'bg-indigo-50 text-indigo-950 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          {p.name}
                          {!p.barcode && (
                            <span className="badge badge-yellow text-[8px] py-0 px-1">LOOSE</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {p.category?.name} • Stock: <span className="font-bold text-slate-700">{p.currentStock} {p.unit}</span>
                          {p.barcode && <span className="font-mono ml-2 text-slate-400">[{p.barcode}]</span>}
                        </div>
                      </div>
                      <div className="text-right pl-3">
                        <div className="font-extrabold text-xs text-indigo-700">
                          {formatCurrency(p.salePrice)}
                          <span className="text-[10px] text-slate-400 font-normal">/{p.unit}</span>
                        </div>
                        <span className="text-[10px] text-indigo-600 font-semibold underline">
                          + Add ({manualQty} {p.unit})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity / Weight Input Field */}
            <div className="flex items-center gap-1 shrink-0 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 pl-1">Weight/Qty:</span>
              <input
                ref={qtyInputRef}
                type="number"
                step="0.05"
                min="0.05"
                className="w-20 text-center input py-1 text-xs font-mono font-bold bg-white text-indigo-700 border-slate-300"
                value={manualQty}
                onChange={(e) => setManualQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleDirectSubmit()
                  }
                }}
              />
            </div>

            {/* Direct Add Button */}
            <button
              onClick={handleDirectSubmit}
              className="btn-primary text-xs py-2.5 px-4 shadow-soft-sm shrink-0 font-bold"
            >
              + Add [Enter]
            </button>
          </div>

          {/* Quick Quantity Presets Strip */}
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0 mr-1">
              Quick Presets:
            </span>
            {QUICK_QTY_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setManualQty(p.val.toString())
                  qtyInputRef.current?.focus()
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap ${
                  parseFloat(manualQty) === p.val
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-soft-sm font-bold'
                    : 'bg-slate-50 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── MAIN CART TABLE (COMFORTABLE EYE-LEVEL LIST) ──────────────────── */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-soft-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-3xl mb-2 shadow-soft-sm">
                  🛒
                </div>
                <p className="text-sm font-bold text-slate-700">Billing Cart is Empty</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Type item name/barcode above, or select non-barcoded items from the bottom drawer
                </p>
              </div>
            ) : (
              <div>
                {/* Cart Table Header */}
                <div className="flex justify-between items-center px-4 py-2 bg-slate-100 border border-slate-200 rounded-t-xl text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <span className="w-10">#</span>
                  <span className="flex-1">Product Description</span>
                  <span className="w-36 text-center">Weight / Quantity</span>
                  <span className="w-24 text-right">Unit Rate</span>
                  <span className="w-20 text-center">Disc (৳)</span>
                  <span className="w-28 text-right">Subtotal</span>
                  <span className="w-8"></span>
                </div>

                {/* Items */}
                <div className="border-x border-b border-slate-200 rounded-b-xl divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <div
                      key={item.productId}
                      className="px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50/80 transition-colors text-xs"
                    >
                      <span className="w-10 font-mono text-slate-400 text-[11px] font-semibold">{idx + 1}</span>

                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {item.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="badge badge-gray text-[8px] py-0 px-1">{item.unit}</span>
                          {item.brand && <span className="text-slate-500 font-medium">[{item.brand}]</span>}
                          <span className="font-mono text-slate-400">{item.barcode}</span>
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="w-36 flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateCartItem(item.productId, 'qty', Math.max(0.05, item.qty - (item.unit === 'kg' ? 0.25 : 1)))}
                          className="w-6 h-6 rounded bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                        >−</button>
                        <input
                          type="number"
                          step={item.unit === 'kg' || item.unit === 'litre' ? '0.05' : '1'}
                          min="0.05"
                          max={item.maxStock}
                          className="w-16 text-center bg-white border border-slate-300 rounded text-xs font-bold py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-indigo-700"
                          value={item.qty}
                          onChange={(e) => updateCartItem(item.productId, 'qty', e.target.value)}
                        />
                        <button
                          onClick={() => updateCartItem(item.productId, 'qty', item.qty + (item.unit === 'kg' ? 0.25 : 1))}
                          className="w-6 h-6 rounded bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                        >+</button>
                      </div>

                      {/* Rate */}
                      <div className="w-24 text-right font-bold text-slate-700 text-xs font-mono">
                        {formatCurrency(item.unitPrice)}
                      </div>

                      {/* Line Discount */}
                      <div className="w-20 text-center">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-14 text-center bg-white border border-slate-300 rounded text-xs text-rose-600 font-semibold py-0.5"
                          value={item.discountAmount || ''}
                          onChange={(e) => updateCartItem(item.productId, 'discountAmount', e.target.value)}
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="w-28 text-right font-black text-indigo-700 text-sm font-mono">
                        {formatCurrency(item.subtotal)}
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="w-8 h-8 text-slate-400 hover:text-rose-600 flex items-center justify-center font-bold text-base transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CRM & Discount Bar inside Cart Card */}
          <div className="bg-slate-50 border-t border-slate-200 p-2.5 flex items-center gap-3 shrink-0 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <input
                className="input text-xs py-1.5 flex-1"
                placeholder="👤 Customer Phone or Name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCustomer()}
              />
              <button onClick={searchCustomer} className="btn-secondary text-xs py-1.5 px-3">Find</button>

              {selectedCustomer && (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 shrink-0">
                  <span>{selectedCustomer.name}</span>
                  <span className="badge badge-yellow text-[8px]">⭐ {selectedCustomer.loyaltyPoints || 0} pts</span>
                  <button
                    onClick={() => { setSelectedCustomer(null); setCustomerId('') }}
                    className="text-emerald-600 hover:text-rose-600 font-bold ml-1"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-slate-600 text-[11px]">Bill Discount:</span>
              <input
                type="number"
                min="0"
                className="input w-20 py-1 text-xs font-mono"
                value={billDiscount}
                onChange={(e) => setBillDiscount(e.target.value)}
              />
              <select
                className="input w-20 py-1 text-xs"
                value={billDiscountType}
                onChange={(e) => setBillDiscountType(e.target.value)}
              >
                <option value="flat">Flat ৳</option>
                <option value="percent">Pct %</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── BOTTOM NON-BARCODE SUGGESTION DRAWER (স্ক্রিনের নিচের কুইক সাজেশন) ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-soft-sm shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-800 tracking-tight flex items-center gap-1">
                🌾 Loose & Non-Barcoded Suggestions:
              </span>
              <span className="badge badge-yellow text-[9px] py-0 px-1.5">QUICK TOUCH</span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveBottomCategory('ALL')}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  activeBottomCategory === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Loose
              </button>
              {categories.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveBottomCategory(c.id)}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                    activeBottomCategory === c.id
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Quick-Pick Horizontal Scrollable Items */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {loadingLoose ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="w-36 h-14 bg-slate-100 rounded-lg animate-pulse shrink-0" />
                ))}
              </div>
            ) : nonBarcodeItems.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">No loose items found</div>
            ) : (
              nonBarcodeItems.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    const qty = parseFloat(manualQty) || 1
                    addToCart(p, qty)
                  }}
                  className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all shrink-0 flex flex-col justify-between text-left min-w-36 max-w-44 shadow-soft-sm group active:scale-[0.98]"
                >
                  <div className="font-bold text-xs text-slate-900 truncate leading-tight group-hover:text-indigo-900">
                    {p.name}
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[10px]">
                    <span className="font-extrabold text-indigo-700 font-mono">
                      {formatCurrency(p.salePrice)}
                      <span className="text-[9px] text-slate-400 font-normal">/{p.unit}</span>
                    </span>
                    <span className="text-slate-400 text-[9px]">
                      {p.currentStock} {p.unit}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── RIGHT: EXECUTIVE SUMMARY & FAST CHECKOUT ───────────────────────── */}
      <div className="w-72 bg-slate-900 text-white flex flex-col justify-between p-5 shrink-0 shadow-2xl z-20">
        <div className="space-y-3">
          <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
            <h2 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
              BILL SUMMARY
            </h2>
            <span className="badge bg-slate-800 text-slate-300 font-mono text-[9px]">
              {cart.length} ITEMS
            </span>
          </div>

          {/* Price Breakdown */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="text-slate-200 font-semibold font-mono">{formatCurrency(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-400 font-semibold">
                <span>Discount:</span>
                <span className="font-mono">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {/* Prominent Net Payable Box */}
            <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Net Payable Amount
              </div>
              <div className="text-2xl font-black tracking-tight text-emerald-400 font-mono mt-0.5">
                {formatCurrency(total)}
              </div>
            </div>

            {/* Fast Cash Tender Quick Buttons */}
            <div className="pt-2">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">
                Fast Cash Tender (৳):
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {FAST_CASH.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setPayments([{ method: 'CASH', amount: amt.toString() }])
                      setShowPaymentModal(true)
                    }}
                    className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-200 border border-slate-700 transition-colors"
                  >
                    ৳{amt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-4 border-t border-slate-800">
          <button
            onClick={() => {
              if (cart.length > 0) {
                setPayments([{ method: 'CASH', amount: total.toString() }])
                setShowPaymentModal(true)
              }
            }}
            disabled={cart.length === 0}
            className="btn-success w-full py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-between shadow-lg disabled:opacity-40"
          >
            <span>💳 Pay & Print Receipt</span>
            <span className="kbd-badge bg-black/40 text-emerald-300 border-emerald-900 font-mono">F2</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="btn bg-slate-800 hover:bg-rose-900/40 text-rose-300 border border-slate-700 text-xs py-1.5 rounded-lg disabled:opacity-30"
            >
              Clear [Esc]
            </button>
            <button
              onClick={() => {
                if (lastReceipt) setShowReceiptModal(true)
                else toast.error('No recent sale receipt')
              }}
              className="btn bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs py-1.5 rounded-lg"
            >
              Reprint
            </button>
          </div>
        </div>
      </div>

      {/* ─── OPEN / CUSTOM ITEM MODAL ─────────────────────────────────────── */}
      {showOpenItemModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-3">➕ Add Open / Custom Item</h3>
            <form onSubmit={handleAddOpenItem} className="space-y-3">
              <div>
                <label className="label-title">Item Name (e.g. কাঁচা ধনেপাতা / Shopping Bag) *</label>
                <input
                  className="input text-xs"
                  required
                  placeholder="e.g. Special Grocery Item"
                  value={openItemForm.name}
                  onChange={(e) => setOpenItemForm({ ...openItemForm, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label-title">Price (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input text-xs font-bold text-indigo-700"
                    placeholder="50"
                    value={openItemForm.price}
                    onChange={(e) => setOpenItemForm({ ...openItemForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-title">Qty / Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    className="input text-xs"
                    value={openItemForm.qty}
                    onChange={(e) => setOpenItemForm({ ...openItemForm, qty: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-title">Unit</label>
                  <input
                    className="input text-xs"
                    value={openItemForm.unit}
                    onChange={(e) => setOpenItemForm({ ...openItemForm, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOpenItemModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PAYMENT & TENDER MODAL ───────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">💳 Payment Confirmation</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">×</button>
            </div>

            {/* Total Due Box */}
            <div className="bg-slate-900 text-white rounded-xl p-4 mb-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Amount Due</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(total)}</div>
              </div>
              <div className="text-xs text-slate-400 font-mono">{cart.length} Items</div>
            </div>

            {/* Payment Method Rows */}
            <div className="space-y-2.5 mb-4">
              <label className="label-title">Select Payment Tender (Split Allowed):</label>
              {payments.map((p, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    className="input text-xs w-36 font-semibold"
                    value={p.method}
                    onChange={(e) => setPayments((prev) => prev.map((pp, i) => i === idx ? { ...pp, method: e.target.value } : pp))}
                  >
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input font-mono font-bold text-xs flex-1"
                    placeholder="Amount"
                    value={p.amount}
                    onChange={(e) => setPayments((prev) => prev.map((pp, i) => i === idx ? { ...pp, amount: e.target.value } : pp))}
                    autoFocus={idx === 0}
                  />
                  {payments.length > 1 && (
                    <button onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-700 px-2 font-bold text-lg">×</button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setPayments((prev) => [...prev, { method: 'BKASH', amount: '' }])}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                + Add split payment method
              </button>
            </div>

            {/* Change Feedback */}
            {change > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex justify-between items-center font-bold text-emerald-800 text-xs">
                <span>Change Returned:</span>
                <span className="text-base font-mono">{formatCurrency(change)}</span>
              </div>
            )}
            {change < 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex justify-between items-center font-bold text-rose-800 text-xs">
                <span>Remaining Due:</span>
                <span className="text-base font-mono">{formatCurrency(Math.abs(change))}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1 py-2.5">
                Cancel
              </button>
              <button
                onClick={submitSale}
                disabled={loading || totalPaid < total}
                className="btn-success flex-1 py-2.5 text-xs font-bold disabled:opacity-40"
              >
                {loading ? 'Processing...' : 'Confirm & Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HELD CARTS MODAL (F8) ────────────────────────────────────────── */}
      {showHeldCarts && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">🛒 Suspended Carts</h3>
              <button onClick={() => setShowHeldCarts(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {heldCarts.length === 0 ? (
                <div className="text-center text-slate-400 py-8 text-xs">No held transactions</div>
              ) : (
                heldCarts.map((h) => (
                  <div key={h.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <div className="font-bold text-xs text-slate-800">{h.label}</div>
                      <div className="text-[11px] text-slate-400">{new Date(h.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <button onClick={() => resumeCart(h)} className="btn-primary text-xs py-1 px-3">
                      Resume →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SHORTCUT HELP MODAL (?) ──────────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 mb-4">
              ⌨️ Keyboard Shortcut Guide
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="font-bold text-slate-800"><span className="kbd-badge">F2</span> Pay & Checkout</span>
                <span className="text-slate-500 text-[11px]">Opens payment confirmation</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="font-bold text-slate-800"><span className="kbd-badge">F4</span> Hold Cart</span>
                <span className="text-slate-500 text-[11px]">Suspends current cart</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="font-bold text-slate-800"><span className="kbd-badge">F8</span> Resume Held</span>
                <span className="text-slate-500 text-[11px]">Restores suspended carts</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="font-bold text-slate-800"><span className="kbd-badge">Esc</span> Clear Screen</span>
                <span className="text-slate-500 text-[11px]">Empties current cart</span>
              </div>
            </div>
            <button onClick={() => setShowHelp(false)} className="btn-primary w-full mt-4 text-xs">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ─── RETURN MODAL ─────────────────────────────────────────────────── */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 mb-3">↩ Return & Restock</h3>
            <div className="flex gap-2 mb-3">
              <input
                className="input text-xs font-mono flex-1"
                placeholder="Enter invoice number..."
                value={returnInvoice}
                onChange={(e) => setReturnInvoice(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && findReturnInvoice()}
              />
              <button onClick={findReturnInvoice} className="btn-primary text-xs">Search</button>
            </div>

            {returnSale && (
              <div className="space-y-2">
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs flex justify-between">
                  <span className="font-bold text-slate-800">Invoice: {returnSale.invoiceNo}</span>
                  <span className="font-bold text-indigo-700">{formatCurrency(returnSale.totalAmount)}</span>
                </div>

                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {returnSale.items?.map((item) => (
                    <div key={item.id} className="flex justify-between p-2 bg-slate-50 rounded text-xs">
                      <span className="text-slate-700">{item.product?.name}</span>
                      <span className="text-slate-500">{item.qty} × {formatCurrency(item.unitPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  ⚠️ Restocking will increment inventory and record refund.
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setShowReturnModal(false); setReturnSale(null) }} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await api.post(`/sales/${returnSale.id}/return`, {
                          items: returnSale.items.map((i) => ({ saleItemId: i.id, qty: i.qty }))
                        })
                        toast.success('Return processed')
                        setShowReturnModal(false)
                        setReturnSale(null)
                      } catch {
                        toast.error('Return error')
                      }
                    }}
                    className="btn-danger flex-1"
                  >
                    Confirm Return
                  </button>
                </div>
              </div>
            )}

            {!returnSale && (
              <button onClick={() => { setShowReturnModal(false); setReturnInvoice('') }} className="btn-secondary w-full text-xs mt-2">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── THERMAL RECEIPT SLIP ─────────────────────────────────────────── */}
      {showReceiptModal && lastReceipt && (
        <ThermalReceipt
          receipt={lastReceipt}
          onClose={() => setShowReceiptModal(false)}
          autoPrint={false}
        />
      )}
    </div>
  )
}
