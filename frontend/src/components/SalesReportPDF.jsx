import { useState, useEffect } from 'react'
import api from '../utils/api'
import { formatCurrency, formatDateTime } from '../utils/helpers'

export default function SalesReportPDF({ report, from, to, onClose }) {
  const [shopSettings, setShopSettings] = useState({
    shopName: 'Smart Buy',
    shopSubtitle: 'Supershop & Departmental Store',
    shopAddress: 'House #12, Road #04, Dhanmondi, Dhaka',
    shopPhone: '01700-000000',
    vatRegNo: '002391048-0101',
  })

  useEffect(() => {
    api.get('/admin/settings')
      .then((res) => {
        if (res.data?.data) {
          setShopSettings(res.data.data)
        }
      })
      .catch(() => {})
  }, [])

  const handlePrint = () => {
    window.print()
  }

  if (!report) return null

  const salesList = report.detailedSales || []

  // Breakdown payment channels
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

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto font-sans">
      {/* ─── MODAL CONTAINER ─────────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col border border-slate-700 overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold flex items-center gap-1.5">
              <span>🖨️ 80mm POS Thermal Sales Audit Slip</span>
            </span>
            <span className="badge bg-indigo-500/30 text-indigo-300 text-[10px] font-mono">
              Z-Report
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary text-xs py-1.5 px-4 font-bold bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 shadow-soft-sm"
            >
              <span>🖨️ Print Thermal Slip / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl font-bold leading-none px-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* ─── SCROLLABLE PREVIEW CONTAINER ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-800/80 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          {/* ─── 80MM THERMAL SLIP BODY ────────────────────────────────────── */}
          <div
            id="printable-thermal-audit-slip"
            className="w-full max-w-[340px] bg-white text-black p-4 rounded-lg shadow-2xl border border-slate-300 font-mono text-[11px] leading-[1.35] select-none print:shadow-none print:border-none print:p-0 print:max-w-none print:w-[78mm] print:text-[10px]"
            style={{ fontFamily: "'Courier New', Courier, Consolas, Monaco, monospace" }}
          >
            {/* ─── STORE HEADER ────────────────────────────────────────────── */}
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

              <div className="mt-2 py-1 border-t border-b border-black font-black text-[12px] uppercase">
                === SALES AUDIT SLIP (Z-REPORT) ===
              </div>
            </div>

            {/* ─── AUDIT METADATA ─────────────────────────────────────────── */}
            <div className="py-2 border-b border-black border-dashed space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>AUDIT PERIOD:</span>
                <span className="font-bold">{from} to {to}</span>
              </div>
              <div className="flex justify-between">
                <span>GENERATED ON:</span>
                <span className="font-bold">{formatDateTime(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span>TOTAL INVOICES:</span>
                <span className="font-black">{report.totalTransactions || 0} Bills</span>
              </div>
              <div className="flex justify-between">
                <span>TOTAL ITEMS SOLD:</span>
                <span className="font-black">{report.totalItemsSold || 0} Units</span>
              </div>
            </div>

            {/* ─── FINANCIAL TOTALS SUMMARY ────────────────────────────────── */}
            <div className="py-2 border-b border-black border-dashed space-y-1 text-[11px]">
              <div className="font-black text-center text-[11.5px] uppercase tracking-wider mb-1">
                --- FINANCIAL SUMMARY ---
              </div>

              <div className="flex justify-between font-black text-[13px] border-t border-b border-black py-1 my-1">
                <span>TOTAL SALES:</span>
                <span>{formatCurrency(report.totalRevenue || 0)}</span>
              </div>

              <div className="flex justify-between text-[10.5px]">
                <span>Total Discounts Given:</span>
                <span className="font-bold">-{formatCurrency(report.totalDiscounts || 0)}</span>
              </div>

              <div className="flex justify-between text-[10.5px]">
                <span>Gross Profit (Est.):</span>
                <span className="font-black text-slate-900">{formatCurrency(report.grossProfit || 0)}</span>
              </div>

              <div className="flex justify-between text-[10.5px]">
                <span>Average Bill Value:</span>
                <span className="font-bold">{formatCurrency(report.avgTransaction || 0)}</span>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="pt-1.5 mt-1 border-t border-black border-dotted space-y-0.5 text-[10px]">
                <div className="font-bold uppercase text-[9.5px]">Payment Breakdown:</div>
                <div className="flex justify-between">
                  <span>• Cash Received:</span>
                  <span className="font-bold">{formatCurrency(cashTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Digital (bKash/Card):</span>
                  <span className="font-bold">{formatCurrency(digitalTotal)}</span>
                </div>
                {dueTotal > 0 && (
                  <div className="flex justify-between text-black font-bold">
                    <span>• Credit / Due (বাকি):</span>
                    <span>{formatCurrency(dueTotal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ─── CHRONOLOGICAL ITEM TRANSACTIONS (WITH TIME & DATE) ───────── */}
            <div className="py-2 border-b border-black border-dashed space-y-2 text-[10px]">
              <div className="font-black text-center text-[11px] uppercase tracking-wider">
                --- ITEM SALES & TIME LOG ---
              </div>

              {salesList.length === 0 ? (
                <div className="text-center py-2 text-slate-500 italic">No sales recorded</div>
              ) : (
                salesList.map((sale, sIdx) => (
                  <div key={sale.id} className="pb-2 border-b border-black border-dotted space-y-0.5">
                    {/* Header: Date, Time, Invoice & Cashier */}
                    <div className="flex justify-between font-bold text-[10px] bg-slate-100 px-1 py-0.5">
                      <span>#{sIdx + 1} {sale.invoiceNo}</span>
                      <span>{formatDateTime(sale.createdAt)}</span>
                    </div>

                    <div className="flex justify-between text-[9px] text-slate-700 px-1">
                      <span>Cust: {sale.customer?.name || 'Walk-in'}</span>
                      <span>By: {sale.cashier?.name || 'Staff'}</span>
                    </div>

                    {/* Sold Items list */}
                    <div className="pl-1 pt-0.5 space-y-0.5">
                      {sale.items?.map((item, iIdx) => (
                        <div key={iIdx} className="flex justify-between text-[9.5px]">
                          <span className="truncate pr-1">
                            {item.product?.name || 'Item'} ({item.qty}{item.product?.unit ? item.product.unit : ''} @ {parseFloat(item.unitPrice).toFixed(0)})
                          </span>
                          <span className="font-bold whitespace-nowrap">৳{parseFloat(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total & Payment method */}
                    <div className="flex justify-between font-black text-[10.5px] pt-1 px-1 border-t border-slate-300 mt-1">
                      <span>NET: ৳{parseFloat(sale.totalAmount).toFixed(2)}</span>
                      <span className="text-[9px] font-bold">[{sale.payments?.[0]?.method || 'CASH'}]</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ─── TOP SELLING ITEMS ───────────────────────────────────────── */}
            {report.topProducts && report.topProducts.length > 0 && (
              <div className="py-2 border-b border-black border-dashed space-y-1 text-[10px]">
                <div className="font-black text-center text-[11px] uppercase tracking-wider mb-1">
                  --- TOP SELLING PRODUCTS ---
                </div>
                <div className="flex justify-between font-bold border-b border-black pb-0.5 text-[9px]">
                  <span>ITEM</span>
                  <span>QTY</span>
                  <span className="text-right">TOTAL</span>
                </div>
                {report.topProducts.slice(0, 10).map((p, idx) => (
                  <div key={idx} className="flex justify-between text-[9.5px]">
                    <span className="truncate max-w-[140px]">{idx + 1}. {p.name}</span>
                    <span className="font-bold text-center">{p.qty}{p.unit || ''}</span>
                    <span className="font-bold text-right">৳{parseFloat(p.revenue).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ─── FOOTER ─────────────────────────────────────────────────── */}
            <div className="pt-3 text-center space-y-1 text-[9px]">
              <div className="font-black tracking-widest">*** END OF AUDIT REPORT ***</div>
              <div className="text-[8.5px] text-slate-600">SMART BUY POS AUDIT TELEMETRY</div>
              <div className="font-mono text-[8px] text-slate-400 mt-1">
                REF: AUD-{Date.now().toString(36).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center print:hidden">
          <span className="text-xs text-slate-400">
            Formatted for 80mm Thermal Receipt Printers & A4/PDF Export
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-secondary text-xs py-1.5 px-4 font-semibold"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="btn-primary text-xs py-1.5 px-5 font-bold bg-indigo-600 hover:bg-indigo-500 shadow-soft-sm flex items-center gap-1.5"
            >
              <span>🖨️ Print Thermal Slip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
