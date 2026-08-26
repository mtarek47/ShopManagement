import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import useAuthStore from '../hooks/useAuthStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
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
      toast.error('Please enter phone and password')
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
      const msg = err.response?.data?.message || 'Login failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white font-sans">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-8">
        {/* Dynamic Brand Logo & Header */}
        <div className="text-center mb-6">
          {brandSettings.shopLogo ? (
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-soft-sm overflow-hidden">
              <img
                src={brandSettings.shopLogo}
                alt={brandSettings.shopName || 'Logo'}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-soft-sm">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
          )}
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {brandSettings.shopName || 'Smart Buy'}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {brandSettings.shopSubtitle || 'Point of Sale & Inventory Terminal'}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Phone Number / User ID
            </label>
            <input
              type="tel"
              className="input font-mono text-xs w-full bg-slate-50 border-slate-300 focus:bg-white"
              placeholder="Enter registered phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Password
            </label>
            <input
              type="password"
              className="input text-xs w-full bg-slate-50 border-slate-300 focus:bg-white"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-2.5 text-xs font-bold mt-2 shadow-soft-sm"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Terminal →'}
          </button>
        </form>
      </div>
    </div>
  )
}
