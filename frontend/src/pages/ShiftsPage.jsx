import { useState, useEffect } from 'react'
import api from '../utils/api'
import { formatCurrency, formatDateTime } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function ShiftsPage() {
  const [liveShift, setLiveShift] = useState(null)
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Day Close Modal
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [openingFloat, setOpeningFloat] = useState('1000')
  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchLiveShift = async () => {
    try {
      const res = await api.get('/shifts/live')
      setLiveShift(res.data.data)
      if (res.data.data?.openingFloat) {
        setOpeningFloat(String(res.data.data.openingFloat))
      }
    } catch {
      console.warn('Failed to load live shift data')
    }
  }

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const [shiftRes, liveRes] = await Promise.all([
        api.get(`/shifts?page=${page}&limit=20`),
        api.get('/shifts/live'),
      ])
      setReports(shiftRes.data.data?.reports || [])
      setTotal(shiftRes.data.data?.total || 0)
      setLiveShift(liveRes.data.data)
      if (liveRes.data.data?.openingFloat) {
        setOpeningFloat(String(liveRes.data.data.openingFloat))
      }
    } catch {
      toast.error('Failed to load shift records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShifts()
  }, [page])

  const calculatedExpected = (parseFloat(openingFloat) || 0) + (liveShift?.cashSales || 0) - (liveShift?.cashExpenses || 0)
  const enteredActual = parseFloat(actualCash) || 0
  const currentVariance = actualCash === '' ? 0 : enteredActual - calculatedExpected

  const handleCloseShift = async (e) => {
    e.preventDefault()
    if (actualCash === '') return toast.error('Please enter the actual counted cash in drawer')

    setSaving(true)
    try {
      const res = await api.post('/shifts/close', {
        openingFloat: parseFloat(openingFloat) || 0,
        actualCash: parseFloat(actualCash) || 0,
        notes,
      })
      const variance = parseFloat(res.data.data.variance)
      if (variance === 0) {
        toast.success('Shift closed! Cash drawer matched perfectly (হিসাব নিখুঁত মিলেছে).')
      } else if (variance > 0) {
        toast.success(`Shift closed! Drawer excess by +${formatCurrency(variance)}`)
      } else {
        toast.error(`Shift closed! Drawer shortage by ${formatCurrency(variance)} (ক্যাশ ঘাটতি)`)
      }
      setShowCloseModal(false)
      setActualCash('')
      setNotes('')
      fetchShifts()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close shift')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── HEADER & ACTIONS ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Cash Drawer & Daily Shift Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated real-time cash drawer tracking, daily rollover, and cash variance audit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLiveShift}
            className="btn-secondary text-xs py-2 px-3 font-semibold"
            title="Refresh Live Data"
          >
            🔄 Refresh Live
          </button>
          <button
            onClick={() => setShowCloseModal(true)}
            className="btn-primary text-xs py-2 px-4 shadow-soft-sm font-semibold"
          >
            💰 Verify & Close Shift
          </button>
        </div>
      </div>

      {/* ─── LIVE REAL-TIME CASH DRAWER TELEMETRY CARD ──────────────────────── */}
      {liveShift && (
        <div className="card p-5 bg-white border border-slate-200 shadow-soft-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Live Active Cash Drawer Status (আজকের রিয়েল-টাইম হিসাব)
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Date: {liveShift.date} • {liveShift.totalTransactions} Invoices
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Opening Float */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase">1. Opening Float</div>
              <div className="text-lg font-black text-slate-800 font-mono">
                {formatCurrency(liveShift.openingFloat)}
              </div>
              <div className="text-[9.5px] text-slate-400">শুরুর ক্যাশ ফ্লোট</div>
            </div>

            {/* Cash Sales Inflow */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase">2. Cash Sales (+)</div>
              <div className="text-lg font-black text-emerald-600 font-mono">
                +{formatCurrency(liveShift.cashSales)}
              </div>
              <div className="text-[9.5px] text-slate-400">মোট নগদ বিক্রি</div>
            </div>

            {/* Cash Expenses */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase">3. Cash Expenses (-)</div>
              <div className="text-lg font-black text-rose-600 font-mono">
                -{formatCurrency(liveShift.cashExpenses)}
              </div>
              <div className="text-[9.5px] text-slate-400">দোকান খরচ (চা/বিল)</div>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl space-y-1 md:col-span-2">
              <div className="text-[10px] font-bold text-slate-700 uppercase flex justify-between items-center">
                <span>= Expected Cash in Drawer</span>
                <span className="badge badge-gray text-[9px]">Live Calculated</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {formatCurrency(liveShift.expectedCash)}
              </div>
              <div className="text-[10px] text-slate-500">
                বাক্সে বর্তমানে এই পরিমাণ নগদ টাকা থাকার কথা (Opening + Cash Sales - Expenses)
              </div>
            </div>
          </div>

          {/* Digital and Total Revenue Secondary Row */}
          <div className="flex gap-4 pt-2 border-t border-slate-100 text-xs text-slate-600 flex-wrap">
            <span>• Digital MFS Inflow (bKash/Nagad/Card): <strong className="font-mono text-slate-900">{formatCurrency(liveShift.digitalSales)}</strong></span>
            <span>• Store Credit Due Sales: <strong className="font-mono text-slate-900">{formatCurrency(liveShift.creditSales)}</strong></span>
            <span>• Total Today's Sales Revenue: <strong className="font-mono text-slate-900">{formatCurrency(liveShift.totalSalesRevenue)}</strong></span>
          </div>
        </div>
      )}

      {/* ─── HISTORICAL SHIFT REPORTS TABLE ────────────────────────────────── */}
      <div className="card p-0 overflow-hidden bg-white shadow-soft-sm border border-slate-200">
        <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Shift Audit History & Day-End Logs
            </h3>
            <p className="text-[10px] text-slate-500">Auto day-end closures and cashier cash reconciliations</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Showing {reports.length} of {total}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4">Cashier / Reconciled By</th>
                <th className="py-2.5 px-4 text-right">Opening Float</th>
                <th className="py-2.5 px-4 text-right">Expected Cash</th>
                <th className="py-2.5 px-4 text-right">Actual Counted</th>
                <th className="py-2.5 px-4 text-center">Variance (ঘাটতি/উদ্বৃত্ত)</th>
                <th className="py-2.5 px-4 text-right">Total Sales</th>
                <th className="py-2.5 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading shift audit history...</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">No shift close records yet. Click "Verify & Close Shift" above.</td></tr>
              ) : (
                reports.map((r) => {
                  const variance = parseFloat(r.variance) || 0
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatDateTime(r.closedAt)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {r.cashier?.name || 'Auto System'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(r.openingFloat)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(r.expectedCash)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(r.actualCash)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {variance === 0 ? (
                          <span className="badge badge-green text-[9.5px]">Matched (0.00)</span>
                        ) : variance > 0 ? (
                          <span className="badge badge-yellow text-[9.5px]">+{formatCurrency(variance)} Excess</span>
                        ) : (
                          <span className="badge badge-red text-[9.5px]">{formatCurrency(variance)} Shortage</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(r.totalSales)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px] truncate max-w-xs">
                        {r.notes || '—'}
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
          <span>Total {total} shift records</span>
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

      {/* ─── CLOSE SHIFT & RECONCILE MODAL ─────────────────────────────────── */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Verify Cash Drawer & Close Shift
              </h3>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-3.5">
              {/* Expected Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase">System Calculated Expected Cash</div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {formatCurrency(calculatedExpected)}
                </div>
                <div className="text-[10px] text-slate-400">
                  Opening Float ({formatCurrency(openingFloat || 0)}) + Cash Sales ({formatCurrency(liveShift?.cashSales || 0)}) - Expenses ({formatCurrency(liveShift?.cashExpenses || 0)})
                </div>
              </div>

              {/* Opening Float input */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Opening Float (ক্যাশ ড্রয়ারের শুরুর টাকা)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-xs font-mono font-bold w-full bg-slate-50 border-slate-300"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                />
              </div>

              {/* Actual Cash Counted input */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Actual Counted Cash in Drawer (ড্রয়ার গুনে পাওয়া নগদ টাকা) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  required
                  placeholder="0.00"
                  className="input text-lg font-mono font-bold w-full bg-slate-50 border-slate-300 text-slate-900"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                />
              </div>

              {/* Real-time Variance feedback */}
              {actualCash !== '' && (
                <div className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                  currentVariance === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : currentVariance > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div>
                    <span className="font-bold block">
                      {currentVariance === 0 ? 'Exact Match (হিসাব মিলেছে)' : currentVariance > 0 ? 'Drawer Excess (+বেশি)' : 'Cash Shortage (-ঘাটতি)'}
                    </span>
                    <span className="text-[10px]">Difference from expected</span>
                  </div>
                  <div className="text-base font-black font-mono">
                    {currentVariance >= 0 ? `+${formatCurrency(currentVariance)}` : formatCurrency(currentVariance)}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Notes / Handover Reference
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="e.g. Handed over to night shift"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="btn-secondary flex-1 text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 text-xs py-2 font-semibold"
                >
                  {saving ? 'Reconciling...' : 'Confirm & Close Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
