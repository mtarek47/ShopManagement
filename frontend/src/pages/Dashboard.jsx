import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../utils/api'
import { formatCurrency, formatDateTime } from '../utils/helpers'
import { useNavigate } from 'react-router-dom'

const MetricCard = ({ label, value, sub, variant = 'blue' }) => {
  const borderColors = {
    blue: 'border-l-indigo-600',
    green: 'border-l-emerald-600',
    amber: 'border-l-amber-500',
    rose: 'border-l-rose-500',
  }

  const textColors = {
    blue: 'text-indigo-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }

  return (
    <div className={`card border-l-4 ${borderColors[variant]} bg-white shadow-soft-sm`}>
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{label}</div>
      <div className={`text-2xl font-black tracking-tight mt-1 truncate ${textColors[variant]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 font-medium mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
        <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Store Performance Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Smart Buy POS Terminal • {new Date().toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/pos')} className="btn-success text-xs py-2 px-4 shadow-soft-sm">
            ⚡ Open Billing Terminal
          </button>
          <button onClick={() => navigate('/reports')} className="btn-secondary text-xs py-2 px-3.5">
            Full Reports
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Gross Sales"
          value={formatCurrency(data?.todaySales || 0)}
          sub={`${data?.todayTransactions || 0} completed orders`}
          variant="blue"
        />
        <MetricCard
          label="Today's Transactions"
          value={data?.todayTransactions || 0}
          sub="Customer checkouts"
          variant="green"
        />
        <MetricCard
          label="Estimated Gross Profit"
          value={formatCurrency(data?.todayProfit || 0)}
          sub="Margin today"
          variant="green"
        />
        <MetricCard
          label="Low Stock Alerts"
          value={data?.lowStockCount || 0}
          sub={data?.lowStockCount > 0 ? "Items need restocking" : "All stocks healthy"}
          variant={data?.lowStockCount > 0 ? "rose" : "green"}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 card bg-white">
          <div className="card-header">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Weekly Revenue Velocity</h2>
              <p className="text-xs text-slate-400">Daily sales performance over the past 7 days</p>
            </div>
            <span className="badge badge-blue">BDT (৳)</span>
          </div>

          <div className="pt-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.last7DaysSales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `৳${v.toLocaleString()}`} />
                <Tooltip
                  formatter={(v) => [formatCurrency(v), 'Sales']}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Recent Transactions Feed */}
        <div className="card bg-white flex flex-col justify-between">
          <div>
            <div className="card-header">
              <h2 className="text-sm font-bold text-slate-800">Recent Sales Audit</h2>
              <span className="text-xs text-slate-400">Today</span>
            </div>

            {(!data?.last5Sales || data.last5Sales.length === 0) ? (
              <div className="text-center text-slate-400 py-10 text-xs">
                No transactions recorded yet today
              </div>
            ) : (
              <div className="space-y-2">
                {data.last5Sales.map(sale => (
                  <div key={sale.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{sale.invoiceNo}</div>
                      <div className="text-[11px] text-slate-400">{sale.customer?.name || 'Walk-in'} • {formatDateTime(sale.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-indigo-700">{formatCurrency(sale.totalAmount)}</div>
                      <span className="badge badge-green text-[9px] py-0">{sale.payments?.[0]?.method || 'CASH'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/pos')}
            className="btn-primary w-full text-xs py-2.5 mt-3"
          >
            Start New Bill [F2] →
          </button>
        </div>
      </div>
    </div>
  )
}
