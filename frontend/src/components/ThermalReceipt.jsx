import React, { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { formatCurrency, formatDateTime } from '../utils/helpers'
import api from '../utils/api'

export default function ThermalReceipt({ receipt, onClose, autoPrint = false }) {
  const barcodeRef = useRef(null)
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
      .catch(() => {
        /* use defaults */
      })
  }, [])

  useEffect(() => {
    if (receipt?.invoiceNo && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, receipt.invoiceNo, {
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
  }, [receipt])

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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* On-Screen Container & Action Toolbar */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 flex flex-col items-center print:shadow-none print:p-0 print:max-w-none print:w-full">
        {/* Screen-Only Toolbar */}
        <div className="w-full flex justify-between items-center mb-3 pb-2 border-b print:hidden">
          <span className="font-bold text-sm text-gray-800">🖨️ Receipt Preview</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-soft-sm"
            >
              Print [Ctrl+P]
            </button>
            <button
              onClick={onClose}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Close [Esc]
            </button>
          </div>
        </div>

        {/* ─── THERMAL RECEIPT SLIP (80mm / 58mm standard POS roll) ────────── */}
        <div
          id="thermal-receipt-print"
          className="w-[80mm] max-w-[80mm] min-w-[72mm] bg-white text-black font-mono text-[11px] leading-[1.3] p-2 print:p-0 select-text"
          style={{ fontFamily: `'JetBrains Mono', 'Courier New', Courier, monospace` }}
        >
          {/* Shop Header (Fully Customizable via Settings) */}
          <div className="text-center pb-2 border-b border-black border-dashed">
            {shopSettings.shopLogo && (
              <div className="flex justify-center pb-1.5">
                <img
                  src={shopSettings.shopLogo}
                  alt="Shop Logo"
                  className="max-h-12 max-w-[60mm] object-contain grayscale contrast-200"
                />
              </div>
            )}
            <h1 className="text-[18px] font-black tracking-tight uppercase leading-tight">
              {shopSettings.shopName || 'SMART BUY'}
            </h1>
            {shopSettings.shopSubtitle && (
              <p className="text-[10px] font-bold text-gray-800">{shopSettings.shopSubtitle}</p>
            )}
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
              <span className="font-bold">INVOICE:</span>
              <span className="font-bold tracking-wider">{receipt.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date & Time:</span>
              <span>{formatDateTime(receipt.createdAt || new Date())}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span className="font-semibold">{cashier?.name || 'Cashier Counter 01'}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-semibold">{customer?.name || 'Walk-in Customer'}</span>
            </div>
            {customer?.phone && customer.phone !== '00000000000' && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{customer.phone}</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="py-1.5 border-b border-black border-dashed">
            {/* Table Header */}
            <div className="flex justify-between font-bold text-[10px] border-b border-black pb-1 mb-1">
              <span className="w-[50%] text-left">ITEM / BRAND</span>
              <span className="w-[20%] text-center">QTY</span>
              <span className="w-[30%] text-right">TOTAL</span>
            </div>

            {/* Item Rows */}
            <div className="space-y-1.5">
              {items.map((item, idx) => {
                const itemQty = item.qty || 1
                const unitPrice = parseFloat(item.unitPrice) || 0
                const lineDiscount = parseFloat(item.discountAmount) || 0
                const itemTotal = parseFloat(item.subtotal) || (itemQty * unitPrice - lineDiscount)
                const brandName = item.product?.brand?.name

                return (
                  <div key={idx} className="text-[10px]">
                    <div className="font-bold leading-tight">
                      {idx + 1}. {item.product?.name || item.name}
                    </div>
                    {brandName && (
                      <div className="text-[9px] text-gray-600 italic leading-none pl-3">
                        [{brandName}]
                      </div>
                    )}
                    <div className="flex justify-between items-center pl-3 text-[9.5px]">
                      <span>
                        {itemQty} {item.product?.unit || 'pcs'} × {unitPrice.toFixed(2)}
                        {lineDiscount > 0 && (
                          <span className="text-gray-600"> (-{lineDiscount.toFixed(2)})</span>
                        )}
                      </span>
                      <span className="font-bold text-[10px]">
                        ৳{itemTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Calculation Summary */}
          <div className="py-1.5 border-b border-black border-dashed text-[10.5px] space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>৳{subtotal.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between font-semibold">
                <span>Special Discount:</span>
                <span>-৳{discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-[9.5px] text-gray-700">
              <span>VAT / Tax (0% Included):</span>
              <span>৳0.00</span>
            </div>

            {/* Grand Total Box */}
            <div className="flex justify-between items-center text-[13px] font-black border-t-2 border-b-2 border-black py-1 my-1">
              <span>NET PAYABLE:</span>
              <span>৳{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className="py-1.5 border-b border-black border-dashed text-[10px] space-y-0.5">
            <div className="font-bold text-[10px] mb-0.5">PAYMENT BREAKDOWN:</div>
            {payments.map((p, pIdx) => (
              <div key={pIdx} className="flex justify-between">
                <span className="uppercase">
                  • {p.method} {p.reference ? `(${p.reference})` : ''}:
                </span>
                <span className="font-semibold">৳{(parseFloat(p.amount) || 0).toFixed(2)}</span>
              </div>
            ))}
            {changeDue > 0 && (
              <div className="flex justify-between font-bold text-[10.5px] pt-0.5">
                <span>CHANGE RETURNED:</span>
                <span>৳{changeDue.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Barcode */}
          <div className="pt-2 flex flex-col items-center justify-center border-b border-black border-dashed pb-2">
            <svg ref={barcodeRef} className="max-w-full h-auto" />
          </div>

          {/* Receipt Footer Notes (Customizable via Settings) */}
          <div className="pt-2 text-center text-[9px] space-y-0.5">
            <p className="font-bold">{shopSettings.receiptFooter || '*** THANK YOU FOR SHOPPING WITH US ***'}</p>
            {shopSettings.receiptReturnPolicy && (
              <p className="text-[8.5px] text-gray-700">{shopSettings.receiptReturnPolicy}</p>
            )}
            <p className="text-[8px] text-gray-500 font-mono mt-1">Smart Buy POS System</p>
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
