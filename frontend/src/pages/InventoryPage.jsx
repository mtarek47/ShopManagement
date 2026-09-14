import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import { formatCurrency, formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'
import useAuthStore from '../hooks/useAuthStore'
import BarcodeGeneratorModal, { generateUniqueBarcode } from '../components/BarcodeGeneratorModal'

const EMPTY_PRODUCT = {
  name: '',
  barcode: '',
  sku: '',
  categoryId: '',
  brandId: '',
  brandName: '',
  costPrice: '',
  salePrice: '',
  unit: 'pcs',
  currentStock: 0,
  lowStockThreshold: 10,
  expiryDate: '',
  isActive: true,
}

export default function InventoryPage() {
  const { user } = useAuthStore()
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [expiringSoonCount, setExpiringSoonCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [filterExpiry, setFilterExpiry] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  // Live Auto-Suggestion Dropdown State
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchContainerRef = useRef(null)

  // Brand Typeahead in Add/Edit Modal
  const [brandSuggestions, setBrandSuggestions] = useState([])
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false)

  // Barcode Generator & Print Modal State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeTargetProduct, setBarcodeTargetProduct] = useState(null)

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [unitQty, setUnitQty] = useState('1')
  const [unitType, setUnitType] = useState('pcs')
  const [adjustModal, setAdjustModal] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ qty: '', type: 'DAMAGE', reason: '' })
  const [saving, setSaving] = useState(false)

  // Helper functions for smart unit parsing & formatting
  const parseUnit = (unitStr) => {
    if (!unitStr) return { qty: '1', type: 'pcs' }
    const str = String(unitStr).trim()
    const match = str.match(/^([\d\.]+)\s*(.*)$/)
    if (match) {
      return { qty: match[1], type: match[2].trim() || 'pcs' }
    }
    return { qty: '1', type: str || 'pcs' }
  }

  const combineUnit = (qty, type) => {
    const cleanQty = String(qty || '').trim()
    const cleanType = String(type || 'pcs').trim()
    if (!cleanQty || cleanQty === '1') return cleanType
    return `${cleanQty} ${cleanType}`
  }

  // Fetch Alert counts
  const fetchAlertCounts = async () => {
    try {
      const res = await api.get('/reports/dashboard')
      setLowStockCount(res.data.data?.lowStockCount || 0)
      setExpiringSoonCount(res.data.data?.expiringSoonCount || 0)
    } catch {
      /* silent */
    }
  }

  const loadBrands = async () => {
    try {
      const res = await api.get('/brands')
      setBrands(res.data.data || [])
    } catch { /* silent */ }
  }

  // Fetch Products with Sort and Filters
  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20, sortBy, sortOrder })
      if (search) params.append('search', search)
      if (filterCategory) params.append('categoryId', filterCategory)
      if (filterStock) params.append('stockStatus', filterStock)
      if (filterExpiry) params.append('expiryStatus', filterExpiry)
      const res = await api.get(`/products?${params}`)
      setProducts(res.data.data.products || [])
      setTotal(res.data.data.total || 0)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  // Load Categories & Brands
  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data || []))
    loadBrands()
    fetchAlertCounts()
  }, [])

  // Refetch on filter/sort changes
  useEffect(() => {
    fetchProducts()
  }, [page, filterCategory, filterStock, filterExpiry, sortBy, sortOrder])

  // Live Auto-Suggestion & Debounced Table Search
  useEffect(() => {
    const q = search.trim()
    if (!q) {
      setSuggestions([])
      setShowSuggestions(false)
      fetchProducts()
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/products/search?q=${encodeURIComponent(q)}`)
        const results = res.data.data || []
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        /* silent */
      }
      fetchProducts()
    }, 150)

    return () => clearTimeout(timer)
  }, [search])

  const openAdd = () => {
    setEditProduct(null)
    setForm(EMPTY_PRODUCT)
    setUnitQty('1')
    setUnitType('pcs')
    setBrandSuggestions([])
    setShowBrandSuggestions(false)
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditProduct(p)
    const parsed = parseUnit(p.unit)
    setUnitQty(parsed.qty)
    setUnitType(parsed.type)
    setForm({
      ...p,
      brandName: p.brand?.name || '',
      brandId: p.brandId || '',
      costPrice: parseFloat(p.costPrice),
      salePrice: parseFloat(p.salePrice),
      currentStock: parseFloat(p.currentStock),
      lowStockThreshold: parseFloat(p.lowStockThreshold),
      expiryDate: p.expiryDate ? p.expiryDate.slice(0, 10) : '',
      categoryId: p.categoryId,
    })
    setBrandSuggestions([])
    setShowBrandSuggestions(false)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!form.name || !form.categoryId || !form.costPrice || !form.salePrice) {
      return toast.error('Name, category, cost & sale price are required')
    }
    setSaving(true)
    try {
      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, form)
        toast.success('Product updated successfully')
      } else {
        await api.post('/products', form)
        toast.success('Product added to inventory')
      }
      setShowModal(false)
      fetchProducts()
      loadBrands()
      fetchAlertCounts()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this product?')) return
    try {
      await api.delete(`/products/${id}`)
      toast.success('Product deactivated')
      fetchProducts()
      fetchAlertCounts()
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const handleAdjust = async (e) => {
    e?.preventDefault()
    if (!adjustForm.qty || !adjustForm.reason) {
      return toast.error('Quantity and reason are required')
    }
    const qty =
      adjustForm.type === 'DAMAGE' || adjustForm.type === 'LOSS'
        ? -Math.abs(parseFloat(adjustForm.qty))
        : Math.abs(parseFloat(adjustForm.qty))
    try {
      await api.post(`/products/${adjustModal.id}/adjust-stock`, {
        qty,
        type: adjustForm.type,
        reason: adjustForm.reason,
      })
      toast.success('Stock quantity adjusted')
      setAdjustModal(null)
      fetchProducts()
      fetchAlertCounts()
    } catch {
      toast.error('Failed to adjust stock')
    }
  }

  // Helper: check if product expiry is within 30 days
  const checkExpiryStatus = (dateStr) => {
    if (!dateStr) return null
    const exp = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { label: 'Expired', color: 'badge-red', days: diffDays }
    if (diffDays <= 30) return { label: `${diffDays}d left`, color: 'badge-yellow', days: diffDays }
    return null
  }

  return (
    <div className="p-4 space-y-3 w-full max-w-full font-sans overflow-x-hidden">
      {/* ─── COMPACT RESPONSIVE HEADER ──────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 flex-wrap gap-2.5">
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">
            Inventory Catalog
          </h1>
          <p className="text-[11px] text-slate-500">
            Stock management, live barcode lookup, category sorting & expiry audit
          </p>
        </div>

        {/* Top Right Action & Alert Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* EXPIRING SOON ALERT BUTTON */}
          <button
            onClick={() => {
              if (filterExpiry === 'expiring_soon') {
                setFilterExpiry('')
                toast.success('Cleared expiry filter')
              } else {
                setFilterExpiry('expiring_soon')
                toast.success('Filtered: Showing items expiring within 30 days')
              }
              setPage(1)
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
              filterExpiry === 'expiring_soon'
                ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
            }`}
            title="Filter items expiring within 1 month (30 days)"
          >
            <span>Expiring (30 Days):</span>
            <span
              className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-black ${
                filterExpiry === 'expiring_soon' ? 'bg-white text-amber-800' : 'bg-amber-200 text-amber-950'
              }`}
            >
              {expiringSoonCount}
            </span>
            {filterExpiry === 'expiring_soon' && <span className="text-[10px] ml-0.5">✕</span>}
          </button>

          {/* LOW STOCK ALERT BUTTON */}
          <button
            onClick={() => {
              if (filterStock === 'low') {
                setFilterStock('')
                toast.success('Showing all stock items')
              } else {
                setFilterStock('low')
                toast.success('Filtered: Showing Low Stock items only')
              }
              setPage(1)
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
              filterStock === 'low'
                ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
            }`}
            title="Click to filter low stock items"
          >
            <span>Low Stock:</span>
            <span
              className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-black ${
                filterStock === 'low' ? 'bg-white text-rose-700' : 'bg-rose-200 text-rose-900'
              }`}
            >
              {lowStockCount}
            </span>
            {filterStock === 'low' && <span className="text-[10px] ml-0.5">✕</span>}
          </button>

          {/* GENERATE / PRINT BARCODES BUTTON */}
          <button
            onClick={() => {
              setBarcodeTargetProduct(null)
              setShowBarcodeModal(true)
            }}
            className="btn-secondary text-xs py-1.5 px-3 shadow-2xs font-bold text-slate-800 bg-white hover:bg-slate-50 border-slate-300 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span>Print Barcodes</span>
          </button>

          {/* Add Product Button */}
          <button onClick={openAdd} className="btn-primary text-xs py-1.5 px-3 shadow-2xs font-bold bg-slate-900 hover:bg-slate-800 text-white">
            + Add Product
          </button>
        </div>
      </div>

      {/* ─── RESPONSIVE COMPACT SEARCH & FILTER CONTROLS ────────────────────── */}
      <div className="card p-2.5 flex gap-2 flex-wrap items-center bg-white shadow-2xs border border-slate-200">
        {/* Live Search Input with Instant Suggestion Dropdown */}
        <div ref={searchContainerRef} className="relative flex-1 min-w-48">
          <input
            className="input text-xs pl-8 pr-6 py-1.5 bg-slate-50 border-slate-300 focus:bg-white"
            placeholder="Search by name, barcode, SKU or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          {search && (
            <button
              onClick={() => { setSearch(''); setSuggestions([]); setShowSuggestions(false) }}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-700 text-xs font-bold"
            >
              ×
            </button>
          )}

          {/* Live Suggestion Popover while typing */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100 z-50">
              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                <span>Matching Suggestions ({suggestions.length})</span>
                <span>Click to filter</span>
              </div>
              {suggestions.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSearch(p.name)
                    setShowSuggestions(false)
                  }}
                  className="p-2 flex items-center justify-between hover:bg-indigo-50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {p.category?.name} • Stock: <span className="font-bold text-slate-700">{p.currentStock} {p.unit}</span>
                    </div>
                  </div>
                  <div className="text-right font-extrabold text-xs text-indigo-700 shrink-0">
                    {formatCurrency(p.salePrice)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Category (ক্যাটাগরি):</span>
          <select
            className="input text-xs w-52 py-1.5 font-medium bg-slate-50 border-slate-300 text-slate-800"
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
          >
            <option value="">All Categories (সকল ক্যাটাগরি) ({total})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Sort By (সর্টিং):</span>
          <select
            className="input text-xs w-44 py-1.5 font-medium bg-slate-50 border-slate-300 text-slate-800"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-')
              setSortBy(sb)
              setSortOrder(so)
              setPage(1)
            }}
          >
            <option value="name-asc">Name (A → Z) (নাম)</option>
            <option value="name-desc">Name (Z → A) (নাম)</option>
            <option value="currentStock-asc">Stock: Low → High (কম স্টক)</option>
            <option value="currentStock-desc">Stock: High → Low (বেশি স্টক)</option>
            <option value="salePrice-asc">Price: Low → High (কম দাম)</option>
            <option value="salePrice-desc">Price: High → Low (বেশি দাম)</option>
            <option value="createdAt-desc">Newest Added (সর্বশেষ)</option>
          </select>
        </div>

        {/* Stock Filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Stock (স্টক):</span>
          <select
            className="input text-xs w-38 py-1.5 bg-slate-50 border-slate-300 font-medium text-slate-800"
            value={filterStock}
            onChange={(e) => { setFilterStock(e.target.value); setPage(1) }}
          >
            <option value="">All Stock (সকল)</option>
            <option value="low">⚠️ Low Stock (কম স্টক)</option>
            <option value="out">🛑 Out of Stock (স্টক শেষ)</option>
          </select>
        </div>

        {/* Expiry Filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Expiry (মেয়াদ):</span>
          <select
            className="input text-xs w-44 py-1.5 bg-slate-50 border-slate-300 font-medium text-slate-800"
            value={filterExpiry}
            onChange={(e) => { setFilterExpiry(e.target.value); setPage(1) }}
          >
            <option value="">All Expiry (সকল)</option>
            <option value="expiring_soon">⏳ Expiring 30d (৩০ দিনে শেষ)</option>
            <option value="expired">🛑 Expired (মেয়াদোত্তীর্ণ)</option>
          </select>
        </div>
      </div>

      {/* Active Filter Reminder */}
      {(filterExpiry || filterStock || filterCategory) && (
        <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800 flex items-center justify-between font-medium">
          <span>
            Active Filters:{' '}
            {filterCategory && (
              <strong>Category: {categories.find((c) => c.id === filterCategory)?.name || 'Filtered'}</strong>
            )}
            {filterCategory && (filterExpiry || filterStock) && ' • '}
            {filterExpiry === 'expiring_soon' && <strong>Expiring within 30 days</strong>}
            {filterExpiry === 'expired' && <strong>Expired</strong>}
            {filterExpiry && filterStock && ' • '}
            {filterStock === 'low' && <strong>Low stock alerts</strong>}
            {filterStock === 'out' && <strong>Out of stock items</strong>}
          </span>
          <button
            onClick={() => { setFilterCategory(''); setFilterExpiry(''); setFilterStock(''); setPage(1) }}
            className="underline font-bold text-indigo-700 hover:text-indigo-900 ml-2"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* ─── OPTIMIZED ZERO-HORIZONTAL-SCROLL TABLE ─────────────────────────── */}
      <div className="card p-0 overflow-hidden bg-white shadow-soft-sm">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-32">Barcode / SKU</th>
              <th className="py-2.5 px-3">Product Name & Category</th>
              <th className="py-2.5 px-3 text-right w-28">Price (৳)</th>
              <th className="py-2.5 px-3 text-center w-24">Stock Level</th>
              <th className="py-2.5 px-3 w-28">Expiry</th>
              <th className="py-2.5 px-3 text-right w-36">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading catalog...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">No products match the selected criteria</td></tr>
            ) : (
              products.map((p) => {
                const stockNum = parseFloat(p.currentStock)
                const thresholdNum = parseFloat(p.lowStockThreshold)
                const isLow = stockNum > 0 && stockNum <= thresholdNum
                const isOut = stockNum <= 0
                const expiryInfo = checkExpiryStatus(p.expiryDate)

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isOut ? 'bg-rose-50/40' : isLow ? 'bg-amber-50/40' : expiryInfo ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Barcode / SKU */}
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 font-medium whitespace-nowrap">
                      {p.barcode || p.sku || (
                        <span className="badge badge-yellow text-[8px] py-0 px-1">LOOSE</span>
                      )}
                    </td>

                    {/* Product Name & Category Consolidated */}
                    <td className="py-2 px-3 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.2">
                        <span className="font-semibold text-slate-600">{p.category?.name || 'General'}</span>
                        {p.brand?.name && <span> • {p.brand.name}</span>}
                      </div>
                    </td>

                    {/* Sale Price & Cost Price Consolidated */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="font-bold text-indigo-700 font-mono text-xs">
                        {formatCurrency(p.salePrice)}
                        <span className="text-[9px] text-slate-400 font-normal">/{p.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Cost: {formatCurrency(p.costPrice)}
                      </div>
                    </td>

                    {/* Stock Available Badge */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span className={`badge ${isOut ? 'badge-red' : isLow ? 'badge-yellow' : 'badge-green'}`}>
                        {p.currentStock} {p.unit}
                      </span>
                    </td>

                    {/* Expiry Date & Countdown */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {p.expiryDate ? (
                        <div>
                          <div className="text-[11px] text-slate-600">{formatDate(p.expiryDate)}</div>
                          {expiryInfo && (
                            <span className={`badge ${expiryInfo.color} text-[8px] py-0 px-1 font-bold mt-0.5 inline-block`}>
                              {expiryInfo.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-2 px-3 text-right space-x-1 whitespace-nowrap">
                      {!p.barcode && (
                        <button
                          onClick={() => {
                            setBarcodeTargetProduct(p)
                            setShowBarcodeModal(true)
                          }}
                          className="text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                          title="Generate & print barcode sticker for this item"
                        >
                          Label
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(p)}
                        className="text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setAdjustModal(p)
                          setAdjustForm({ qty: '', type: 'DAMAGE', reason: '' })
                        }}
                        className="text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                      >
                        Adjust
                      </button>
                      {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                        >
                          Del
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="flex justify-between items-center p-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
          <span>Total: <strong>{total}</strong> products</span>
          <div className="flex gap-1.5 items-center">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs py-0.5 px-2.5 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="font-semibold text-slate-700 text-xs">Page {page}</span>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs py-0.5 px-2.5 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ─── ADD / EDIT PRODUCT MODAL (WITH BARCODE AUTO-GENERATE) ─────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 border border-slate-200">
            <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                {editProduct ? 'Edit Product Details' : 'Add New Product to Catalog'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleSave} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label className="label-title">Product Name *</label>
                  <input
                    className="input text-xs"
                    required
                    placeholder="e.g. Miniket Premium Rice / আলু"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Barcode Field with Inline Auto-Generate Button */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="label-title mb-0">Barcode</label>
                    <button
                      type="button"
                      onClick={() => {
                        const code = generateUniqueBarcode()
                        setForm({ ...form, barcode: code })
                        toast.success(`Generated: ${code}`)
                      }}
                      className="text-[10px] font-bold text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      Auto
                    </button>
                  </div>
                  <input
                    className="input text-xs font-mono"
                    placeholder="Scan or click Auto"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-title">SKU Code</label>
                  <input
                    className="input text-xs font-mono"
                    placeholder="GROC-001"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-title">Category *</label>
                  <select
                    className="input text-xs"
                    required
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Brand Typeahead */}
                <div className="relative">
                  <label className="label-title">Brand (Type for suggestions)</label>
                  <input
                    className="input text-xs"
                    placeholder="Type brand (e.g. Pran, ACI, Fresh...)"
                    value={form.brandName || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setForm({ ...form, brandName: val, brandId: '' })
                      if (val.trim()) {
                        const matched = brands.filter((b) =>
                          b.name.toLowerCase().includes(val.toLowerCase())
                        )
                        setBrandSuggestions(matched)
                        setShowBrandSuggestions(matched.length > 0)
                      } else {
                        setBrandSuggestions([])
                        setShowBrandSuggestions(false)
                      }
                    }}
                    onFocus={() => {
                      if (form.brandName && form.brandName.trim()) {
                        const matched = brands.filter((b) =>
                          b.name.toLowerCase().includes(form.brandName.toLowerCase())
                        )
                        setBrandSuggestions(matched)
                        setShowBrandSuggestions(matched.length > 0)
                      }
                    }}
                  />
                  {showBrandSuggestions && brandSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-36 overflow-y-auto divide-y divide-slate-100 z-50">
                      <div className="px-2.5 py-1 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase">
                        Brand Suggestions ({brandSuggestions.length})
                      </div>
                      {brandSuggestions.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setForm({ ...form, brandName: b.name, brandId: b.id })
                            setShowBrandSuggestions(false)
                          }}
                          className="px-3 py-1.5 text-xs text-slate-800 hover:bg-indigo-50 cursor-pointer font-semibold flex justify-between items-center transition-colors"
                        >
                          <span>{b.name}</span>
                          <span className="text-[10px] text-indigo-600 font-bold">Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label-title">Cost Price (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input text-xs font-mono"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-title">Sale Price (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input text-xs font-mono font-bold text-indigo-700"
                    value={form.salePrice}
                    onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                  />
                </div>
                {/* Measurement Unit Quantity/Size & Unit Dropdown Selector */}
                <div>
                  <label className="label-title">Unit / Pack Size (পরিমাপ ও একক) *</label>
                  <div className="flex gap-1.5 items-center">
                    {/* 1. Numeric Unit Value / Net Weight Box */}
                    <div className="w-24 shrink-0">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        className="input text-xs font-mono font-bold text-slate-900 bg-white border-slate-300 w-full"
                        placeholder="1, 250, 500"
                        value={unitQty}
                        onChange={(e) => {
                          const val = e.target.value
                          setUnitQty(val)
                          setForm({ ...form, unit: combineUnit(val, unitType) })
                        }}
                        required
                      />
                    </div>

                    {/* 2. Unit Measurement Dropdown */}
                    <div className="flex-1 min-w-0">
                      <select
                        className="input text-xs font-bold bg-white border-slate-300 text-slate-900 w-full"
                        value={unitType}
                        onChange={(e) => {
                          const val = e.target.value
                          setUnitType(val)
                          setForm({ ...form, unit: combineUnit(unitQty, val) })
                        }}
                      >
                        <option value="pcs">pcs (পিস / Piece)</option>
                        <option value="kg">kg (কেজি / Kilogram)</option>
                        <option value="gm">gm (গ্রাম / Gram)</option>
                        <option value="mg">mg (মিলিগ্রাম / Milligram)</option>
                        <option value="litre">litre (লিটার / Litre)</option>
                        <option value="ml">ml (মিলি / Millilitre)</option>
                        <option value="pack">pack (প্যাকেট / Packet)</option>
                        <option value="box">box (বক্স / কার্টুন)</option>
                        <option value="hali">hali (হালি / ৪ পিস)</option>
                        <option value="dozen">dozen (ডজন / ১২ পিস)</option>
                        <option value="bottle">bottle (বোতল / Bottle)</option>
                        <option value="can">can (ক্যান / Can)</option>
                        <option value="sachet">sachet (মিনি প্যাক)</option>
                      </select>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                    Unit: <strong className="text-indigo-700">{combineUnit(unitQty, unitType)}</strong> (যেমন: 250 gm, 500 ml, 1 kg, 20 pcs)
                  </span>
                </div>
                <div>
                  <label className="label-title">Current Shelf Stock</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="input text-xs font-mono"
                    value={form.currentStock}
                    onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-title">Low Stock Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="input text-xs font-mono"
                    value={form.lowStockThreshold}
                    onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-title">Expiry Date</label>
                  <input
                    type="date"
                    className="input text-xs"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── THERMAL BARCODE GENERATOR & BATCH PRINT MODAL ────────────────── */}
      {showBarcodeModal && (
        <BarcodeGeneratorModal
          products={products}
          preselectedProduct={barcodeTargetProduct}
          onClose={() => {
            setShowBarcodeModal(false)
            setBarcodeTargetProduct(null)
          }}
        />
      )}

      {/* ─── STOCK ADJUSTMENT MODAL ───────────────────────────────────────── */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 mb-1">Stock Adjustment</h3>
            <p className="text-xs text-slate-500 mb-3">
              Item: <strong>{adjustModal.name}</strong> (Stock: {adjustModal.currentStock} {adjustModal.unit})
            </p>
            <form onSubmit={handleAdjust} className="space-y-2.5">
              <div>
                <label className="label-title">Adjustment Reason Type</label>
                <select
                  className="input text-xs"
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                >
                  <option value="DAMAGE">Damaged Goods (Deduct Stock)</option>
                  <option value="LOSS">Lost / Expired Item (Deduct Stock)</option>
                  <option value="CORRECTION">Manual Audit Correction</option>
                  <option value="RETURN">Customer Return Restock</option>
                </select>
              </div>
              <div>
                <label className="label-title">Adjustment Quantity</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="input text-xs font-mono"
                  placeholder="e.g. 5"
                  value={adjustForm.qty}
                  onChange={(e) => setAdjustForm({ ...adjustForm, qty: e.target.value })}
                />
              </div>
              <div>
                <label className="label-title">Adjustment Note / Reason *</label>
                <textarea
                  rows={2}
                  required
                  className="input text-xs"
                  placeholder="Details for audit log..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModal(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
