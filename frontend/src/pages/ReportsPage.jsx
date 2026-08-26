import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../utils/api'
import { formatCurrency, formatDateTime } from '../utils/helpers'
import SalesReportPDF from '../components/SalesReportPDF'
import MonthlyReportPDF from '../components/MonthlyReportPDF'
import toast from 'react-hot-toast'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('pl') // 'pl' | 'valuation' | 'expenses' | 'dead_stock'

  // Date Filters
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)

  // Report Data
  const [report, setReport] = useState(null)
  const [telemetry, setTelemetry] = useState(null)
  const [valuation, setValuation] = useState(null)
  const [valuationLoading, setValuationLoading] = useState(false)
  const [deadStock, setDeadStock] = useState(null)
  const [deadStockDays, setDeadStockDays] = useState('30')
  const [deadStockLoading, setDeadStockLoading] = useState(false)

  // Expenses State
  const [expenses, setExpenses] = useState([])
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [expenseLoading, setExpenseLoading] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'REFRESHMENT',
    amount: '',
    paymentMethod: 'CASH',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [savingExpense, setSavingExpense] = useState(false)

  // PDF Modals
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [showMonthlyPdfModal, setShowMonthlyPdfModal] = useState(false)

  const fetchSalesReport = async () => {
    setLoading(true)
    try {
      const [repRes, dashRes] = await Promise.all([
        api.get(`/reports/sales?from=${from}&to=${to}`),
        api.get('/reports/dashboard'),
      ])
      setReport(repRes.data.data)
      setTelemetry(dashRes.data.data)
    } catch {
      toast.error('Failed to generate sales & P&L report')
    } finally {
      setLoading(false)
    }
  }

  const fetchValuation = async () => {
    setValuationLoading(true)
    try {
      const res = await api.get('/reports/inventory-valuation')
      setValuation(res.data.data)
    } catch {
      toast.error('Failed to calculate inventory valuation')
    } finally {
      setValuationLoading(false)
    }
  }

  const fetchExpenses = async () => {
    setExpenseLoading(true)
    try {
      const res = await api.get(`/expenses?from=${from}&to=${to}`)
      setExpenses(res.data.data?.expenses || [])
      setExpenseTotal(res.data.data?.totalAmount || 0)
    } catch {
      toast.error('Failed to fetch expenses')
    } finally {
      setExpenseLoading(false)
    }
  }

  const fetchDeadStock = async (days = deadStockDays) => {
    setDeadStockLoading(true)
    try {
      const res = await api.get(`/reports/dead-stock?days=${days}`)
      setDeadStock(res.data.data)
    } catch {
      toast.error('Failed to load dead stock report')
    } finally {
      setDeadStockLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'pl') fetchSalesReport()
    else if (activeTab === 'valuation') fetchValuation()
    else if (activeTab === 'expenses') fetchExpenses()
    else if (activeTab === 'dead_stock') fetchDeadStock(deadStockDays)
  }, [activeTab, from, to])

  const setRange = (days) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setTo(end.toISOString().slice(0, 10))
    setFrom(start.toISOString().slice(0, 10))
  }

  const handleSaveExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.title.trim() || !expenseForm.amount) {
      return toast.error('Title and amount are required')
    }

    setSavingExpense(true)
    try {
      await api.post('/expenses', expenseForm)
      toast.success('Daily expense recorded successfully')
      setShowExpenseModal(false)
      setExpenseForm({
        title: '',
        category: 'REFRESHMENT',
        amount: '',
        paymentMethod: 'CASH',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      fetchExpenses()
      fetchSalesReport()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record expense')
    } finally {
      setSavingExpense(false)
    }
  }

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return
    try {
      await api.delete(`/expenses/${id}`)
      toast.success('Expense deleted')
      fetchExpenses()
      fetchSalesReport()
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── TOP HEADER ────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center flex-wrap gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Analytics, Profit & Loss & Inventory Valuation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accurate P&L, stock capital valuation, daily expenses, and dead stock identification
          </p>
        </div>
        {activeTab === 'pl' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!valuation) fetchValuation()
                if (expenses.length === 0) fetchExpenses()
                setShowMonthlyPdfModal(true)
              }}
              className="btn-primary text-xs py-2 px-3.5 shadow-soft-sm font-semibold flex items-center gap-1.5"
            >
              <span>📄 Monthly Statement (A4 PDF)</span>
            </button>
            <button
              onClick={() => setShowPdfModal(true)}
              className="btn-secondary text-xs py-2 px-3 font-semibold flex items-center gap-1.5"
            >
              <span>🧾 80mm POS Slip</span>
            </button>
          </div>
        )}
        {activeTab === 'expenses' && (
          <button
            onClick={() => setShowExpenseModal(true)}
            className="btn-primary text-xs py-2 px-4 shadow-soft-sm font-semibold"
          >
            + Add Daily Expense
          </button>
        )}
      </div>

      {/* ─── NAVIGATION TABS ───────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('pl')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'pl'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          1. Profit & Loss (নিখুঁত লাভ-ক্ষতি)
        </button>

        <button
          onClick={() => setActiveTab('valuation')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'valuation'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          2. Inventory Valuation (দোকানে কত টাকার মাল আছে)
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'expenses'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          3. Daily Expenses (দোকান খরচ)
        </button>

        <button
          onClick={() => setActiveTab('dead_stock')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'dead_stock'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          4. Dead Stock (আটকে থাকা পণ্য)
        </button>
      </div>

      {/* ─── DATE RANGE SELECTOR (FOR P&L AND EXPENSES) ───────────────────── */}
      {(activeTab === 'pl' || activeTab === 'expenses') && (
        <div className="card p-3.5 flex gap-3 items-center flex-wrap bg-white shadow-soft-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">From:</label>
            <input
              type="date"
              className="input text-xs w-36 py-1.5 bg-slate-50 border-slate-300"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">To:</label>
            <input
              type="date"
              className="input text-xs w-36 py-1.5 bg-slate-50 border-slate-300"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setRange(0)} className="btn-secondary text-xs py-1.5 px-3">Today</button>
            <button onClick={() => setRange(7)} className="btn-secondary text-xs py-1.5 px-3">Last 7 Days</button>
            <button onClick={() => setRange(30)} className="btn-secondary text-xs py-1.5 px-3">Last 30 Days</button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: ACCURATE PROFIT & LOSS (নিখুঁত লাভ-ক্ষতি)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pl' && (
        loading ? (
          <div className="card p-12 text-center text-slate-400 text-xs">
            Calculating Profit & Loss statement...
          </div>
        ) : report ? (
          <div className="space-y-6">
            {/* P&L Financial Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Revenue */}
              <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales Revenue</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(report.totalRevenue)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{report.totalTransactions} Completed Invoices</div>
              </div>

              {/* Gross Profit */}
              <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Gross Profit</span>
                  <span className="badge badge-gray text-[9px]">{report.grossProfitMargin}% Margin</span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(report.grossProfit)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sales minus COGS (কেনা দাম)</div>
              </div>

              {/* Total Expenses */}
              <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operating Expenses</div>
                <div className="text-2xl font-black text-slate-800 mt-1">-{formatCurrency(report.totalExpenses)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Shop tea, bill, salary, transport</div>
              </div>

              {/* Net Profit */}
              <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Actual Net Profit</span>
                  <span className={`badge ${report.netProfit >= 0 ? 'badge-green' : 'badge-red'} text-[9px]`}>
                    {report.netProfitMargin}% Net
                  </span>
                </div>
                <div className={`text-2xl font-black mt-1 ${report.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(report.netProfit)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">প্রকৃত নগদ মুনাফা (Realized Profit)</div>
              </div>
            </div>

            {/* P&L Breakdown Summary Table */}
            <div className="card p-5 bg-white border border-slate-200 shadow-soft-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Comprehensive Profit & Loss Statement (লাভ-ক্ষতির বিস্তারিত বিবরণী)
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50/50 font-bold">
                      <td className="py-2.5 px-4 text-slate-900">Total Sales Revenue (মোট বিক্রি)</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900">{formatCurrency(report.totalRevenue)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-600 pl-8">• Cost of Goods Sold (বিক্রিত পণ্যের ক্রয়মূল্য / COGS)</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">-{formatCurrency(report.totalCost)}</td>
                    </tr>
                    <tr className="bg-slate-50/70 font-bold">
                      <td className="py-2.5 px-4 text-slate-800">Gross Profit (মোট বিক্রয় লাভ)</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-800">{formatCurrency(report.grossProfit)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-slate-600 pl-8">• Daily Operating Expenses (দোকান খরচ / চা-নাস্তা, বেতন ইত্যাদি)</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">-{formatCurrency(report.totalExpenses)}</td>
                    </tr>
                    {report.damageLoss > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-600 pl-8">• Damage & Expired Goods Loss (ক্ষতি ও নষ্ট মাল)</td>
                        <td className="py-2.5 px-4 text-right font-mono text-rose-600">-{formatCurrency(report.damageLoss)}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 font-black text-sm">
                      <td className="py-3 px-4 text-slate-900">Actual Net Profit (মাস বা দিনের প্রকৃত লাভ)</td>
                      <td className={`py-3 px-4 text-right font-mono ${report.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {formatCurrency(report.netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chronological Sales & Items Log */}
            <div className="card p-0 overflow-hidden bg-white shadow-soft-sm border border-slate-200">
              <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Item Sales Log (Date & Time Breakdown)
                  </h3>
                  <p className="text-[10px] text-slate-500">Every item sold with timestamp, quantity, customer, and cashier</p>
                </div>
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="btn-secondary text-[11px] py-1 px-3 font-semibold"
                >
                  80mm Thermal Slip
                </button>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4">Invoice No</th>
                      <th className="py-2.5 px-4">Customer / Cashier</th>
                      <th className="py-2.5 px-4">Items Sold & Quantities</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Net Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!report.detailedSales || report.detailedSales.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">No transactions recorded in this period.</td></tr>
                    ) : (
                      report.detailedSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                            {formatDateTime(sale.createdAt)}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                            {sale.invoiceNo}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            <div className="font-semibold text-slate-800">{sale.customer?.name || 'Walk-in'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{sale.cashier?.name ? `By: ${sale.cashier.name}` : ''}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="space-y-0.5 max-w-md">
                              {sale.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-[11px] text-slate-700">
                                  <span>• {item.product?.name || 'Item'} × {item.qty} {item.product?.unit || 'pcs'}</span>
                                  <span className="font-mono text-slate-500 font-medium">৳{parseFloat(item.subtotal).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`badge ${sale.paymentStatus === 'PAID' ? 'badge-green' : sale.paymentStatus === 'PARTIAL' ? 'badge-yellow' : 'badge-red'} text-[9.5px]`}>
                              {sale.paymentStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold font-mono text-slate-900">
                            {formatCurrency(sale.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: INVENTORY VALUATION (দোকানে কত টাকার মাল আছে)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'valuation' && (
        valuationLoading ? (
          <div className="card p-12 text-center text-slate-400 text-xs">
            Calculating total inventory valuation and trapped capital...
          </div>
        ) : valuation ? (
          <div className="space-y-6">
            {/* Valuation KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-5 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Buying Cost (দোকানে কেনা মালের মূল্য)
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {formatCurrency(valuation.totalCostValue)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Trapped capital in {valuation.totalProducts} active product lines ({valuation.totalUnits} total units)
                </div>
              </div>

              <div className="card p-5 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Retail Value (বিক্রয় মূল্য)
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {formatCurrency(valuation.totalRetailValue)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Total gross revenue expected upon full inventory sale
                </div>
              </div>

              <div className="card p-5 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Potential Retail Profit (সম্ভাব্য মোট লাভ)
                </div>
                <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                  {formatCurrency(valuation.potentialProfit)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Gross profit locked inside current warehouse/shop stock
                </div>
              </div>
            </div>

            {/* Category Valuation Breakdown */}
            <div className="card p-5 bg-white border border-slate-200 shadow-soft-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Category-wise Stock Valuation Breakdown
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Category Name</th>
                      <th className="py-2.5 px-4 text-center">Total Units</th>
                      <th className="py-2.5 px-4 text-right">Cost Value (কেনা দাম)</th>
                      <th className="py-2.5 px-4 text-right">Retail Value (বিক্রয় মূল্য)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {valuation.categoryBreakdown?.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{c.name}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-600">{c.units}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{formatCurrency(c.costValue)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">{formatCurrency(c.retailValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Item Valuation Table */}
            <div className="card p-0 overflow-hidden bg-white shadow-soft-sm border border-slate-200">
              <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Product-wise Stock Valuation List
                </h3>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-center">In Stock</th>
                      <th className="py-2.5 px-4 text-right">Unit Cost</th>
                      <th className="py-2.5 px-4 text-right">Unit Sale</th>
                      <th className="py-2.5 px-4 text-right">Trapped Cost Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {valuation.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{item.category}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-800">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">{formatCurrency(item.costPrice)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">{formatCurrency(item.salePrice)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.costValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: EXPENSE MANAGEMENT (প্রাত্যহিক দোকান খরচ ট্র্যাকিং)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Filtered Expenses</div>
              <div className="text-2xl font-black text-rose-600 mt-1 font-mono">{formatCurrency(expenseTotal)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Recorded between {from} and {to}</div>
            </div>

            <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quick Expense Entry</div>
                <div className="text-xs text-slate-600 mt-1">Record tea/snacks, utility bill, salary, or transport</div>
              </div>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="btn-primary text-xs py-2 px-4 font-semibold"
              >
                + Record Expense
              </button>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="card p-0 overflow-hidden bg-white shadow-soft-sm border border-slate-200">
            <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Daily Expense Ledger (দোকানের খরচ খাতা)
              </h3>
              <span className="text-xs text-slate-400 font-mono">{expenses.length} Records</span>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Expense Title</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4">Recorded By</th>
                  <th className="py-2.5 px-4 text-right">Amount (৳)</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenseLoading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading expenses...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">No expenses recorded for this date range. Click "+ Add Daily Expense".</td></tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-600">{formatDateTime(exp.date)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{exp.title}</td>
                      <td className="py-2.5 px-4">
                        <span className="badge badge-gray text-[9.5px]">{exp.category}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{exp.paymentMethod}</td>
                      <td className="py-2.5 px-4 text-slate-500">{exp.createdBy?.name || 'Admin'}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-1"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: DEAD STOCK IDENTIFICATION (৩-৬ মাসে সেল না হওয়া পণ্য)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dead_stock' && (
        <div className="space-y-5">
          <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Dead Stock & Idle Capital Identification
              </h3>
              <p className="text-[11px] text-slate-500">
                Products in stock with 0 sales over the selected period (trapped buying capital)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Period:</span>
              {['30', '60', '90'].map((d) => (
                <button
                  key={d}
                  onClick={() => { setDeadStockDays(d); fetchDeadStock(d) }}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    deadStockDays === d
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Last {d} Days
                </button>
              ))}
            </div>
          </div>

          {/* Metric Cards */}
          {deadStock && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dead Stock Products</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{deadStock.deadProductsCount} Items</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Had 0 customer sales in the last {deadStock.periodDays} days</div>
              </div>

              <div className="card p-4 bg-white border border-slate-200 shadow-soft-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Trapped Capital (আটকে থাকা টাকা)</div>
                <div className="text-2xl font-black text-rose-600 mt-1 font-mono">{formatCurrency(deadStock.totalTrappedCapital)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Put special discount to clear and free up cash flow</div>
              </div>
            </div>
          )}

          {/* Dead Stock Table */}
          <div className="card p-0 overflow-hidden bg-white shadow-soft-sm border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Product Name</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-center">Unsold Stock</th>
                  <th className="py-2.5 px-4 text-right">Buying Cost</th>
                  <th className="py-2.5 px-4 text-right">Trapped Capital</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deadStockLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Analyzing dead stock items...</td></tr>
                ) : !deadStock?.items || deadStock.items.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Great! No dead stock items found in this period.</td></tr>
                ) : (
                  deadStock.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{item.category}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-800">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">{formatCurrency(item.costPrice)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(item.trappedCapital)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ADD EXPENSE MODAL ─────────────────────────────────────────────── */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                Record Daily Expense (দোকানের খরচ এন্ট্রি)
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Expense Purpose / Title *
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  required
                  placeholder="e.g. Staff tea & snacks / কারেন্ট বিল / যাতায়াত"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    className="input text-xs w-full bg-slate-50 border-slate-300 font-medium"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  >
                    <option value="REFRESHMENT">চা ও নাস্তা (Refreshment)</option>
                    <option value="UTILITIES">বিদ্যুৎ ও বিল (Utilities)</option>
                    <option value="SALARY">স্টাফ বেতন (Salary)</option>
                    <option value="RENT">দোকান ভাড়া (Rent)</option>
                    <option value="TRANSPORT">যাতায়াত ও ডেলিভারি</option>
                    <option value="MAINTENANCE">মেরামত ও রক্ষণাবেক্ষণ</option>
                    <option value="OTHER">অন্যান্য খরচ</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Amount (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input text-xs font-mono font-bold w-full bg-slate-50 border-slate-300"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Payment Method
                  </label>
                  <select
                    className="input text-xs w-full bg-slate-50 border-slate-300 font-medium"
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="CARD">Card / Bank</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    className="input text-xs w-full bg-slate-50 border-slate-300 font-mono"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Notes (Optional)
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="Receipt or vendor reference"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn-secondary flex-1 text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="btn-primary flex-1 text-xs py-2 font-semibold"
                >
                  {savingExpense ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PRINTABLE 80MM THERMAL AUDIT SLIP ─────────────────────────────── */}
      {showPdfModal && (
        <SalesReportPDF
          report={report}
          from={from}
          to={to}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* ─── EXECUTIVE A4 MONTHLY FINANCIAL & ANALYTICAL STATEMENT ─────────── */}
      {showMonthlyPdfModal && (
        <MonthlyReportPDF
          report={report}
          valuation={valuation}
          expenses={expenses}
          from={from}
          to={to}
          onClose={() => setShowMonthlyPdfModal(false)}
        />
      )}
    </div>
  )
}
