import React, { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { formatCurrency, formatDateTime } from '../utils/helpers'
import api from '../utils/api'

export default function PurchaseReceipt({ purchase, onClose, autoPrint = false }) {
  const barcodeRef = useRef(null)
  const [shopSettings, setShopSettings] = useState({
    shopName: 'SMART BUY',
    shopSubtitle: 'Supershop & Departmental Store',
    shopAddress: 'House #12, Road #04, Dhanmondi, Dhaka',
    shopPhone: '01700-000000, 01800-000000',
    vatRegNo: '002391048-0101',
  })

  // Load dynamic settings
  useEffect(() => {
    api.get('/admin/settings')
      .then((res) => {
        if (res.data?.data) {
          setShopSettings((prev) => ({ ...prev, ...res.data.data }))
        }
      })
      .catch(() => {
        /* fallback to defaults */
      })
  }, [])

  useEffect(() => {
    if (purchase?.invoiceNo && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, purchase.invoiceNo, {
          format: 'CODE128',
          width: 1.4,
          height: 38,
          displayValue: true,
          fontSize: 11,
          font: 'monospace',
          textMargin: 2,
          margin: 0,
        })
      } catch (err) {
        console.error('Barcode generation error:', err)
      }
    }
  }, [purchase])

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [autoPrint])

  if (!purchase) return null

  const items = purchase.items || []
  const supplier = purchase.supplier || null
  const receivedBy = purchase.createdBy || null
  const totalAmount = parseFloat(purchase.totalAmount) || 0
  const amountPaid = parseFloat(purchase.amountPaid) || 0
  const totalDue = Math.max(0, totalAmount - amountPaid)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* On-Screen Container & Action Toolbar */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 flex flex-col items-center print:shadow-none print:p-0 print:max-w-none print:w-full">
        {/* Screen-Only Toolbar */}
        <div className="w-full flex justify-between items-center mb-3 pb-2 border-b border-slate-200 print:hidden">
          <span className="font-bold text-sm text-slate-800 flex items-center gap-1">
            📦 Stock In Invoice Preview
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 font-bold flex items-center gap-1 shadow-soft-sm"
            >
              <span>🖨️ Print [Ctrl+P]</span>
            </button>
            <button
              onClick={onClose}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Close [Esc]
            </button>
          </div>
        </div>

        {/* ─── THERMAL PURCHASE RECEIPT SLIP (80mm standard POS roll) ──────── */}
        <div
          id="thermal-receipt-print"
          className="w-[80mm] max-w-[80mm] min-w-[72mm] bg-white text-black font-mono text-[11px] leading-[1.3] p-2 print:p-0 select-text"
          style={{ fontFamily: `'JetBrains Mono', 'Courier New', Courier, monospace` }}
        >
          {/* Shop Header */}
          <div className="text-center pb-2 border-b border-black border-dashed">
            <h1 className="text-[18px] font-black tracking-tight uppercase leading-tight">
              {shopSettings.shopName || 'SMART BUY'}
            </h1>
            <p className="text-[10px] font-bold text-gray-800">STOCK PROCUREMENT & RECEIVING SLIP</p>
            {shopSettings.shopAddress && (
              <p className="text-[10px]">{shopSettings.shopAddress}</p>
            )}
            {shopSettings.shopPhone && (
              <p className="text-[10px]">Hotline: {shopSettings.shopPhone}</p>
            )}
            {shopSettings.vatRegNo && (
              <p className="text-[9px] font-semibold mt-0.5">BIN / VAT Reg: {shopSettings.vatRegNo}</p>
            )}
          </div>

          {/* Invoice Metadata */}
          <div className="py-1.5 border-b border-black border-dashed text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span className="font-bold">PO INVOICE:</span>
              <span className="font-bold tracking-wider">{purchase.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Received On:</span>
              <span>{formatDateTime(purchase.createdAt || new Date())}</span>
            </div>
            <div className="flex justify-between">
              <span>Received By:</span>
              <span className="font-semibold">{receivedBy?.name || 'Store Inventory Admin'}</span>
            </div>
            <div className="flex justify-between">
              <span>Supplier:</span>
              <span className="font-semibold">{supplier?.name || 'Direct Wholesale'}</span>
            </div>
            {supplier?.phone && (
              <div className="flex justify-between">
                <span>Supplier Contact:</span>
                <span>{supplier.phone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Payment Status:</span>
              <span className="font-bold">{purchase.status || 'PAID'}</span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-1.5 border-b border-black border-dashed">
            {/* Table Header */}
            <div className="flex justify-between font-bold text-[10px] border-b border-black pb-1 mb-1">
              <span className="w-[45%] text-left">ITEM / SKU</span>
              <span className="w-[20%] text-center">QTY</span>
              <span className="w-[15%] text-right">COST</span>
              <span className="w-[20%] text-right">TOTAL</span>
            </div>

            {/* Item Rows */}
            <div className="space-y-1">
              {items.map((item, idx) => {
                const productName = item.product?.name || item.name || `Item #${idx + 1}`
                const unit = item.product?.unit || item.unit || 'pcs'
                const qty = item.qty
                const costPrice = parseFloat(item.costPrice) || 0
                const lineTotal = parseFloat(item.subtotal) || (qty * costPrice)

                return (
                  <div key={idx} className="text-[10px]">
                    <div className="flex justify-between items-start">
                      <span className="w-[45%] font-bold leading-tight truncate">
                        {idx + 1}. {productName}
                      </span>
                      <span className="w-[20%] text-center whitespace-nowrap">
                        {qty} {unit}
                      </span>
                      <span className="w-[15%] text-right whitespace-nowrap">
                        {costPrice.toFixed(0)}
                      </span>
                      <span className="w-[20%] text-right font-bold whitespace-nowrap">
                        {lineTotal.toFixed(2)}
                      </span>
                    </div>
                    {item.product?.barcode && (
                      <div className="text-[8px] text-gray-600 pl-2">
                        [{item.product.barcode}]
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bill Totals */}
          <div className="py-1.5 border-b border-black border-dashed text-[11px] space-y-1 font-semibold">
            <div className="flex justify-between">
              <span>Total Received Items:</span>
              <span className="font-bold">{items.length} Lines</span>
            </div>
            <div className="flex justify-between text-[13px] font-black pt-1 border-t border-black">
              <span>TOTAL PROCUREMENT:</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Amount Paid to Supplier:</span>
              <span className="font-bold">{formatCurrency(amountPaid)}</span>
            </div>
            {totalDue > 0 && (
              <div className="flex justify-between text-[11px] font-bold text-red-700">
                <span>Supplier Due Balance:</span>
                <span>{formatCurrency(totalDue)}</span>
              </div>
            )}
          </div>

          {purchase.notes && (
            <div className="py-1 border-b border-black border-dashed text-[9px]">
              <span className="font-bold">Remarks:</span> {purchase.notes}
            </div>
          )}

          {/* Receiver & Signatures */}
          <div className="pt-6 pb-2 grid grid-cols-2 text-center text-[9px] border-b border-black border-dashed">
            <div>
              <div className="border-t border-black w-24 mx-auto pt-0.5">Supplier Sign</div>
            </div>
            <div>
              <div className="border-t border-black w-24 mx-auto pt-0.5">Authorized Store Sign</div>
            </div>
          </div>

          {/* Barcode */}
          <div className="pt-2 flex flex-col items-center justify-center">
            <svg ref={barcodeRef} className="max-w-full h-auto" />
            <p className="text-[9px] font-bold mt-1 text-center">
              *** INVENTORY STOCK UPDATED SUCCESSFULLY ***
            </p>
          </div>
        </div>
      </div>

      {/* Direct Thermal Print Media Query */}
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
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
            width: 80mm;
            padding: 2mm 3mm;
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}
