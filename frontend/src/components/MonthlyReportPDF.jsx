import { useState, useEffect } from 'react'
import api from '../utils/api'
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers'

export default function MonthlyReportPDF({
  report: initialReport,
  valuation: initialValuation,
  expenses: initialExpenses,
  from: initialFrom,
  to: initialTo,
  onClose,
}) {
  // Format mode: 'A4' (Full Accounting Statement) or 'THERMAL_80MM' (Thermal Roll Slip)
  const [printFormat, setPrintFormat] = useState('A4')

  // Date selection state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [fromDate, setFromDate] = useState(initialFrom || '')
  const [toDate, setToDate] = useState(initialTo || '')
  const [isCustomDate, setIsCustomDate] = useState(false)

  // Live Data State
  const [report, setReport] = useState(initialReport)
  const [valuation, setValuation] = useState(initialValuation)
  const [expenses, setExpenses] = useState(initialExpenses || [])
  const [loading, setLoading] = useState(false)

  const [shopSettings, setShopSettings] = useState({
    shopName: 'Smart Buy',
    shopSubtitle: 'Supershop & Departmental Store',
    shopAddress: 'House #12, Road #04, Dhanmondi, Dhaka',
    shopPhone: '01700-000000',
    vatRegNo: '002391048-0101',
    shopLogo: null,
  })

  // Generate Month Options for past 12 months
  const monthOptions = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    monthOptions.push({ value: val, label, year: d.getFullYear(), month: d.getMonth() })
  }

  // Load shop settings
  useEffect(() => {
    api.get('/admin/settings')
      .then((res) => {
        if (res.data?.data) {
          setShopSettings((prev) => ({ ...prev, ...res.data.data }))
        }
      })
      .catch(() => {})
  }, [])

  // Fetch report data whenever month or custom date range changes
  const fetchMonthData = async (start, end) => {
    setLoading(true)
    try {
      const [repRes, valRes, expRes] = await Promise.all([
        api.get(`/reports/sales?from=${start}&to=${end}`),
        api.get('/reports/inventory-valuation'),
        api.get(`/expenses?from=${start}&to=${end}`),
      ])
      if (repRes.data?.data) setReport(repRes.data.data)
      if (valRes.data?.data) setValuation(valRes.data.data)
      if (expRes.data?.data) setExpenses(expRes.data.data.expenses || expRes.data.data || [])
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false)
    }
  }

  // Handle Month Selector change
  const handleMonthSelect = (monthVal) => {
    setSelectedMonth(monthVal)
    if (monthVal === 'CUSTOM') {
      setIsCustomDate(true)
      return
    }
    setIsCustomDate(false)
    const [year, month] = monthVal.split('-').map(Number)
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10)
    const end = new Date(year, month, 0).toISOString().slice(0, 10)
    setFromDate(start)
    setToDate(end)
    fetchMonthData(start, end)
  }

  // Initialize with selected month on mount if not provided
  useEffect(() => {
    if (!initialFrom || !initialTo) {
      handleMonthSelect(selectedMonth)
    }
  }, [])

  const handleCustomDateSubmit = (e) => {
    e.preventDefault()
    if (fromDate && toDate) {
      fetchMonthData(fromDate, toDate)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (!report) return null

  const salesList = report.detailedSales || []

  // Payment Breakdown
  let cashTotal = 0
  let digitalTotal = 0
  let dueTotal = 0

  salesList.forEach((s) => {
    s.payments?.forEach((p) => {
      const amt = parseFloat(p.amount) || 0
      if (p.method === 'CASH') cashTotal += amt
      else if (p.method === 'STORE_CREDIT') dueTotal += amt
      else digitalTotal += amt
    })
  })

  // Group Expenses by Category
  const expenseByCategory = {}
  if (Array.isArray(expenses)) {
    expenses.forEach((e) => {
      const cat = e.category || 'OTHER'
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + parseFloat(e.amount || 0)
    })
  }

  const statementRef = `STMT-${fromDate ? fromDate.replace(/-/g, '').slice(0, 6) : '2026'}-${String(Math.floor(Math.random() * 900) + 100)}`

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto font-sans">
      {/* ─── MODAL CONTAINER ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col border border-slate-300 overflow-hidden">
        {/* Top Control Bar (Clean Platinum / Slate Header) */}
        <div className="p-3.5 bg-slate-50 text-slate-900 flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 print:hidden">
          {/* Left: Title & Month Picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
              <span>📊 Financial Statement</span>
            </div>

            {/* Month Dropdown Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500">Month (মাস):</span>
              <select
                value={isCustomDate ? 'CUSTOM' : selectedMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
                <option value="CUSTOM">Custom Date Range (কাস্টম তারিখ)...</option>
              </select>
            </div>

            {/* Custom Date Range Pickers if selected */}
            {isCustomDate && (
              <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input text-xs py-1 px-2 font-mono bg-white border-slate-300"
                  required
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input text-xs py-1 px-2 font-mono bg-white border-slate-300"
                  required
                />
                <button
                  type="submit"
                  className="btn-secondary text-xs py-1 px-2.5 font-bold"
                >
                  Load
                </button>
              </form>
            )}

            {/* Format Toggle: A4 vs 80mm Thermal */}
            <div className="flex items-center bg-slate-200 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  printFormat === 'A4'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A4 Statement
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('THERMAL_80MM')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  printFormat === 'THERMAL_80MM'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm Thermal Slip
              </button>
            </div>
          </div>

          {/* Right: Print & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="btn-primary text-xs py-1.5 px-4 font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-2xs"
            >
              <span>{printFormat === 'A4' ? 'Print A4 / Save PDF' : 'Print 80mm Thermal'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none px-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* ─── SCROLLABLE PREVIEW CANVAS (Clean Platinum Neutral) ──────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/90 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-medium">
              Generating financial statement for {selectedMonth}...
            </div>
          ) : printFormat === 'A4' ? (
            /* ═════════════════════════════════════════════════════════════════
               1. PRISTINE A4 ACCOUNTING STATEMENT
            ═════════════════════════════════════════════════════════════════ */
            <div
              id="printable-monthly-statement"
              className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 sm:p-12 shadow-md border border-slate-300 text-[11px] leading-relaxed select-none print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full space-y-6"
              style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
            >
              {/* ─── 1. EXECUTIVE STATEMENT HEADER ─────────────────────────── */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    {shopSettings.shopLogo && (
                      <img
                        src={shopSettings.shopLogo}
                        alt="Logo"
                        className="w-12 h-12 object-contain border border-slate-200 rounded p-1 bg-white"
                      />
                    )}
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                        {shopSettings.shopName || 'SMART BUY'}
                      </h1>
                      {shopSettings.shopSubtitle && (
                        <p className="text-xs font-semibold text-slate-600">{shopSettings.shopSubtitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-2 space-y-0.5">
                    <div>{shopSettings.shopAddress}</div>
                    <div>Hotline: <strong className="font-mono text-slate-800">{shopSettings.shopPhone}</strong></div>
                    {shopSettings.vatRegNo && (
                      <div>BIN / VAT Registration: <strong className="font-mono text-slate-800">{shopSettings.vatRegNo}</strong></div>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="inline-block bg-slate-100 text-slate-900 font-black px-3 py-1 rounded text-xs uppercase tracking-wider border border-slate-300">
                    Monthly Financial Statement
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 pt-1">
                    Ref: <strong className="text-slate-800">{statementRef}</strong>
                  </div>
                  <div className="text-[10px] text-slate-700">
                    Statement Period: <strong className="font-mono text-slate-950">{formatDate(fromDate)}</strong> to <strong className="font-mono text-slate-950">{formatDate(toDate)}</strong>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Printed On: {formatDateTime(new Date())}
                  </div>
                </div>
              </div>

              {/* ─── 2. STATEMENT OF PROFIT & LOSS ─────────────────────────── */}
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-slate-300 pb-1">
                  <h2 className="text-xs font-black text-slate-950 uppercase tracking-wider">
                    I. Statement of Profit & Loss (বিশদ আয়-ব্যয় ও লাভ-ক্ষতি বিবরণী)
                  </h2>
                  <span className="text-[10px] text-slate-500 font-mono">Amounts in BDT (৳)</span>
                </div>

                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 border-r border-slate-300">Particulars / Line Item</th>
                      <th className="py-2 px-3 text-right w-44">Amount (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 px-3 text-slate-900 font-semibold">Gross Sales Revenue (মোট বিক্রয়)</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(report.totalRevenue + (report.totalDiscounts || 0))}
                      </td>
                    </tr>

                    {report.totalDiscounts > 0 && (
                      <tr>
                        <td className="py-1.5 px-3 pl-8 text-slate-600">Less: Sales Discounts Allowed (বাদ: ডিসকাউন্ট)</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                          -{formatCurrency(report.totalDiscounts)}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-slate-50 font-bold">
                      <td className="py-2 px-3 text-slate-900">Net Sales Revenue (প্রকৃত বিক্রয় আয়)</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-900">
                        {formatCurrency(report.totalRevenue)}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-1.5 px-3 pl-8 text-slate-600">Less: Cost of Goods Sold (বিক্রিত পণ্যের ক্রয়মূল্য / COGS)</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                        -{formatCurrency(report.totalCost)}
                      </td>
                    </tr>

                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <td className="py-2 px-3 text-slate-950 flex justify-between">
                        <span>Gross Profit (মোট লাভ / মুনাফা)</span>
                        <span className="text-[10px] font-normal text-slate-600 font-mono">Gross Margin: {report.grossProfitMargin}%</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-950 font-black">
                        {formatCurrency(report.grossProfit)}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-1.5 px-3 pl-8 text-slate-600">Less: Operational & Shop Expenses (দোকানের খরচ)</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                        -{formatCurrency(report.totalExpenses)}
                      </td>
                    </tr>

                    {report.damageLoss > 0 && (
                      <tr>
                        <td className="py-1.5 px-3 pl-8 text-slate-600">Less: Damaged / Expired Stock Loss (নষ্ট ও ক্ষতি)</td>
                        <td className="py-1.5 px-3 text-right font-mono text-rose-700">
                          -{formatCurrency(report.damageLoss)}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-slate-200/90 font-black text-sm border-t-2 border-b-2 border-slate-900">
                      <td className="py-2.5 px-3 text-slate-950 flex justify-between items-center">
                        <span>ACTUAL NET PROFIT (প্রকৃত নীট মুনাফা)</span>
                        <span className="text-[11px] font-semibold text-slate-700 font-mono">Net Margin: {report.netProfitMargin}%</span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${report.netProfit >= 0 ? 'text-slate-950' : 'text-rose-700'}`}>
                        {formatCurrency(report.netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ─── 3. PAYMENT CHANNELS & EXPENSE BREAKDOWN ───────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-1">
                    II. Revenue Settlement Channels (আদায় বিবরণী)
                  </h3>
                  <table className="w-full text-xs border border-slate-300">
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-1.5 px-2.5 text-slate-700">1. Cash Inflow (নগদ আদায়)</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(cashTotal)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2.5 text-slate-700">2. Digital MFS (bKash / Nagad / Card)</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(digitalTotal)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2.5 text-slate-700">3. Customer Store Credit (বাকিতে বিক্রয়)</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(dueTotal)}</td>
                      </tr>
                      <tr className="bg-slate-100 font-bold">
                        <td className="py-1.5 px-2.5 text-slate-900">Total Settled</td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-900">{formatCurrency(cashTotal + digitalTotal + dueTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-1">
                    III. Operating Expenses Breakdown (খরচের খাতসমূহ)
                  </h3>
                  <table className="w-full text-xs border border-slate-300">
                    <tbody className="divide-y divide-slate-200">
                      {Object.keys(expenseByCategory).length === 0 ? (
                        <tr><td colSpan={2} className="py-2 text-center text-slate-400">No expenses recorded in this period</td></tr>
                      ) : (
                        Object.entries(expenseByCategory).map(([cat, amt]) => (
                          <tr key={cat}>
                            <td className="py-1.5 px-2.5 text-slate-700">{cat}</td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-slate-900">{formatCurrency(amt)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-slate-100 font-bold">
                        <td className="py-1.5 px-2.5 text-slate-900">Total Expenses</td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-900">{formatCurrency(report.totalExpenses)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── 4. INVENTORY CAPITAL POSITION ─────────────────────────── */}
              {valuation && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-1">
                    IV. Inventory & Capital Position (সমাপনী মজুদ ও মূলধন স্থিতি)
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-xs border border-slate-300 p-3 bg-slate-50">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Active SKUs</span>
                      <strong className="font-mono text-slate-900 text-sm">{valuation.totalProducts} Lines ({valuation.totalUnits} Units)</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Trapped Buying Capital (ক্রয়মূল্য)</span>
                      <strong className="font-mono text-slate-900 text-sm">{formatCurrency(valuation.totalCostValue)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Estimated Realizable Value</span>
                      <strong className="font-mono text-slate-900 text-sm">{formatCurrency(valuation.totalRetailValue)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── 5. TOP PERFORMING PRODUCTS ────────────────────────────── */}
              {report.topProducts?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-1">
                    V. Key Product Sales Performance (শীর্ষ বিক্রিত পণ্যসমূহ)
                  </h3>
                  <table className="w-full text-xs text-left border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="py-1.5 px-3">Product Name</th>
                        <th className="py-1.5 px-3 text-center">Quantity Sold</th>
                        <th className="py-1.5 px-3 text-right">Total Revenue (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.topProducts.slice(0, 8).map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-3 font-medium text-slate-800">{p.name}</td>
                          <td className="py-1.5 px-3 text-center font-mono text-slate-700">{p.qty} {p.unit}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900">{formatCurrency(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── 6. AUDIT SIGNATURE BLOCKS ─────────────────────────────── */}
              <div className="pt-10 border-t border-slate-300 grid grid-cols-3 gap-8 text-center text-xs">
                <div className="space-y-1">
                  <div className="border-t border-slate-800 pt-2 font-bold text-slate-800">
                    Prepared By (Cashier / Accountant)
                  </div>
                  <div className="text-[10px] text-slate-500">Sign & Date</div>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-800 pt-2 font-bold text-slate-800">
                    Audited & Verified By
                  </div>
                  <div className="text-[10px] text-slate-500">Store Manager</div>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-800 pt-2 font-bold text-slate-800">
                    Approved By (Owner / Super Admin)
                  </div>
                  <div className="text-[10px] text-slate-500">Official Seal & Sign</div>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="text-center text-[9px] text-slate-400 pt-3 border-t border-slate-200 font-mono">
                System Generated Financial Audit Statement • {shopSettings.shopName} POS Core
              </div>
            </div>
          ) : (
            /* ═════════════════════════════════════════════════════════════════
               2. CRISP 80MM POS THERMAL AUDIT SLIP (For Thermal Printer Roll)
            ═════════════════════════════════════════════════════════════════ */
            <div
              id="printable-thermal-audit-slip"
              className="w-full max-w-[340px] bg-white text-black p-4 rounded-lg shadow-md border border-slate-300 font-mono text-[11px] leading-[1.35] select-none print:shadow-none print:border-none print:p-0 print:max-w-none print:w-[78mm] print:text-[10px] space-y-2.5"
              style={{ fontFamily: "'Courier New', Courier, Consolas, Monaco, monospace" }}
            >
              {/* Thermal Store Header */}
              <div className="text-center pb-2 border-b border-black border-dashed">
                <div className="text-[16px] font-black uppercase tracking-tight">
                  {shopSettings.shopName || 'SMART BUY'}
                </div>
                {shopSettings.shopSubtitle && (
                  <div className="text-[10px] font-bold text-slate-800">{shopSettings.shopSubtitle}</div>
                )}
                {shopSettings.shopAddress && (
                  <div className="text-[9.5px] text-slate-700 mt-0.5">{shopSettings.shopAddress}</div>
                )}
                {shopSettings.shopPhone && (
                  <div className="text-[9.5px] text-slate-700">Hotline: {shopSettings.shopPhone}</div>
                )}
                {shopSettings.vatRegNo && (
                  <div className="text-[9px] font-bold mt-0.5">BIN/VAT REG: {shopSettings.vatRegNo}</div>
                )}
                <div className="text-[12px] font-black uppercase tracking-wider mt-2 border-t border-b border-black py-1">
                  MONTHLY AUDIT SLIP (Z-REPORT)
                </div>
                <div className="text-[10px] text-slate-800 mt-1">
                  Period: {formatDate(fromDate)} to {formatDate(toDate)}
                </div>
                <div className="text-[9px] text-slate-500">
                  Printed: {formatDateTime(new Date())}
                </div>
              </div>

              {/* Thermal P&L Summary */}
              <div className="space-y-1 py-1 border-b border-black border-dashed">
                <div className="font-bold text-[11px] border-b border-black pb-0.5">FINANCIAL SUMMARY (P&L)</div>
                <div className="flex justify-between">
                  <span>Gross Sales:</span>
                  <span className="font-bold">{formatCurrency(report.totalRevenue + (report.totalDiscounts || 0))}</span>
                </div>
                {report.totalDiscounts > 0 && (
                  <div className="flex justify-between">
                    <span>Discounts:</span>
                    <span>-{formatCurrency(report.totalDiscounts)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span>Net Sales:</span>
                  <span>{formatCurrency(report.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost of Goods (COGS):</span>
                  <span>-{formatCurrency(report.totalCost)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-black pt-0.5">
                  <span>Gross Profit ({report.grossProfitMargin}%):</span>
                  <span>{formatCurrency(report.grossProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Operating Expenses:</span>
                  <span>-{formatCurrency(report.totalExpenses)}</span>
                </div>
                {report.damageLoss > 0 && (
                  <div className="flex justify-between">
                    <span>Damage Loss:</span>
                    <span>-{formatCurrency(report.damageLoss)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-[12px] border-t-2 border-b-2 border-black py-1 mt-1">
                  <span>ACTUAL NET PROFIT:</span>
                  <span>{formatCurrency(report.netProfit)}</span>
                </div>
              </div>

              {/* Thermal Payment Channels */}
              <div className="space-y-1 py-1 border-b border-black border-dashed">
                <div className="font-bold text-[10.5px]">PAYMENT SETTLEMENT</div>
                <div className="flex justify-between">
                  <span>Cash Inflow:</span>
                  <span className="font-bold">{formatCurrency(cashTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Digital MFS:</span>
                  <span className="font-bold">{formatCurrency(digitalTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer Due:</span>
                  <span className="font-bold">{formatCurrency(dueTotal)}</span>
                </div>
              </div>

              {/* Thermal Top Products */}
              {report.topProducts?.length > 0 && (
                <div className="space-y-1 py-1 border-b border-black border-dashed">
                  <div className="font-bold text-[10.5px]">TOP 5 SELLING ITEMS</div>
                  {report.topProducts.slice(0, 5).map((p, idx) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                      <span className="truncate max-w-[180px]">{idx + 1}. {p.name}</span>
                      <span>{p.qty}x = {formatCurrency(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Thermal Signatures */}
              <div className="pt-4 space-y-6 text-center text-[10px]">
                <div className="border-t border-black pt-1">
                  Cashier / Manager Sign: ________________
                </div>
                <div className="border-t border-black pt-1">
                  Audited By: ___________________________
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-black border-dashed">
                *** END OF MONTHLY AUDIT SLIP ***
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
