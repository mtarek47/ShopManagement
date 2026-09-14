import React, { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { formatCurrency, formatDateTime } from '../utils/helpers'
import api from '../utils/api'

export default function ThermalReceipt({ receipt, onClose, autoPrint = false }) {
  const barcodeRef = useRef(null)
  const [paperWidth, setPaperWidth] = useState('56mm') // '56mm' (Ryans 56x38mm) | '80mm'
  const [shopSettings, setShopSettings] = useState({
    shopName: 'SMART BUY',
    shopSubtitle: 'Supershop & Departmental Store',
    shopAddress: 'House #12, Road #04, Dhanmondi, Dhaka',
    shopPhone: '01700-000000, 01800-000000',
    vatRegNo: '002391048-0101',
    receiptFooter: '*** THANK YOU FOR SHOPPING WITH US ***',
    receiptReturnPolicy: 'Exchange possible within 3 days with original receipt',
  })

  // Load live shop receipt settings
  useEffect(() => {
    api.get('/admin/settings')
      .then((res) => {
        if (res.data?.data) {
          setShopSettings((prev) => ({ ...prev, ...res.data.data }))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (receipt?.invoiceNo && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, receipt.invoiceNo, {
          format: 'CODE128',
          width: paperWidth === '56mm' ? 1.1 : 1.4,
          height: paperWidth === '56mm' ? 28 : 36,
          displayValue: true,
          fontSize: paperWidth === '56mm' ? 9.5 : 11,
          font: 'monospace',
          textMargin: 1,
          margin: 0,
        })
      } catch (err) {
        console.error('Barcode generation error:', err)
      }
    }
  }, [receipt, paperWidth])

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [autoPrint])

  if (!receipt) return null

  const items = receipt.items || []
  const payments = receipt.payments || []
  const customer = receipt.customer || null
  const cashier = receipt.cashier || null
  const subtotal = parseFloat(receipt.subtotal) || 0
  const discountAmount = parseFloat(receipt.discountAmount) || 0
  const totalAmount = parseFloat(receipt.totalAmount) || 0
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const changeDue = Math.max(0, totalPaid - totalAmount)

  return (
    <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static backdrop-blur-xs font-sans">
      {/* On-Screen Container & Action Toolbar */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 flex flex-col items-center print:shadow-none print:p-0 print:max-w-none print:w-full border border-slate-300">
        {/* Screen-Only Toolbar */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-3 pb-3 border-b border-slate-200 gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">Receipt Preview</span>
            {/* Paper Size Switcher */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setPaperWidth('56mm')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  paperWidth === '56mm'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                56mm (Ryans Roll)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  paperWidth === '80mm'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm POS Roll
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="btn-primary text-xs py-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-2xs flex items-center gap-1"
            >
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Close
            </button>
          </div>
        </div>

        {/* ─── THERMAL RECEIPT SLIP (56mm / 80mm standard POS roll) ────────── */}
        <div
          id="thermal-receipt-print"
          className={`bg-white text-black font-mono leading-[1.25] p-2 print:p-0 select-text transition-all ${
            paperWidth === '56mm'
              ? 'w-[56mm] max-w-[56mm] text-[9.5px]'
              : 'w-[80mm] max-w-[80mm] text-[11px]'
          }`}
          style={{ fontFamily: `'JetBrains Mono', 'Courier New', Courier, monospace` }}
        >
          {/* Shop Header */}
          <div className="text-center pb-2 border-b border-black border-dashed">
            {shopSettings.shopLogo && (
              <div className="flex justify-center pb-1">
                <img
                  src={shopSettings.shopLogo}
                  alt="Shop Logo"
                  className="max-h-10 max-w-[50mm] object-contain grayscale contrast-200"
                />
              </div>
            )}
            <h1 className="font-black tracking-tight uppercase leading-tight text-sm">
              {shopSettings.shopName || 'SMART BUY'}
            </h1>
            {shopSettings.shopSubtitle && (
              <p className="text-[9px] font-bold text-gray-800">{shopSettings.shopSubtitle}</p>
            )}
            {shopSettings.shopAddress && (
              <p className="text-[8.5px] leading-tight">{shopSettings.shopAddress}</p>
            )}
            {shopSettings.shopPhone && (
              <p className="text-[8.5px]">Hotline: {shopSettings.shopPhone}</p>
            )}
            {shopSettings.vatRegNo && (
              <p className="text-[8px] font-semibold mt-0.5">BIN/VAT: {shopSettings.vatRegNo}</p>
            )}
          </div>

          {/* Invoice Metadata */}
          <div className="py-1.5 border-b border-black border-dashed text-[9px] space-y-0.5">
            <div className="flex justify-between">
              <span className="font-bold">INVOICE:</span>
              <span className="font-bold tracking-wider">{receipt.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{formatDateTime(receipt.createdAt || new Date())}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span className="font-semibold truncate">{cashier?.name || 'Counter 01'}</span>
            </div>
            {customer && customer.name !== 'Walk-in Customer' && (
              <div className="flex justify-between pt-0.5">
                <span>Customer:</span>
                <span className="font-semibold truncate">{customer.name} ({customer.phone})</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="py-1.5 border-b border-black border-dashed">
            <div className="flex justify-between font-bold pb-1 text-[9px] border-b border-black">
              <span className="w-1/2">ITEM</span>
              <span className="w-1/4 text-center">QTY</span>
              <span className="w-1/4 text-right">TOTAL</span>
            </div>

            <div className="space-y-1 pt-1">
              {items.map((item, idx) => {
                const itemTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0)
                return (
                  <div key={idx} className="leading-tight">
                    <div className="font-semibold truncate">{item.product?.name || item.name}</div>
                    <div className="flex justify-between text-gray-700 text-[8.5px]">
                      <span>
                        {item.qty} {item.unit || 'pcs'} × {formatCurrency(item.unitPrice)}
                      </span>
                      <span className="font-bold text-black font-mono">
                        {formatCurrency(itemTotal)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="py-1.5 border-b border-black border-dashed text-[9.5px] space-y-0.5 font-semibold">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-gray-800">
                <span>Discount:</span>
                <span>- {formatCurrency(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
              <span>NET PAYABLE:</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="py-1.5 border-b border-black border-dashed text-[9px] space-y-0.5">
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span>Paid ({p.paymentMethod}):</span>
                <span className="font-bold">{formatCurrency(p.amount)}</span>
              </div>
            ))}
            {changeDue > 0 && (
              <div className="flex justify-between font-bold pt-0.5">
                <span>Change Returned:</span>
                <span>{formatCurrency(changeDue)}</span>
              </div>
            )}
          </div>

          {/* Barcode & Footer */}
          <div className="pt-2 text-center space-y-1">
            <div className="flex justify-center my-1 overflow-hidden">
              <svg ref={barcodeRef} className="max-w-full" />
            </div>
            <p className="font-bold text-[8.5px]">{shopSettings.receiptFooter || '*** THANK YOU FOR SHOPPING WITH US ***'}</p>
            {shopSettings.receiptReturnPolicy && (
              <p className="text-[7.5px] text-gray-700 leading-tight">{shopSettings.receiptReturnPolicy}</p>
            )}
            <p className="text-[7.5px] text-gray-500 font-mono mt-1">Smart Buy POS Core Terminal</p>
          </div>
        </div>
      </div>

      {/* Direct Thermal Print Media Query */}
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: ${paperWidth === '56mm' ? '56mm auto' : '80mm auto'};
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
          body * {
            visibility: hidden;
          }
          #thermal-receipt-print,
          #thermal-receipt-print * {
            visibility: visible;
          }
          #thermal-receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: ${paperWidth === '56mm' ? '56mm' : '80mm'} !important;
            padding: ${paperWidth === '56mm' ? '1mm 2mm' : '2mm 3mm'} !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
