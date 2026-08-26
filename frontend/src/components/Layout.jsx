import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import useAuthStore from '../hooks/useAuthStore'
import api from '../utils/api'
import toast from 'react-hot-toast'

// Clean Minimalist SVG Icons
const Icons = {
  POS: () => (
    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Inventory: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Purchases: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  Suppliers: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Customers: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Reports: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Shifts: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Employees: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2H9.17A3.001 3.001 0 0112 14z" />
    </svg>
  ),
  Admin: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
}

const navItems = [
  { path: '/pos',        label: 'POS Counter',  icon: Icons.POS,       roles: ['ADMIN', 'MANAGER', 'CASHIER'], highlight: true },
  { path: '/inventory',  label: 'Inventory',     icon: Icons.Inventory, roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/purchases',  label: 'Stock In / PO',icon: Icons.Purchases, roles: ['ADMIN', 'MANAGER'] },
  { path: '/suppliers',  label: 'Suppliers',     icon: Icons.Suppliers, roles: ['ADMIN', 'MANAGER'] },
  { path: '/customers',  label: 'Customers',     icon: Icons.Customers, roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/reports',    label: 'Analytics',     icon: Icons.Reports,   roles: ['ADMIN', 'MANAGER'] },
  { path: '/shifts',     label: 'Cash Shifts',   icon: Icons.Shifts,    roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/employees',  label: 'Staff Access',  icon: Icons.Employees, roles: ['ADMIN'] },
  { path: '/admin',      label: 'Settings',      icon: Icons.Admin,     roles: ['ADMIN'] },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [shopSettings, setShopSettings] = useState({
    shopName: 'Smart Buy',
    shopSubtitle: 'POS System',
    shopLogo: '',
  })

  useEffect(() => {
    const fetchBrandSettings = async () => {
      try {
        const res = await api.get('/admin/settings')
        if (res.data?.data) {
          setShopSettings(res.data.data)
        }
      } catch (err) {
        console.warn('Failed to load brand settings:', err)
      }
    }
    fetchBrandSettings()
  }, [])

  const handleLogout = () => {
    logout()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  // Super Admin has master bypass to all nav items
  const visibleNavItems = navItems.filter((item) =>
    user?.role === 'SUPER_ADMIN' || item.roles.includes(user?.role)
  )

  const initials = shopSettings.shopName
    ? shopSettings.shopName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'SB'

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 overflow-hidden font-sans antialiased">
      {/* Executive Dark Slate Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-56' : 'w-16'
        } bg-slate-900 border-r border-slate-800 text-white flex flex-col transition-all duration-150 shrink-0 select-none z-30`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {shopSettings.shopLogo ? (
              <img
                src={shopSettings.shopLogo}
                alt="Logo"
                className="w-8 h-8 rounded-lg object-cover shadow-soft-sm shrink-0 border border-slate-700 bg-white"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-soft-sm shrink-0 font-mono">
                {initials}
              </div>
            )}
            {sidebarOpen && (
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                  {shopSettings.shopName || 'Smart Buy'}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-[10px] font-medium text-slate-400 truncate">
                  {shopSettings.shopSubtitle || 'POS System'}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Quick Launch Button for POS Billing */}
        <div className="p-2.5">
          <NavLink
            to="/pos"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-800/40'
              }`
            }
          >
            <Icons.POS />
            {sidebarOpen && (
              <div className="flex items-center justify-between flex-1">
                <span>Billing Counter</span>
                <span className="text-[9px] bg-emerald-900/80 text-emerald-200 px-1 py-0.5 rounded font-mono font-bold">F2</span>
              </div>
            )}
          </NavLink>
        </div>

        {/* Standard Navigation */}
        <nav className="flex-1 px-2.5 py-1 space-y-1 overflow-y-auto">
          {visibleNavItems.filter((i) => !i.highlight).map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-soft-sm'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`
                }
              >
                <Icon />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User Footer Card */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                user?.role === 'SUPER_ADMIN' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              {sidebarOpen && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200 truncate">{user?.name}</div>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider truncate ${
                    user?.role === 'SUPER_ADMIN' ? 'text-purple-400' : 'text-slate-400'
                  }`}>
                    {user?.role}
                  </div>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Sign Out"
              >
                <Icons.Logout />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 min-w-0">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
