import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { formatCurrency } from '../utils/helpers'
import toast from 'react-hot-toast'

// Generate random unique 12-digit store barcode
export function generateUniqueBarcode() {
  const prefix = '890' // standard prefix
  const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString()
  return `${prefix}${randomPart}`
}

export default function BarcodeGeneratorModal({ products = [], preselectedProduct = null, onClose }) {
  const [productQuery, setProductQuery] = useState(preselectedProduct?.name || '')
  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct || null)
  const [productSuggestions, setProductSuggestions] = useState([])
  const [showProductSuggestions, setShowProductSuggestions] = useState(false)

  // Label Data
  const [barcodeValue, setBarcodeValue] = useState(
    preselectedProduct?.barcode || preselectedProduct?.sku || generateUniqueBarcode()
  )
  const [labelTitle, setLabelTitle] = useState(preselectedProduct?.name || 'Sample Product')
  const [labelPrice, setLabelPrice] = useState(preselectedProduct ? parseFloat(preselectedProduct.salePrice) : 100)
  const [printCount, setPrintCount] = useState(10)
  const [layoutMode, setLayoutMode] = useState('2col') // '1col' | '2col' | '3col'
  const [showShopName, setShowShopName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)

  const printAreaRef = useRef(null)

  // When preselected product changes
  useEffect(() => {
    if (preselectedProduct) {
      setSelectedProduct(preselectedProduct)
      setProductQuery(preselectedProduct.name)
      setBarcodeValue(preselectedProduct.barcode || preselectedProduct.sku || generateUniqueBarcode())
      setLabelTitle(preselectedProduct.name)
      setLabelPrice(parseFloat(preselectedProduct.salePrice) || 0)
    }
  }, [preselectedProduct])

  // Render SVG barcodes with JsBarcode
  useEffect(() => {
    if (!barcodeValue) return
    try {
      JsBarcode('.barcode-svg-element', barcodeValue, {
        format: 'CODE128',
        width: layoutMode === '3col' ? 1.1 : layoutMode === '2col' ? 1.3 : 1.6,
        height: layoutMode === '3col' ? 24 : 28,
        displayValue: true,
        fontSize: 9,
        margin: 2,
        fontOptions: 'bold',
      })
    } catch {
      /* fallback */
    }
  }, [barcodeValue, printCount, layoutMode, showShopName, showPrice])

  const handleProductSearch = (val) => {
    setProductQuery(val)
    setLabelTitle(val)
    if (val.trim()) {
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(val.toLowerCase()) ||
          (p.barcode && p.barcode.includes(val)) ||
          (p.sku && p.sku.toLowerCase().includes(val.toLowerCase()))
      )
      setProductSuggestions(filtered)
      setShowProductSuggestions(filtered.length > 0)
    } else {
      setProductSuggestions([])
      setShowProductSuggestions(false)
    }
  }

  const handleSelectProduct = (p) => {
    setSelectedProduct(p)
    setProductQuery(p.name)
    setLabelTitle(p.name)
    setLabelPrice(parseFloat(p.salePrice) || 0)
    setBarcodeValue(p.barcode || p.sku || generateUniqueBarcode())
    setShowProductSuggestions(false)
  }

  const handleGenerateNew = () => {
    const code = generateUniqueBarcode()
    setBarcodeValue(code)
    toast.success(`Generated: ${code}`)
  }

  const handlePrint = () => {
    window.print()
  }

  const labelsArray = Array.from({ length: Math.min(200, Math.max(1, parseInt(printCount) || 1)) })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* ─── MODAL HEADER ─────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-base font-bold shadow-soft-sm">
              🏷️
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Thermal Barcode Generator & Batch Printer</h2>
              <p className="text-[11px] text-slate-400">Generate high-density sticker labels to minimize paper usage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        {/* ─── MODAL BODY: LEFT CONTROLS / RIGHT LIVE PREVIEW ──────────────── */}
        <div className="flex-1 flex overflow-hidden divide-x divide-slate-100">
          {/* Controls Column */}
          <div className="w-80 p-4 overflow-y-auto space-y-3.5 bg-slate-50/30 shrink-0 text-xs">
            {/* 1. Product Selector */}
            <div className="relative">
              <label className="label-title">Select or Type Product Name</label>
              <input
                className="input text-xs"
                placeholder="Search catalog or type custom name..."
                value={productQuery}
                onChange={(e) => handleProductSearch(e.target.value)}
                onFocus={() => { if (productQuery.trim()) setShowProductSuggestions(true) }}
              />
              {showProductSuggestions && productSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100 z-50">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                    <span>Unlabeled & Catalog Items ({productSuggestions.length})</span>
                    <span>Click to select</span>
                  </div>
                  {productSuggestions.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="p-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                          {p.name}
                          {!p.barcode && (
                            <span className="badge badge-yellow text-[8px] py-0 px-1">NEEDS LABEL</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.category?.name || 'General'} • {p.barcode ? `Barcode: ${p.barcode}` : 'Loose item (No barcode)'}
                        </div>
                      </div>
                      <span className="font-extrabold text-indigo-700 font-mono text-[11px]">
                        {formatCurrency(p.salePrice)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Barcode Code & Auto-Generate Button */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label-title mb-0">Barcode Number</label>
                <button
                  type="button"
                  onClick={handleGenerateNew}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5"
                >
                  ⚡ Auto-Generate Unique
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  className="input text-xs font-mono font-bold flex-1"
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  placeholder="e.g. 890123456789"
                />
              </div>
            </div>

            {/* 3. Price (৳) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-title">Price (৳)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="input text-xs font-mono font-bold text-indigo-700"
                  value={labelPrice}
                  onChange={(e) => setLabelPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="label-title">Print Copies</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  className="input text-xs font-mono font-bold text-center"
                  value={printCount}
                  onChange={(e) => setPrintCount(e.target.value)}
                />
              </div>
            </div>

            {/* 4. Thermal Paper-Saving Grid Layout */}
            <div>
              <label className="label-title">Paper-Saving Layout Density</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setLayoutMode('2col')}
                  className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                    layoutMode === '2col'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-soft-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  2-Column ⭐
                  <span className="block text-[9px] font-normal opacity-80">(Recommended)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('3col')}
                  className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                    layoutMode === '3col'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-soft-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  3-Column
                  <span className="block text-[9px] font-normal opacity-80">(Ultra Compact)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('1col')}
                  className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                    layoutMode === '1col'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-soft-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  1-Column
                  <span className="block text-[9px] font-normal opacity-80">(58mm Roll)</span>
                </button>
              </div>
            </div>

            {/* 5. Toggles */}
            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-700 font-semibold text-[11px]">Include Store Name (Smart Buy)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-700 font-semibold text-[11px]">Include MRP / Price (৳)</span>
              </label>
            </div>
          </div>

          {/* Live Preview & Printable Container */}
          <div className="flex-1 flex flex-col bg-slate-200/60 p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Print Sheet Preview ({labelsArray.length} Stickers)
              </span>
              <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                Density: <strong>{layoutMode.toUpperCase()} Grid</strong>
              </span>
            </div>

            {/* Printable Grid Area */}
            <div className="flex-1 bg-white rounded-xl border border-slate-300 shadow-inner p-4 overflow-y-auto">
              <div
                id="barcode-print-sheet"
                ref={printAreaRef}
                className={`grid gap-2 ${
                  layoutMode === '3col'
                    ? 'grid-cols-3'
                    : layoutMode === '2col'
                    ? 'grid-cols-2'
                    : 'grid-cols-1 max-w-xs mx-auto'
                }`}
              >
                {labelsArray.map((_, idx) => (
                  <div
                    key={idx}
                    className="border border-dashed border-slate-300 rounded-md p-1.5 bg-white text-center flex flex-col items-center justify-between text-black shadow-xs select-none break-inside-avoid print:border print:border-black/30"
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    {showShopName && (
                      <div className="text-[9px] font-black tracking-wider uppercase leading-tight text-slate-800">
                        Smart Buy
                      </div>
                    )}
                    <div className="text-[10px] font-bold text-slate-900 truncate w-full px-1 leading-tight my-0.5">
                      {labelTitle}
                    </div>

                    {/* Barcode SVG Generated */}
                    <div className="w-full flex justify-center my-0.5 overflow-hidden">
                      <svg className="barcode-svg-element" />
                    </div>

                    {showPrice && (
                      <div className="text-[11px] font-black font-mono text-slate-900 leading-tight">
                        MRP: {formatCurrency(labelPrice)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── MODAL FOOTER ─────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500">
            Total <strong>{labelsArray.length}</strong> barcode labels will be printed.
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs py-2 px-4">
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary text-xs py-2 px-5 font-bold flex items-center gap-1.5 shadow-soft-sm"
            >
              <span>🖨️ Print Barcode Labels</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── EMBEDDED THERMAL STICKER PRINT MEDIA STYLES ──────────────────── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #barcode-print-sheet,
          #barcode-print-sheet * {
            visibility: visible;
          }
          #barcode-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 2mm;
            gap: 2mm !important;
          }
        }
      `}</style>
    </div>
  )
}
