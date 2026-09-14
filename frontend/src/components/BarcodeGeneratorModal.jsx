import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { formatCurrency } from '../utils/helpers'
import api from '../utils/api'
import toast from 'react-hot-toast'

// Generate random unique 12-digit store barcode
export function generateUniqueBarcode() {
  const prefix = '890'
  const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString()
  return `${prefix}${randomPart}`
}

// Standard Barcode Thermal Sticker Roll Presets
export const STICKER_ROLL_PRESETS = [
  {
    id: '38x25_dual',
    name: '38mm × 25mm (2-Up Dual Roll — ২ স্টিকার পাশাপাশি)',
    desc: 'Ryans K2 38×25mm 2-Up Dual (2000 PCs) Roll',
    widthMm: 38,
    heightMm: 25,
    rollWidthMm: 78,
    isRoll: true,
    isDual: true,
    cols: 2,
    barcodeHeight: 22,
    barcodeWidth: 1.0,
    fontSize: 7.5,
  },
  {
    id: '38x25_single',
    name: '38mm × 25mm (1-Up Single Roll — ১ স্টিকার)',
    desc: 'Compact Single Column Sticker Roll',
    widthMm: 38,
    heightMm: 25,
    rollWidthMm: 38,
    isRoll: true,
    isDual: false,
    cols: 1,
    barcodeHeight: 22,
    barcodeWidth: 1.0,
    fontSize: 7.5,
  },
  {
    id: '50x25',
    name: '50mm × 25mm (2" × 1" Single Roll)',
    desc: 'Standard 1-Up Barcode Roll',
    widthMm: 50,
    heightMm: 25,
    rollWidthMm: 50,
    isRoll: true,
    isDual: false,
    cols: 1,
    barcodeHeight: 26,
    barcodeWidth: 1.25,
    fontSize: 8.5,
  },
  {
    id: '50x30',
    name: '50mm × 30mm (Single Roll)',
    desc: 'Large Retail Sticker Roll',
    widthMm: 50,
    heightMm: 30,
    rollWidthMm: 50,
    isRoll: true,
    isDual: false,
    cols: 1,
    barcodeHeight: 32,
    barcodeWidth: 1.3,
    fontSize: 9,
  },
  {
    id: '56mm_pos',
    name: '56mm / 58mm POS Paper Roll (1-Up)',
    desc: 'Ryans K2 56×38mm POS Paper Roll',
    widthMm: 54,
    heightMm: 28,
    rollWidthMm: 56,
    isRoll: false,
    isDual: false,
    cols: 1,
    barcodeHeight: 24,
    barcodeWidth: 1.2,
    fontSize: 8.5,
  },
  {
    id: '80mm_pos',
    name: '80mm Continuous POS Receipt Paper (2-Up)',
    desc: 'Standard 80mm Cash Counter Receipt Paper',
    widthMm: 37,
    heightMm: 28,
    rollWidthMm: 78,
    isRoll: false,
    isDual: true,
    cols: 2,
    barcodeHeight: 24,
    barcodeWidth: 1.0,
    fontSize: 8,
  },
  {
    id: 'a4_sheet',
    name: 'A4 Laser Sticker Sheet (24 Labels)',
    desc: 'Standard A4 sheet (3 × 8 grid)',
    widthMm: 63.5,
    heightMm: 33.9,
    rollWidthMm: 210,
    isRoll: false,
    isDual: false,
    cols: 3,
    barcodeHeight: 28,
    barcodeWidth: 1.2,
    fontSize: 8.5,
  },
]

export default function BarcodeGeneratorModal({ products = [], preselectedProduct = null, onClose }) {
  const [productQuery, setProductQuery] = useState(preselectedProduct?.name || '')
  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct || null)
  const [productSuggestions, setProductSuggestions] = useState([])
  const [showProductSuggestions, setShowProductSuggestions] = useState(false)

  // Default to user's 38x25 Dual roll from Ryans
  const [selectedPresetId, setSelectedPresetId] = useState('38x25_dual')
  const currentPreset = STICKER_ROLL_PRESETS.find((p) => p.id === selectedPresetId) || STICKER_ROLL_PRESETS[0]

  // Label Data
  const [barcodeValue, setBarcodeValue] = useState(
    preselectedProduct?.barcode || preselectedProduct?.sku || generateUniqueBarcode()
  )
  const [labelTitle, setLabelTitle] = useState(preselectedProduct?.name || 'Sample Product')
  const [labelPrice, setLabelPrice] = useState(preselectedProduct ? parseFloat(preselectedProduct.salePrice) : 100)
  const [printCount, setPrintCount] = useState(20)
  const [showShopName, setShowShopName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [showBarcodeText, setShowBarcodeText] = useState(true)

  // Shop Settings
  const [shopName, setShopName] = useState('Smart Buy')

  const printAreaRef = useRef(null)

  // Load shop settings
  useEffect(() => {
    api.get('/admin/settings')
      .then((res) => {
        if (res.data?.data?.shopName) {
          setShopName(res.data.data.shopName)
        }
      })
      .catch(() => {})
  }, [])

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
        width: currentPreset.barcodeWidth,
        height: currentPreset.barcodeHeight,
        displayValue: showBarcodeText,
        fontSize: currentPreset.fontSize,
        margin: 0.5,
        fontOptions: 'bold',
      })
    } catch {
      /* fallback */
    }
  }, [barcodeValue, printCount, selectedPresetId, showShopName, showPrice, showBarcodeText, shopName])

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

  const labelsArray = Array.from({ length: Math.min(500, Math.max(1, parseInt(printCount) || 1)) })

  // Construct dynamic @page print CSS matching exact roll dimensions
  const printPageSizeCSS = currentPreset.isRoll
    ? `@page { size: ${currentPreset.rollWidthMm}mm ${currentPreset.heightMm}mm; margin: 0; }`
    : currentPreset.id === '56mm_pos'
    ? `@page { size: 56mm auto; margin: 0; }`
    : currentPreset.id === '80mm_pos'
    ? `@page { size: 80mm auto; margin: 0; }`
    : `@page { size: A4 portrait; margin: 8mm; }`

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto font-sans">
      {/* ─── MODAL CONTAINER ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col border border-slate-300 overflow-hidden">
        {/* ─── MODAL HEADER (Clean White / Slate) ───────────────────────────── */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center shadow-2xs">
              <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Barcode Sticker Label Printer (স্টিকার প্রিন্টার)
              </h2>
              <p className="text-[11px] text-slate-500">
                Direct Thermal Roll Alignment: <strong>38×25mm 2-Up Dual</strong> & <strong>56mm POS Roll</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        {/* ─── MODAL BODY: LEFT CONTROLS / RIGHT LIVE PREVIEW ──────────────── */}
        <div className="flex-1 flex overflow-hidden divide-x divide-slate-200">
          {/* Controls Column */}
          <div className="w-88 p-4 overflow-y-auto space-y-4 bg-slate-50/60 shrink-0 text-xs">
            {/* 1. Sticker Roll Size Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Sticker Paper / Roll Size (স্টিকার সাইজ) *
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="input text-xs w-full bg-white border-slate-300 font-bold text-slate-900"
              >
                {STICKER_ROLL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-slate-500 mt-1 flex justify-between font-mono bg-white p-1.5 rounded border border-slate-200">
                <span>Single: <strong>{currentPreset.widthMm}×{currentPreset.heightMm}mm</strong></span>
                <span>Feed: <strong>{currentPreset.isDual ? '2 Stickers / Row' : '1 Sticker / Row'}</strong></span>
              </div>
            </div>

            {/* 2. Product Selector */}
            <div className="relative">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Product Name (পণ্যের নাম)
              </label>
              <input
                className="input text-xs w-full bg-white border-slate-300 font-semibold"
                placeholder="Search catalog or type custom name..."
                value={productQuery}
                onChange={(e) => handleProductSearch(e.target.value)}
                onFocus={() => { if (productQuery.trim()) setShowProductSuggestions(true) }}
              />
              {showProductSuggestions && productSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100 z-50">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                    <span>Catalog Items ({productSuggestions.length})</span>
                    <span>Click to select</span>
                  </div>
                  {productSuggestions.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-slate-900 truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.barcode ? `Barcode: ${p.barcode}` : 'Loose item (No barcode)'}
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-900 font-mono text-[11px]">
                        {formatCurrency(p.salePrice)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Barcode Number & Generate */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0">
                  Barcode Code (বারকোড নম্বর)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateNew}
                  className="text-[10px] font-bold text-slate-700 hover:text-slate-900 hover:underline flex items-center"
                >
                  Generate Unique
                </button>
              </div>
              <input
                className="input text-xs font-mono font-bold w-full bg-white border-slate-300"
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                placeholder="e.g. 890123456789"
              />
            </div>

            {/* 4. Price & Copies */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  MRP / Price (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="input text-xs font-mono font-bold text-slate-900 w-full bg-white border-slate-300"
                  value={labelPrice}
                  onChange={(e) => setLabelPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Sticker Count (কপি)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="input text-xs font-mono font-bold text-center w-full bg-white border-slate-300"
                  value={printCount}
                  onChange={(e) => setPrintCount(e.target.value)}
                />
              </div>
            </div>

            {/* 5. Custom Elements on Sticker */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                Sticker Elements (স্টিকার উপাদান)
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0"
                />
                <span className="text-slate-800 font-semibold text-[11px]">
                  Shop Name: <strong className="text-slate-950">{shopName}</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0"
                />
                <span className="text-slate-800 font-semibold text-[11px]">
                  Show Price: <strong>MRP ৳{labelPrice}</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBarcodeText}
                  onChange={(e) => setShowBarcodeText(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-0"
                />
                <span className="text-slate-800 font-semibold text-[11px]">
                  Show Barcode Number Text
                </span>
              </label>
            </div>
          </div>

          {/* ─── LIVE PREVIEW & PRINT CANVAS (Clean Platinum Neutral) ──────── */}
          <div className="flex-1 flex flex-col bg-slate-100/90 p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Live Sticker Roll Preview ({labelsArray.length} Stickers)
              </span>
              <span className="text-[11px] font-mono text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-300 shadow-2xs">
                Roll: <strong>{currentPreset.name}</strong>
              </span>
            </div>

            {/* Printable Stickers Scroll Area */}
            <div className="flex-1 bg-white rounded-xl border border-slate-300 shadow-inner p-4 overflow-y-auto flex justify-center">
              <div
                id="barcode-print-sheet"
                ref={printAreaRef}
                className={
                  currentPreset.isDual
                    ? 'grid grid-cols-2 gap-x-2 gap-y-2.5 w-[78mm] mx-auto'
                    : currentPreset.cols === 3
                    ? 'grid grid-cols-3 gap-2 w-full max-w-[210mm]'
                    : 'flex flex-col items-center gap-2.5 w-full'
                }
              >
                {labelsArray.map((_, idx) => (
                  <div
                    key={idx}
                    className="single-barcode-sticker bg-white text-black text-center flex flex-col items-center justify-between shadow-xs select-none border border-slate-300 rounded-sm print:border-none print:shadow-none overflow-hidden"
                    style={{
                      width: `${currentPreset.widthMm}mm`,
                      height: `${currentPreset.heightMm}mm`,
                      maxHeight: `${currentPreset.heightMm}mm`,
                      padding: '0.8mm 1mm',
                      boxSizing: 'border-box',
                      pageBreakInside: 'avoid',
                    }}
                  >
                    {/* Shop Header */}
                    {showShopName && (
                      <div
                        className="font-black tracking-tight uppercase leading-none text-slate-900 truncate w-full px-0.5"
                        style={{ fontSize: '7.5px' }}
                      >
                        {shopName}
                      </div>
                    )}

                    {/* Product Name */}
                    <div
                      className="font-bold text-slate-950 truncate w-full px-0.5 leading-none my-0.5"
                      style={{ fontSize: '8px' }}
                    >
                      {labelTitle}
                    </div>

                    {/* Barcode SVG Element */}
                    <div className="w-full flex justify-center overflow-hidden my-0">
                      <svg className="barcode-svg-element" />
                    </div>

                    {/* MRP / Price */}
                    {showPrice && (
                      <div
                        className="font-black font-mono text-slate-950 leading-none"
                        style={{ fontSize: '8.5px' }}
                      >
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
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-600">
            Total <strong>{labelsArray.length}</strong> stickers configured ({currentPreset.widthMm}mm × {currentPreset.heightMm}mm).
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs py-2 px-4">
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary text-xs py-2 px-5 font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-2xs"
            >
              <span>Print {currentPreset.widthMm}×{currentPreset.heightMm}mm Stickers</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── INJECTED THERMAL STICKER ROLL PRINT CSS ──────────────────────── */}
      <style>{`
        ${printPageSizeCSS}
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
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
            width: ${currentPreset.rollWidthMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: ${currentPreset.isDual ? 'grid' : 'block'} !important;
            ${currentPreset.isDual ? 'grid-template-columns: repeat(2, 38mm) !important; gap: 2mm !important;' : ''}
          }
          .single-barcode-sticker {
            width: ${currentPreset.widthMm}mm !important;
            height: ${currentPreset.heightMm}mm !important;
            max-height: ${currentPreset.heightMm}mm !important;
            margin: 0 !important;
            padding: 0.8mm 1mm !important;
            border: none !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}
