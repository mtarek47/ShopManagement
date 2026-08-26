import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import useAuthStore from '../hooks/useAuthStore'
import { formatDateTime } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const { user } = useAuthStore()
  const fileInputRef = useRef(null)
  const logoInputRef = useRef(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [backups, setBackups] = useState([])
  const [settings, setSettings] = useState({
    shopName: 'Smart Buy',
    shopSubtitle: 'Supershop & Departmental Store',
    shopLogo: '',
    shopAddress: 'House #12, Road #04, Dhanmondi, Dhaka',
    shopPhone: '01700-000000, 01800-000000',
    vatRegNo: '002391048-0101',
    receiptFooter: '*** THANK YOU FOR SHOPPING WITH US ***',
    receiptReturnPolicy: 'Exchange possible within 3 days with original receipt',
    backupSchedule: '0 2 * * *',
    lowStockThreshold: 10,
  })
  const [loading, setLoading] = useState(true)
  const [backingUp, setBackingUp] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Restore states
  const [selectedFile, setSelectedFile] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [localRestoreTarget, setLocalRestoreTarget] = useState(null)

  const loadData = async () => {
    setLoading(true)

    // Load Settings
    try {
      const sRes = await api.get('/admin/settings')
      if (sRes.data?.data) {
        setSettings((prev) => ({ ...prev, ...sRes.data.data }))
      }
    } catch (err) {
      console.warn('Failed to load settings:', err)
    }

    // Load Backups
    try {
      const bRes = await api.get('/admin/backups')
      setBackups(bRes.data?.data || [])
    } catch (err) {
      console.warn('Failed to load backups:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleManualBackup = async () => {
    setBackingUp(true)
    try {
      const res = await api.post('/admin/backup')
      toast.success(res.data?.message || 'Database backup archive created successfully!')
      const bRes = await api.get('/admin/backups')
      setBackups(bRes.data?.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Backup creation failed')
    } finally {
      setBackingUp(false)
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await api.put('/admin/settings', settings)
      toast.success('App brand details & settings saved successfully! Reloading to apply.')
      setTimeout(() => {
        window.location.reload()
      }, 800)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      return toast.error('Please select an image file (PNG, JPG, SVG, WebP)')
    }

    if (file.size > 2 * 1024 * 1024) {
      return toast.error('Logo image must be under 2MB')
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSettings((prev) => ({ ...prev, shopLogo: reader.result }))
      toast.success('Logo preview loaded! Click "Save Settings" to apply across the app.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, shopLogo: '' }))
    toast.success('Logo removed. Default monogram initials will be used.')
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast.error('Please choose a valid .zip backup file')
        return
      }
      setSelectedFile(file)
      setLocalRestoreTarget(null)
    }
  }

  const handleStartRestore = () => {
    if (!selectedFile && !localRestoreTarget) {
      return toast.error('Please select a backup .zip file first')
    }
    setShowConfirmModal(true)
  }

  const executeRestore = async () => {
    setShowConfirmModal(false)
    setRestoring(true)

    try {
      if (localRestoreTarget) {
        const res = await api.post(`/admin/restore-local/${localRestoreTarget.filename}`)
        toast.success(res.data?.message || 'System restored successfully!')
      } else if (selectedFile) {
        const formData = new FormData()
        formData.append('backupFile', selectedFile)

        const res = await api.post('/admin/restore', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success(res.data?.message || 'System restored successfully!')
      }
      setSelectedFile(null)
      setLocalRestoreTarget(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              System Settings & Backup Center
            </h1>
            {isSuperAdmin && (
              <span className="badge bg-purple-100 text-purple-800 font-bold border border-purple-200 text-[10px]">
                👑 Super Admin Master Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            App brand name, logo identity, thermal receipt header details, and full database backups
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT COLUMN: SETTINGS FORM (7 COLS) ─────────────────────────── */}
        <div className="lg:col-span-7 space-y-5">
          <form onSubmit={handleSaveSettings} className="card p-6 bg-white shadow-soft-sm border border-slate-200 space-y-5">
            {/* 👑 SUPER ADMIN APP BRAND & LOGO SECTION */}
            <div className={`p-4 rounded-xl border space-y-4 ${
              isSuperAdmin ? 'bg-purple-50/50 border-purple-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    App Brand & Logo Identity
                  </h3>
                </div>
                {isSuperAdmin ? (
                  <span className="text-[10px] text-purple-700 font-semibold bg-purple-100 px-2 py-0.5 rounded">
                    Super Admin Controlled
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                    Managed by Super Admin
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    App Brand Name *
                  </label>
                  <input
                    className="input text-xs w-full font-bold bg-white border-slate-300 disabled:bg-slate-100"
                    required
                    disabled={!isSuperAdmin}
                    placeholder="e.g. Smart Buy / Supershop"
                    value={settings.shopName}
                    onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Displayed in sidebar, window title & top header
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Tagline / Subtitle
                  </label>
                  <input
                    className="input text-xs w-full bg-white border-slate-300 disabled:bg-slate-100"
                    disabled={!isSuperAdmin}
                    placeholder="e.g. Supershop & Departmental Store"
                    value={settings.shopSubtitle}
                    onChange={(e) => setSettings({ ...settings, shopSubtitle: e.target.value })}
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Secondary subtitle for branding
                  </span>
                </div>
              </div>

              {/* Logo Upload & Preview */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Custom App & Receipt Logo
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  {settings.shopLogo ? (
                    <div className="relative group">
                      <img
                        src={settings.shopLogo}
                        alt="Logo Preview"
                        className="w-14 h-14 rounded-xl object-cover border border-slate-300 shadow-soft-sm bg-white"
                      />
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-xs hover:bg-rose-700"
                          title="Remove Logo"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold font-mono text-sm shadow-soft-sm">
                      {settings.shopName ? settings.shopName.substring(0, 2).toUpperCase() : 'SB'}
                    </div>
                  )}

                  {isSuperAdmin && (
                    <div className="space-y-1">
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="btn-secondary text-xs py-1.5 px-3 font-semibold"
                      >
                        📁 Choose Logo Image (PNG/JPG)
                      </button>
                      <div className="text-[10px] text-slate-400">
                        Max 2MB. Applied to sidebar, receipts, and login screen.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* INVOICE & RECEIPT DETAILS SECTION */}
            <div className="space-y-3.5 pt-2">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Receipt & Invoice Header Information
              </h3>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Shop Physical Address *
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  required
                  placeholder="e.g. House #12, Road #04, Dhanmondi, Dhaka"
                  value={settings.shopAddress}
                  onChange={(e) => setSettings({ ...settings, shopAddress: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Contact Phone Numbers *
                  </label>
                  <input
                    className="input text-xs w-full font-mono bg-slate-50 border-slate-300"
                    required
                    placeholder="01700-000000, 01800-000000"
                    value={settings.shopPhone}
                    onChange={(e) => setSettings({ ...settings, shopPhone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    VAT Registration / BIN No.
                  </label>
                  <input
                    className="input text-xs w-full font-mono bg-slate-50 border-slate-300"
                    placeholder="e.g. 002391048-0101"
                    value={settings.vatRegNo}
                    onChange={(e) => setSettings({ ...settings, vatRegNo: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Receipt Return & Exchange Policy
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="Exchange possible within 3 days with original receipt"
                  value={settings.receiptReturnPolicy}
                  onChange={(e) => setSettings({ ...settings, receiptReturnPolicy: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Receipt Footer Thank You Message
                </label>
                <input
                  className="input text-xs w-full bg-slate-50 border-slate-300"
                  placeholder="*** THANK YOU FOR SHOPPING WITH US ***"
                  value={settings.receiptFooter}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="btn-primary text-xs py-2 px-6 shadow-soft-sm font-semibold"
              >
                {savingSettings ? 'Saving Settings...' : 'Save Settings & Apply'}
              </button>
            </div>
          </form>

          {/* ─── LIVE THERMAL RECEIPT PREVIEW ──────────────────────────────── */}
          <div className="card p-5 bg-white border border-slate-200 shadow-soft-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Live 80mm Thermal Receipt Header Preview
            </h3>
            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-center space-y-1 max-w-sm mx-auto shadow-inner text-slate-800">
              {settings.shopLogo && (
                <div className="flex justify-center pb-1">
                  <img src={settings.shopLogo} alt="Logo" className="w-10 h-10 object-contain" />
                </div>
              )}
              <div className="font-bold text-sm tracking-wide uppercase">{settings.shopName || 'SHOP NAME'}</div>
              <div className="text-[10px] text-slate-600">{settings.shopSubtitle}</div>
              <div className="text-[10px] text-slate-600">{settings.shopAddress}</div>
              <div className="text-[10px] text-slate-600 font-bold">Tel: {settings.shopPhone}</div>
              {settings.vatRegNo && <div className="text-[10px] text-slate-500">VAT Reg: {settings.vatRegNo}</div>}
              <div className="border-t border-dashed border-slate-400 my-2 pt-1 text-[10px] text-slate-400">
                [ Items & Transaction Body ]
              </div>
              <div className="text-[9.5px] text-slate-500 pt-1">{settings.receiptReturnPolicy}</div>
              <div className="text-[10px] font-bold text-slate-700">{settings.receiptFooter}</div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: BACKUP & RESTORE (5 COLS) ────────────────────── */}
        <div className="lg:col-span-5 space-y-5">
          {/* Backup Action Card */}
          <div className="card p-5 bg-white shadow-soft-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Database & Settings Backup
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Dual archive (PostgreSQL + JSON + Brand Settings)</p>
              </div>
              <button
                onClick={handleManualBackup}
                disabled={backingUp}
                className="btn-primary text-xs py-2 px-3.5 shadow-soft-sm font-semibold"
              >
                {backingUp ? 'Backing up...' : 'Trigger Backup Now'}
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-800">• Automatic Daily Backup: Active (02:00 AM)</div>
              <div className="text-[11px] text-slate-500">• Storage: Encrypted local archives (.zip) with 30-day retention</div>
            </div>
          </div>

          {/* System Restore Card */}
          <div className="card p-5 bg-white shadow-soft-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Full System Restore (.zip)
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Upload a backup .zip file to restore products, sales, customers, and invoice settings
              </p>
            </div>

            <div className="p-3.5 border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2 text-center">
              <input
                type="file"
                ref={fileInputRef}
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs py-1.5 px-4 font-semibold"
              >
                Choose Backup File (.zip)
              </button>
              {selectedFile ? (
                <div className="text-xs font-mono font-bold text-indigo-700 truncate">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">No custom file chosen</div>
              )}
            </div>

            {selectedFile && (
              <button
                onClick={handleStartRestore}
                disabled={restoring}
                className="btn-primary text-xs py-2 w-full font-semibold"
              >
                {restoring ? 'Restoring System...' : 'Restore System from Selected File'}
              </button>
            )}
          </div>

          {/* Historical Backup Archives List */}
          <div className="card p-0 overflow-hidden bg-white shadow-soft-sm border border-slate-200">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Local Backup History
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">{backups.length} archives</span>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading backup logs...</div>
              ) : backups.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No backup records yet.</div>
              ) : (
                backups.map((b) => (
                  <div key={b.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold font-mono text-slate-900 truncate max-w-xs">{b.filename}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatDateTime(b.createdAt)} • {b.fileSize ? `${(b.fileSize / 1024).toFixed(1)} KB` : 'N/A'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setLocalRestoreTarget(b)
                        setSelectedFile(null)
                        setShowConfirmModal(true)
                      }}
                      className="btn-secondary text-[10px] py-1 px-2.5 font-semibold"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── RESTORE CONFIRMATION MODAL ─────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Confirm Full System Restore
                </h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to restore the system?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
              <div>Target: <strong className="font-mono">{localRestoreTarget?.filename || selectedFile?.name}</strong></div>
              <div className="text-[11px] text-slate-500">This will synchronize inventory products, sales, customers, and invoice settings from the backup snapshot.</div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false)
                  setLocalRestoreTarget(null)
                }}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                className="btn-primary flex-1 text-xs py-2 font-semibold"
              >
                Yes, Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
