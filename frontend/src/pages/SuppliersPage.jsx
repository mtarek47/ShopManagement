import { useState, useEffect } from 'react'
import api from '../utils/api'
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers'
import toast from 'react-hot-toast'
import useAuthStore from '../hooks/useAuthStore'
import PurchaseReceipt from '../components/PurchaseReceipt'

const EMPTY_SUPPLIER = { name: '', contact: '', phone: '', address: '' }

export default function SuppliersPage() {
  const { user } = useAuthStore()
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Add / Edit modal state
  const [showModal, setShowModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [form, setForm] = useState(EMPTY_SUPPLIER)
  const [saving, setSaving] = useState(false)

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  // Supplier Details Modal / Drawer state
  const [detailSupplier, setDetailSupplier] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Invoice Print Modal
  const [viewInvoice, setViewInvoice] = useState(null)

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await api.get(`/suppliers?${params}`)
      setSuppliers(res.data.data || [])
    } catch {
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const openSupplierDetails = async (supplierId) => {
    setLoadingDetails(true)
    try {
      const res = await api.get(`/suppliers/${supplierId}`)
      setDetailSupplier(res.data.data)
    } catch {
      toast.error('Failed to load supplier details')
    } finally {
      setLoadingDetails(false)
    }
  }

  const openAdd = () => {
    setEditSupplier(null)
    setForm(EMPTY_SUPPLIER)
    setShowModal(true)
  }

  const openEdit = (s, e) => {
    if (e) e.stopPropagation()
    setEditSupplier(s)
    setForm({
      name: s.name || '',
      contact: s.contact || '',
      phone: s.phone || '',
      address: s.address || '',
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Supplier name is required')

    setSaving(true)
    try {
      if (editSupplier) {
        await api.put(`/suppliers/${editSupplier.id}`, form)
        toast.success('Supplier updated successfully')
      } else {
        await api.post('/suppliers', form)
        toast.success('Supplier added successfully')
      }
      setShowModal(false)
      fetchSuppliers()
      if (detailSupplier && detailSupplier.id === editSupplier?.id) {
        openSupplierDetails(detailSupplier.id)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to deactivate this supplier?')) return
    try {
      await api.delete(`/suppliers/${id}`)
      toast.success('Supplier deactivated')
      fetchSuppliers()
      if (detailSupplier?.id === id) setDetailSupplier(null)
    } catch {
      toast.error('Failed to delete supplier')
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) return toast.error('Enter a valid payment amount')

    try {
      await api.post(`/suppliers/${paymentModal.id}/payments`, { amount })
      toast.success('Supplier payment recorded successfully')
      setPaymentModal(null)
      setPaymentAmount('')
      fetchSuppliers()
      if (detailSupplier && detailSupplier.id === paymentModal.id) {
        openSupplierDetails(detailSupplier.id)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment')
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto font-sans">
      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            🏭 Supplier Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any supplier row to view purchase history, orders, contact details, and dues
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn-primary text-xs py-2 px-4 shadow-soft-sm font-bold flex items-center gap-1.5"
        >
          <span>+ Add Supplier</span>
        </button>
      </div>

      {/* ─── SEARCH BAR ────────────────────────────────────────────────────── */}
      <div className="card p-3 bg-white flex gap-2.5 items-center shadow-soft-sm">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
          <input
            className="input text-xs pl-9 w-full bg-slate-50 border-slate-200"
            placeholder="Search by supplier company name, contact person, or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchSuppliers()}
          />
        </div>
        <button onClick={fetchSuppliers} className="btn-primary text-xs py-2 px-4 font-bold">
          Search
        </button>
      </div>

      {/* ─── SUPPLIERS TABLE ────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden bg-white shadow-soft-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Supplier Company</th>
              <th className="py-3 px-4">Contact Person</th>
              <th className="py-3 px-4">Phone Number</th>
              <th className="py-3 px-4">Address</th>
              <th className="py-3 px-4 text-right">Total Balance Due</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-400">Loading suppliers...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-400">No suppliers found</td></tr>
            ) : (
              suppliers.map((s) => {
                const due = parseFloat(s.totalDue) || 0
                return (
                  <tr
                    key={s.id}
                    onClick={() => openSupplierDetails(s.id)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-700 flex items-center gap-1.5">
                        <span>{s.name}</span>
                        <span className="text-[10px] text-indigo-400 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                          (View Details →)
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{s.contact || '—'}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-600">{s.phone || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{s.address || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-mono font-bold text-xs ${
                        due > 0 ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200' : 'text-emerald-700'
                      }`}>
                        {formatCurrency(due)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {due > 0 && (
                        <button
                          onClick={() => {
                            setPaymentModal(s)
                            setPaymentAmount('')
                          }}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
                          title="Record Supplier Payment"
                        >
                          💳 Pay Due
                        </button>
                      )}
                      <button
                        onClick={() => openSupplierDetails(s.id)}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
                      >
                        Details
                      </button>
                      <button
                        onClick={(e) => openEdit(s, e)}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── SUPPLIER FULL DETAILS MODAL ────────────────────────────────────── */}
      {detailSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Top Bar */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold">
                  🏭
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">
                    {detailSupplier.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Supplier Profile, Contact & Purchase Orders History
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(detailSupplier)}
                  className="btn-secondary text-xs py-1.5 px-3 font-semibold"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => setDetailSupplier(null)}
                  className="text-slate-400 hover:text-slate-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Profile & Summary Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Contact Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Contact Information
                  </div>
                  <div><span className="text-slate-400">Contact Person:</span> <strong className="text-slate-800">{detailSupplier.contact || '—'}</strong></div>
                  <div><span className="text-slate-400">Phone:</span> <strong className="text-slate-800 font-mono">{detailSupplier.phone || '—'}</strong></div>
                  <div><span className="text-slate-400">Address:</span> <span className="text-slate-700">{detailSupplier.address || '—'}</span></div>
                </div>

                {/* Total Procurement Card */}
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1 text-xs flex flex-col justify-between">
                  <div className="font-bold text-indigo-900 uppercase tracking-wider text-[10px]">
                    Total Orders Placed
                  </div>
                  <div>
                    <div className="text-xl font-black text-indigo-700 font-mono">
                      {detailSupplier.purchaseOrders?.length || 0} Orders
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Total Purchased: {formatCurrency(
                        detailSupplier.purchaseOrders?.reduce((sum, p) => sum + parseFloat(p.totalAmount || 0), 0) || 0
                      )}
                    </div>
                  </div>
                </div>

                {/* Payable Due Balance Card */}
                <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1 text-xs flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-900 uppercase tracking-wider text-[10px]">
                      Outstanding Due Balance
                    </span>
                    {parseFloat(detailSupplier.totalDue) > 0 && (
                      <button
                        onClick={() => {
                          setPaymentModal(detailSupplier)
                          setPaymentAmount('')
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                      >
                        + Pay Now
                      </button>
                    )}
                  </div>
                  <div>
                    <div className={`text-xl font-black font-mono ${
                      parseFloat(detailSupplier.totalDue) > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                      {formatCurrency(detailSupplier.totalDue)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {parseFloat(detailSupplier.totalDue) > 0 ? 'Payment pending' : 'All accounts settled'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Orders & Stock-In History Table */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📦 Purchase Orders & Stock In History</span>
                    <span className="badge badge-blue text-[10px] py-0 px-1.5">
                      {detailSupplier.purchaseOrders?.length || 0}
                    </span>
                  </h4>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">PO Invoice No</th>
                        <th className="py-2.5 px-3">Received Date</th>
                        <th className="py-2.5 px-3 text-right">Procurement Total</th>
                        <th className="py-2.5 px-3 text-right">Amount Paid</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Invoice Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!detailSupplier.purchaseOrders || detailSupplier.purchaseOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No purchase orders recorded with this supplier yet.
                          </td>
                        </tr>
                      ) : (
                        detailSupplier.purchaseOrders.map((po) => (
                          <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                              {po.invoiceNo}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {formatDateTime(po.createdAt)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(po.totalAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                              {formatCurrency(po.amountPaid)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`badge ${
                                po.status === 'PAID' ? 'badge-green font-bold' : po.status === 'PARTIAL' ? 'badge-yellow font-bold' : 'badge-red font-bold'
                              }`}>
                                {po.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => {
                                  setViewInvoice({
                                    ...po,
                                    supplier: detailSupplier,
                                    createdBy: po.createdBy,
                                  })
                                }}
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                              >
                                🖨️ View Slip
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setDetailSupplier(null)}
                className="btn-secondary text-xs py-1.5 px-4 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT SUPPLIER MODAL ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editSupplier ? 'Edit Supplier Details' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="label-title">Supplier / Company Name *</label>
                <input
                  className="input text-xs"
                  required
                  placeholder="e.g. Pran Foods Ltd / Teer Consumer Goods"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label-title">Contact Person</label>
                <input
                  className="input text-xs"
                  placeholder="e.g. Mr. Rafiqul Islam"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
              </div>

              <div>
                <label className="label-title">Phone Number</label>
                <input
                  className="input text-xs font-mono"
                  placeholder="01700-000000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="label-title">Address / Warehouse Location</label>
                <textarea
                  className="input text-xs resize-none"
                  rows={2}
                  placeholder="e.g. Plot 14, Tejgaon I/A, Dhaka"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 text-xs font-bold"
                >
                  {saving ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── RECORD PAYMENT MODAL ──────────────────────────────────────────── */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                💳 Settle Supplier Due
              </h3>
              <button onClick={() => setPaymentModal(null)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold">×</button>
            </div>

            <p className="text-xs text-slate-500 mb-2">
              Supplier: <strong>{paymentModal.name}</strong>
            </p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mb-4 text-xs flex justify-between items-center">
              <span className="text-rose-700 font-semibold">Current Balance Due:</span>
              <span className="text-base font-black font-mono text-rose-700">
                {formatCurrency(paymentModal.totalDue)}
              </span>
            </div>

            <form onSubmit={handlePayment} className="space-y-3">
              <div>
                <label className="label-title">Payment Amount (৳) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentModal.totalDue}
                  required
                  className="input text-xs font-mono font-bold text-emerald-700 text-base"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── THERMAL PURCHASE INVOICE MODAL ─────────────────────────────────── */}
      {viewInvoice && (
        <PurchaseReceipt
          purchase={viewInvoice}
          onClose={() => setViewInvoice(null)}
          autoPrint={false}
        />
      )}
    </div>
  )
}
