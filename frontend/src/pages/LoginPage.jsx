import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import useAuthStore from '../hooks/useAuthStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [brandSettings, setBrandSettings] = useState({
    shopName: 'Smart Buy',
    shopSubtitle: 'Point of Sale & Inventory Terminal',
    shopLogo: null,
  })

  const { login } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Fetch live shop branding settings for dynamic name & logo
    api.get('/admin/settings')
      .then((res) => {
        if (res.data?.data) {
          setBrandSettings((prev) => ({
            ...prev,
            ...res.data.data,
          }))
        }
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!phone || !password) {
      toast.error('Please enter phone number and password')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/login', { phone, password })
      const { user, token } = res.data.data
      login(user, token)
      toast.success(`Welcome back, ${user.name}!`)
      navigate('/')
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] flex flex-col justify-between p-4 sm:p-6 selection:bg-slate-900 selection:text-white font-sans text-slate-800">
      {/* Top Header Bar */}
      <div className="flex justify-between items-center px-4 py-2 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-slate-700">POS Terminal • Online</span>
        </div>
        <span className="text-[11px] text-slate-400">Enterprise Edition</span>
      </div>

      {/* Center Corporate Login Card with High Rounded Corners */}
      <div className="flex items-center justify-center my-auto p-2">
        <div className="bg-white rounded-[32px] shadow-lg border border-slate-200/80 w-full max-w-sm p-8 sm:p-10 transition-all">
          {/* Brand Header */}
          <div className="text-center mb-7">
            {brandSettings.shopLogo ? (
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden">
                <img
                  src={brandSettings.shopLogo}
                  alt={brandSettings.shopName || 'Logo'}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xl shadow-xs">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
            )}

            <h1 className="text-2xl font-black text-slate-950 tracking-tight">
              {brandSettings.shopName || 'Smart Buy'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {brandSettings.shopSubtitle || 'Point of Sale & Inventory Terminal'}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number Field */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Phone Number / Staff ID (ফোন নম্বর)
              </label>
              <input
                type="tel"
                className="input text-xs font-mono w-full bg-slate-50 border-slate-300 focus:bg-white focus:border-slate-900 focus:ring-0 rounded-xl py-2.5"
                placeholder="01700000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Password (পাসওয়ার্ড)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input text-xs w-full pr-14 bg-slate-50 border-slate-300 focus:bg-white focus:border-slate-900 focus:ring-0 rounded-xl py-2.5"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-900 text-[11px] font-bold px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary w-full py-3 text-xs font-bold mt-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              disabled={loading}
            >
              {loading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          {/* Clean Security Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400 font-medium">
            256-Bit Encrypted Session • Authorized Staff Only
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-400 font-mono py-2">
        © {new Date().getFullYear()} {brandSettings.shopName || 'Smart Buy'} POS System
      </div>
    </div>
  )
}
