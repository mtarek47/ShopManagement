import { useState, useEffect } from 'react'
import api from '../utils/api'
import { formatCurrency, formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'
import PurchaseReceipt from '../components/PurchaseReceipt'

export default function PurchasesPage() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(null)
  const [saving, setSaving] = useState(false)

  // Invoice Print Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [lastPurchaseReceipt, setLastPurchaseReceipt] = useState(null)

  // Create form state
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([
    { productId: '', qty: 1, costPrice: '', subtotal: 0 },
  ])

  const fetchPurchases = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/purchases?page=${page}&limit=15`)
      setOrders(res.data.data.orders || [])
      setTotal(res.data.data.total || 0)
    } catch {
      toast.error('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }

  const loadPrerequisites = async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products?limit=100'),
      ])
      setSuppliers(supRes.data.data || [])
      setProducts(prodRes.data.data?.products || [])
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    fetchPurchases()
  }, [page])

  useEffect(() => {
    loadPrerequisites()
  }, [])

  const handleAddItem = () => {
    setItems([...items, { productId: '', qty: 1, costPrice: '', subtotal: 0 }])
  }

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index, field, value) => {
    const next = [...items]
    next[index][field] = value

    if (field === 'productId') {
      const prod = products.find((p) => p.id === value)
      if (prod) {
        next[index].costPrice = prod.costPrice
      }
    }

    const qty = parseFloat(next[index].qty) || 0
    const price = parseFloat(next[index].costPrice) || 0
    next[index].subtotal = qty * price
    setItems(next)
  }

  const totalCalculated = items.reduce((sum, i) => sum + (i.subtotal || 0), 0)

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (!selectedSupplier) return toast.error('Please select a supplier')
    const validItems = items.filter((i) => i.productId && parseFloat(i.qty) > 0 && i.costPrice !== '')
    if (validItems.length === 0) return toast.error('Add at least one valid item with price')

    setSaving(true)
    try {
      const res = await api.post('/purchases', {
        supplierId: selectedSupplier,
        invoiceNo: invoiceNo || undefined,
        amountPaid: parseFloat(amountPaid) || 0,
        notes,
        items: validItems.map((i) => ({
          productId: i.productId,
          qty: parseFloat(i.qty),
          costPrice: parseFloat(i.costPrice),
        })),
      })

      const createdOrder = res.data.data
      toast.success('Stock-in confirmed! Inventory stock updated.')

      // Open professional thermal purchase invoice for printing
      setLastPurchaseReceipt(createdOrder)
      setShowCreateModal(false)
      setShowReceiptModal(true)

      // Reset form
      setSelectedSupplier('')
      setInvoiceNo('')
      setAmountPaid('')
      setNotes('')
      setItems([{ productId: '', qty: 1, costPrice: '', subtotal: 0 }])
      fetchPurchases()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create purchase order')
    } finally {
      setSaving(false)
    }
  }

  const openInvoiceForOrder = async (orderId) => {
    try {
      const res = await api.get(`/purchases/${orderId}`)
      setLastPurchaseReceipt(res.data.data)
      setShowReceiptModal(true)
    } catch {
      toast.error('Failed to load invoice details')
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto font-sans">
      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            🛍️ Stock In & Purchase Orders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record wholesale stock procurement, print stock-in invoices, and auto-increment inventory
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true)
            loadPrerequisites()
          }}
          className="btn-primary text-xs py-2 px-4 shadow-soft-sm font-bold flex items-center gap-1.5"
        >
          <span>+ New Stock In (PO)</span>
        </button>
      </div>

      {/* ─── ORDERS TABLE ──────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden bg-white shadow-soft-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">PO Invoice No</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4 text-right">Total Procurement</th>
              <th className="py-3 px-4 text-right">Amount Paid</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Received Date</th>
              <th className="py-3 px-4">Created By</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-400">Loading purchase orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-400">No purchase orders recorded yet</td></tr>
            ) : (
              orders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                    {po.invoiceNo}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {po.supplier?.name || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(po.totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                    {formatCurrency(po.amountPaid)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`badge ${
                      po.status === 'PAID' ? 'badge-green font-bold' : po.status === 'PARTIAL' ? 'badge-yellow font-bold' : 'badge-red font-bold'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {formatDate(po.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-medium">
                    {po.createdBy?.name || 'Admin'}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    {/* Print Professional Invoice Button */}
                    <button
                      onClick={() => openInvoiceForOrder(po.id)}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
                      title="Print Stock In Invoice"
                    >
                      🖨️ Invoice
                    </button>
                    <button
                      onClick={async () => {
                        const res = await api.get(`/purchases/${po.id}`)
                        setShowDetailModal(res.data.data)
                      }}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                    >
                      View Items
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="flex justify-between items-center p-3 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
          <span>Total: <strong>{total}</strong> purchase orders</span>
          <div className="flex gap-1.5 items-center">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="font-semibold text-slate-700">Page {page}</span>
            <button
              disabled={page * 15 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ─── CREATE NEW PURCHASE ORDER MODAL (PIXEL-PERFECT ALIGNED) ──────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  📥 Record Stock In & Purchase Order
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select supplier and add product quantities to increase inventory
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex-1 flex flex-col overflow-hidden">
              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {/* Top Row: Supplier, Invoice No & Paid (Equal Height Labels & Inputs) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex flex-col justify-end">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 truncate">
                      Select Supplier *
                    </label>
                    <select
                      className="input text-xs font-semibold h-9 py-1 px-2.5 w-full bg-white border-slate-300"
                      required
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 truncate">
                      Supplier Invoice / PO No
                    </label>
                    <input
                      className="input text-xs font-mono h-9 py-1 px-2.5 w-full bg-white border-slate-300"
                      placeholder="Auto if left blank"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 truncate">
                      Amount Paid (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-xs font-mono font-bold text-emerald-700 h-9 py-1 px-2.5 w-full bg-white border-slate-300"
                      placeholder="0.00"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                    />
                  </div>
                </div>

                {/* Items Line Table */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Stock Items to Procure *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                    >
                      + Add Another Row
                    </button>
                  </div>

                  <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white">
                    {/* Header with clear proportions */}
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase pb-1.5 border-b border-slate-100">
                      <span className="col-span-6">Product</span>
                      <span className="col-span-2 text-center">Qty / Weight</span>
                      <span className="col-span-2 text-right">Cost Rate (৳)</span>
                      <span className="col-span-2 text-right pr-2">Subtotal (৳)</span>
                    </div>

                    {/* Perfectly aligned input rows */}
                    {items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <select
                            className="input text-xs h-9 py-1 px-2 w-full border-slate-300"
                            required
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          >
                            <option value="">-- Choose Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.barcode ? `[${p.barcode}]` : '(Loose)'}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            required
                            className="input text-xs font-mono text-center h-9 py-1 px-2 w-full border-slate-300"
                            placeholder="Qty"
                            value={item.qty}
                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          />
                        </div>

                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            className="input text-xs font-mono text-right h-9 py-1 px-2 w-full border-slate-300"
                            placeholder="Cost"
                            value={item.costPrice}
                            onChange={(e) => handleItemChange(index, 'costPrice', e.target.value)}
                          />
                        </div>

                        <div className="col-span-2 flex items-center justify-end gap-1.5 h-9 pr-1">
                          <span className="font-bold text-xs font-mono text-slate-800 truncate">
                            {formatCurrency(item.subtotal || 0)}
                          </span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-slate-400 hover:text-rose-600 font-bold text-base w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100"
                              title="Remove item row"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes Field */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                    Procurement Notes / Memo
                  </label>
                  <input
                    className="input text-xs h-9 py-1 px-3 w-full border-slate-300"
                    placeholder="e.g. Goods received in good condition / Batch #A12"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Footer with Summary & Confirm Button */}
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">Total Purchase:</span>
                  <span className="text-base font-black text-indigo-700 font-mono">
                    {formatCurrency(totalCalculated)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary text-xs py-2 px-5 font-bold shadow-soft-sm flex items-center gap-1.5"
                  >
                    <span>{saving ? 'Processing...' : '✔ Confirm Stock & Print Invoice'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── VIEW ORDER DETAILS MODAL ──────────────────────────────────────── */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  PO Details: {showDetailModal.invoiceNo}
                </h3>
                <p className="text-xs text-slate-500">
                  Supplier: <strong>{showDetailModal.supplier?.name}</strong> • Status: <strong>{showDetailModal.status}</strong>
                </p>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {showDetailModal.items?.map((i) => (
                <div key={i.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{i.product?.name}</span>
                    <div className="text-[10px] text-slate-400">Qty: {i.qty} {i.product?.unit || 'pcs'}</div>
                  </div>
                  <div className="text-right font-mono font-bold text-slate-800">
                    {formatCurrency(i.subtotal)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLastPurchaseReceipt(showDetailModal)
                  setShowDetailModal(null)
                  setShowReceiptModal(true)
                }}
                className="btn-primary flex-1 text-xs py-2 font-bold"
              >
                🖨️ Print Purchase Slip
              </button>
              <button onClick={() => setShowDetailModal(null)} className="btn-secondary flex-1 text-xs py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PROFESSIONAL STOCK IN INVOICE THERMAL SLIP ─────────────────────── */}
      {showReceiptModal && lastPurchaseReceipt && (
        <PurchaseReceipt
          purchase={lastPurchaseReceipt}
          onClose={() => setShowReceiptModal(false)}
          autoPrint={false}
        />
      )}
    </div>
  )
}
