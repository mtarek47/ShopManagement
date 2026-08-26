import { useState, useEffect } from 'react'
import api from '../utils/api'
import { formatCurrency, formatDateTime } from '../utils/helpers'
import ThermalReceipt from '../components/ThermalReceipt'
import toast from 'react-hot-toast'

const EMPTY_CUSTOMER = { name: '', phone: '', email: '', address: '', initialDue: '' }

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'due_only' | 'loyalty_only'
  const [loading, setLoading] = useState(true)

  // Metrics
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    totalDue: 0,
    totalPoints: 0,
    dueAccounts: 0,
  })

  // Add/Edit Customer Modal
  const [showModal, setShowModal] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [form, setForm] = useState(EMPTY_CUSTOMER)
  const [saving, setSaving] = useState(false)

  // Customer Details Modal
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerDetails, setCustomerDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Collect Due Modal
  const [dueModalCustomer, setDueModalCustomer] = useState(null)
  const [dueAmount, setDueAmount] = useState('')
  const [dueMethod, setDueMethod] = useState('CASH')
  const [dueNotes, setDueNotes] = useState('')
  const [collectingDue, setCollectingDue] = useState(false)

  // Adjust Loyalty Points Modal
  const [pointsCustomer, setPointsCustomer] = useState(null)
  const [pointsAdjustment, setPointsAdjustment] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [adjustingPoints, setAdjustingPoints] = useState(false)

  // Receipt Modal
  const [viewInvoice, setViewInvoice] = useState(null)

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (search) params.append('search', search)
      if (filter !== 'all') params.append('filter', filter)

      const res = await api.get(`/customers?${params}`)
      const list = res.data.data?.customers || []
      setCustomers(list)
      setTotal(res.data.data?.total || 0)

      let sumDue = 0
      let sumPoints = 0
      let countDue = 0
      list.forEach((c) => {
        const d = parseFloat(c.storeCreditDue) || 0
        const p = parseInt(c.loyaltyPoints) || 0
        if (d > 0) countDue++
        sumDue += d
        sumPoints += p
      })

      setMetrics({
        totalCustomers: res.data.data?.total || list.length,
        totalDue: sumDue,
        totalPoints: sumPoints,
        dueAccounts: countDue,
      })
    } catch {
      toast.error('Failed to load customers directory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [page, filter])

  const openAdd = () => {
    setEditCustomer(null)
    setForm(EMPTY_CUSTOMER)
    setShowModal(true)
  }

  const openEdit = (c, e) => {
    if (e) e.stopPropagation()
    setEditCustomer(c)
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      initialDue: c.storeCreditDue || '',
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error('Customer name and phone number are required')
    }

    setSaving(true)
    try {
      if (editCustomer) {
        await api.put(`/customers/${editCustomer.id}`, form)
        toast.success('Customer profile updated successfully')
      } else {
        await api.post('/customers', form)
        toast.success('Customer registered successfully')
      }
      setShowModal(false)
      fetchCustomers()
      if (selectedCustomer && selectedCustomer.id === editCustomer?.id) {
        viewCustomerDetails(selectedCustomer)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer profile')
    } finally {
      setSaving(false)
    }
  }

  const viewCustomerDetails = async (c) => {
    setSelectedCustomer(c)
    setDetailsLoading(true)
    try {
      const res = await api.get(`/customers/${c.id}`)
      setCustomerDetails(res.data.data)
    } catch {
      toast.error('Failed to load customer profile details')
    } finally {
      setDetailsLoading(false)
    }
  }

  const openDueModal = (c, e) => {
    if (e) e.stopPropagation()
    setDueModalCustomer(c)
    setDueAmount(c.storeCreditDue ? String(c.storeCreditDue) : '')
    setDueMethod('CASH')
    setDueNotes('')
  }

  const handleCollectDue = async (e) => {
    e.preventDefault()
    const amt = parseFloat(dueAmount)
    if (!amt || amt <= 0) return toast.error('Please enter a valid due payment amount')

    setCollectingDue(true)
    try {
      const res = await api.post(`/customers/${dueModalCustomer.id}/due-payment`, {
        amount: amt,
        method: dueMethod,
        notes: dueNotes,
      })
      toast.success(res.data?.message || `৳${amt} due collected successfully`)
      setDueModalCustomer(null)
      fetchCustomers()
      if (selectedCustomer && selectedCustomer.id === dueModalCustomer.id) {
        viewCustomerDetails(selectedCustomer)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record due payment')
    } finally {
      setCollectingDue(false)
    }
  }

  const openPointsModal = (c, e) => {
    if (e) e.stopPropagation()
    setPointsCustomer(c)
    setPointsAdjustment('')
    setPointsReason('')
  }

  const handleAdjustPoints = async (e) => {
    e.preventDefault()
    const pts = parseInt(pointsAdjustment)
    if (isNaN(pts) || pts === 0) return toast.error('Enter valid points value')

    setAdjustingPoints(true)
    try {
      const res = await api.post(`/customers/${pointsCustomer.id}/adjust-points`, {
        points: pts,
        reason: pointsReason,
      })
      toast.success(res.data?.message || `Loyalty points adjusted successfully`)
      setPointsCustomer(null)
      fetchCustomers()
      if (selectedCustomer && selectedCustomer.id === pointsCustomer.id) {
        viewCustomerDetails(selectedCustomer)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to adjust points')
    } finally {
      setAdjustingPoints(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── HEADER & ACTIONS ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Customers & CRM
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer directory, store credit due ledger, purchase history, and loyalty reward points
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn-primary text-xs py-2 px-4 shadow-soft-sm font-semibold"
        >
          + Add Customer
        </button>
      </div>

      {/* ─── CRM KPI METRIC CARDS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Customers</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Registered in Directory</div>
        </div>

        <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>Outstanding Due</span>
            {metrics.dueAccounts > 0 && (
              <span className="badge badge-red text-[9px]">{metrics.dueAccounts} Due Accts</span>
            )}
          </div>
          <div className={`text-2xl font-black mt-1 ${metrics.totalDue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {formatCurrency(metrics.totalDue)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Store Credit to Collect</div>
        </div>

        <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Loyalty Points</div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {metrics.totalPoints.toLocaleString()} <span className="text-xs font-normal text-slate-500 font-mono">pts</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active Customer Reward Points</div>
        </div>

        <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reward Cash Value</div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {formatCurrency(metrics.totalPoints)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">1 Point = ৳1.00 Discount</div>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="card p-3 bg-white border border-slate-200 shadow-soft-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={() => { setFilter('all'); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Customers ({total})
          </button>
          <button
            onClick={() => { setFilter('due_only'); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'due_only'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Has Store Due
          </button>
          <button
            onClick={() => { setFilter('loyalty_only'); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'loyalty_only'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Loyalty Point Holders
          </button>
        </div>

        <div className="flex gap-2 w-full md:w-80">
          <input
            className="input text-xs w-full bg-slate-50 border-slate-300"
            placeholder="Search name, phone, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()}
          />
          <button
            onClick={fetchCustomers}
            className="btn-primary text-xs px-3.5 font-semibold"
          >
            Search
          </button>
        </div>
      </div>

      {/* ─── CUSTOMERS DIRECTORY TABLE ────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden bg-white shadow-soft-sm border border-slate-200">
        <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Customer Profiles & Due Ledger
            </h3>
            <p className="text-[10px] text-slate-500">Click any customer row to view full purchase history and orders</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Showing {customers.length} of {total}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Customer Details</th>
                <th className="py-2.5 px-4">Contact Phone</th>
                <th className="py-2.5 px-4 text-center">Loyalty Points</th>
                <th className="py-2.5 px-4 text-right">Store Due (বাকি)</th>
                <th className="py-2.5 px-4 text-center">Orders</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading customers directory...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">No customers found. Click "+ Add Customer" above.</td></tr>
              ) : (
                customers.map((c) => {
                  const due = parseFloat(c.storeCreditDue) || 0
                  const pts = parseInt(c.loyaltyPoints) || 0
                  return (
                    <tr
                      key={c.id}
                      onClick={() => viewCustomerDetails(c)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600">
                          {c.name}
                        </div>
                        {c.address && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{c.address}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {c.phone}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="badge badge-gray text-[10px]">
                          {pts} pts
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {due > 0 ? (
                          <span className="font-bold font-mono text-rose-600 text-xs">
                            {formatCurrency(due)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">৳0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700 font-mono">
                        {c._count?.sales ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end items-center gap-1.5">
                          {due > 0 && (
                            <button
                              onClick={(e) => openDueModal(c, e)}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs"
                              title="Collect Store Due"
                            >
                              Collect Due
                            </button>
                          )}
                          <button
                            onClick={() => viewCustomerDetails(c)}
                            className="btn-secondary text-[11px] py-1 px-2.5 font-semibold"
                            title="View Purchase History"
                          >
                            History
                          </button>
                          <button
                            onClick={(e) => openEdit(c, e)}
                            className="btn-secondary text-[11px] py-1 px-2 font-medium"
                            title="Edit Customer"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Total {total} customers</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="py-1 px-2 font-mono">Page {page}</span>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ─── CUSTOMER FULL DETAILS MODAL (CLEAN SLATE THEME) ────────────────── */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Top Bar */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold border border-slate-200 font-mono">
                  {selectedCustomer.name?.substring(0, 2).toUpperCase() || 'CU'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      {selectedCustomer.name}
                    </h3>
                    <span className="badge badge-gray text-[9.5px]">
                      ID: {selectedCustomer.id.substring(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Phone: {selectedCustomer.phone} {selectedCustomer.address ? `• ${selectedCustomer.address}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(selectedCustomer)}
                  className="btn-secondary text-xs py-1.5 px-3 font-semibold"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => { setSelectedCustomer(null); setCustomerDetails(null) }}
                  className="text-slate-400 hover:text-slate-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
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
                    Customer Information
                  </div>
                  <div><span className="text-slate-400">Phone:</span> <strong className="text-slate-800 font-mono">{selectedCustomer.phone}</strong></div>
                  <div><span className="text-slate-400">Email:</span> <span className="text-slate-700">{selectedCustomer.email || '—'}</span></div>
                  <div><span className="text-slate-400">Address:</span> <span className="text-slate-700">{selectedCustomer.address || '—'}</span></div>
                </div>

                {/* Orders Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs flex flex-col justify-between">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Total Orders Placed
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      {customerDetails?.sales?.length || 0} Invoices
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Total Purchased: {formatCurrency(
                        customerDetails?.sales?.reduce((sum, s) => sum + parseFloat(s.totalAmount || 0), 0) || 0
                      )}
                    </div>
                  </div>
                </div>

                {/* Due & Loyalty Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                        Store Due (বাকি)
                      </span>
                      <span className={`font-black font-mono text-sm ${parseFloat(selectedCustomer.storeCreditDue || 0) > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {formatCurrency(selectedCustomer.storeCreditDue || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Loyalty Points:</span>
                      <span className="font-bold text-slate-800 font-mono">{selectedCustomer.loyaltyPoints || 0} pts</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {parseFloat(selectedCustomer.storeCreditDue || 0) > 0 && (
                      <button
                        onClick={(e) => openDueModal(selectedCustomer, e)}
                        className="btn-primary text-[10px] py-1 px-2.5 flex-1 font-semibold"
                      >
                        Collect Due
                      </button>
                    )}
                    <button
                      onClick={(e) => openPointsModal(selectedCustomer, e)}
                      className="btn-secondary text-[10px] py-1 px-2.5 flex-1 font-semibold"
                    >
                      Adjust Pts
                    </button>
                  </div>
                </div>
              </div>

              {/* Purchase History Table Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Purchase Orders & Invoices History
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {customerDetails?.sales?.length || 0} records
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Date & Time</th>
                        <th className="py-2.5 px-4">Invoice No</th>
                        <th className="py-2.5 px-4">Items Summary</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailsLoading ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading purchase history...</td></tr>
                      ) : !customerDetails?.sales || customerDetails.sales.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-400">No purchase records found for this customer.</td></tr>
                      ) : (
                        customerDetails.sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                              {formatDateTime(sale.createdAt)}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                              {sale.invoiceNo}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700">
                              <span className="font-medium">{sale.items?.length || 0} Items</span>
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                {sale.items?.map((i) => `${i.product?.name} (${i.qty})`).join(', ')}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`badge ${
                                sale.paymentStatus === 'PAID' ? 'badge-green' : sale.paymentStatus === 'PARTIAL' ? 'badge-yellow' : 'badge-red'
                              } text-[9.5px]`}>
                                {sale.paymentStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(sale.totalAmount)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                onClick={() => setViewInvoice(sale)}
                                className="btn-secondary text-[10px] py-1 px-2.5 font-semibold"
                              >
                                View Slip
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

            {/* Modal Bottom Bar */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => { setSelectedCustomer(null); setCustomerDetails(null) }}
                className="btn-secondary text-xs py-1.5 px-4 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT CUSTOMER MODAL ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                {editCustomer ? 'Edit Customer Profile' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Customer Full Name *
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  required
                  placeholder="e.g. Rahim Uddin"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Contact Phone Number *
                </label>
                <input
                  className="input text-xs font-mono w-full bg-slate-50 border-slate-300"
                  required
                  placeholder="01XXXXXXXXX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="customer@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Delivery / Residential Address
                </label>
                <textarea
                  rows={2}
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="House, Road, Area, Dhaka"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {!editCustomer && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Opening Due Balance (বাকি থাকলে)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input text-xs font-mono w-full bg-slate-50 border-slate-300"
                    placeholder="0.00"
                    value={form.initialDue}
                    onChange={(e) => setForm({ ...form, initialDue: e.target.value })}
                  />
                </div>
              )}

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 text-xs py-2 font-semibold"
                >
                  {saving ? 'Saving...' : editCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── COLLECT STORE DUE MODAL ───────────────────────────────────────── */}
      {dueModalCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                Collect Store Due (বাকি পরিশোধ)
              </h3>
              <button
                onClick={() => setDueModalCustomer(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCollectDue} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Customer</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{dueModalCustomer.name}</div>
                <div className="text-xs text-slate-600 font-mono mt-1">
                  Current Due: <strong className="text-rose-600">{formatCurrency(dueModalCustomer.storeCreditDue || 0)}</strong>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Payment Collection Amount (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-base font-bold font-mono w-full bg-slate-50 border-slate-300"
                  required
                  placeholder="0.00"
                  value={dueAmount}
                  onChange={(e) => setDueAmount(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Payment Method
                  </label>
                  <select
                    className="input text-xs w-full bg-slate-50 border-slate-300 font-medium"
                    value={dueMethod}
                    onChange={(e) => setDueMethod(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="CARD">Bank Card</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Remaining Due
                  </label>
                  <div className="input text-xs font-bold font-mono w-full bg-slate-100 border-slate-200 flex items-center text-slate-800">
                    {formatCurrency(Math.max(0, parseFloat(dueModalCustomer.storeCreditDue || 0) - (parseFloat(dueAmount) || 0)))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Notes / Receipt Reference (Optional)
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="e.g. Paid via bKash TrxID"
                  value={dueNotes}
                  onChange={(e) => setDueNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDueModalCustomer(null)}
                  className="btn-secondary flex-1 text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collectingDue}
                  className="btn-primary flex-1 text-xs py-2 font-semibold"
                >
                  {collectingDue ? 'Recording...' : 'Confirm Due Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADJUST LOYALTY POINTS MODAL ────────────────────────────────────── */}
      {pointsCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                Adjust Loyalty Points
              </h3>
              <button
                onClick={() => setPointsCustomer(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAdjustPoints} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Customer</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{pointsCustomer.name}</div>
                <div className="text-xs text-slate-600 font-mono mt-1">
                  Current Points: <strong className="text-slate-900">{pointsCustomer.loyaltyPoints || 0} pts</strong>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Points to Add / Deduct (+/-) *
                </label>
                <input
                  type="number"
                  className="input text-base font-bold font-mono w-full bg-slate-50 border-slate-300"
                  required
                  placeholder="e.g. 50 (or -50 to deduct)"
                  value={pointsAdjustment}
                  onChange={(e) => setPointsAdjustment(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Reason for Adjustment
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="e.g. Festival bonus / Correction"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPointsCustomer(null)}
                  className="btn-secondary flex-1 text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustingPoints}
                  className="btn-primary flex-1 text-xs py-2 font-semibold"
                >
                  {adjustingPoints ? 'Saving...' : 'Save Points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── THERMAL RECEIPT REPRINT MODAL ─────────────────────────────────── */}
      {viewInvoice && (
        <ThermalReceipt
          sale={viewInvoice}
          onClose={() => setViewInvoice(null)}
        />
      )}
    </div>
  )
}
