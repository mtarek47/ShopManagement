import { useState, useEffect } from 'react'
import api from '../utils/api'
import { formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'
import useAuthStore from '../hooks/useAuthStore'

const EMPTY_EMPLOYEE = { name: '', phone: '', role: 'CASHIER', password: '' }

export default function EmployeesPage() {
  const { user: currentUser, updateUser } = useAuthStore()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)
  const [form, setForm] = useState(EMPTY_EMPLOYEE)
  const [saving, setSaving] = useState(false)

  // Reset password modal
  const [resetModal, setResetModal] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const res = await api.get('/employees')
      setEmployees(res.data.data || [])
    } catch {
      toast.error('Failed to load employee staff list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const openAdd = () => {
    setEditEmployee(null)
    setForm(EMPTY_EMPLOYEE)
    setShowModal(true)
  }

  const openEdit = (e) => {
    setEditEmployee(e)
    setForm({
      name: e.name || '',
      phone: e.phone || '',
      role: e.role || 'CASHIER',
      isActive: e.isActive ?? true,
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error('Name and phone are required')
    }

    setSaving(true)
    try {
      if (editEmployee) {
        const res = await api.put(`/employees/${editEmployee.id}`, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          role: form.role,
          isActive: form.isActive,
        })
        toast.success('Staff details & phone number updated successfully')
        if (currentUser && currentUser.id === editEmployee.id && res.data?.data) {
          updateUser({ ...currentUser, ...res.data.data })
        }
      } else {
        if (!form.password || form.password.length < 6) {
          setSaving(false)
          return toast.error('Password must be at least 6 characters')
        }
        await api.post('/employees', form)
        toast.success('New employee registered')
      }
      setShowModal(false)
      fetchEmployees()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters')
    }

    try {
      await api.post(`/employees/${resetModal.id}/reset-password`, { newPassword })
      toast.success(`Password updated for ${resetModal.name}`)
      setResetModal(null)
      setNewPassword('')
      setShowPass(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password update failed')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/employees/${deleteTarget.id}`)
      toast.success(`Staff account "${deleteTarget.name}" deleted permanently`)
      setDeleteTarget(null)
      fetchEmployees()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete staff member')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto font-sans">
      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            👤 Staff & Access Control
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage admin, manager, and cashier logins, permissions, and staff accounts
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary text-xs py-2 px-4 shadow-soft-sm font-bold">
          + Add New Staff
        </button>
      </div>

      {/* ─── EMPLOYEES TABLE ────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden bg-white shadow-soft-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">Phone (Login Username)</th>
              <th className="py-3 px-4">Access Role</th>
              <th className="py-3 px-4">Account Status</th>
              <th className="py-3 px-4">Created Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-400">Loading staff accounts...</td></tr>
            ) : employees.map((emp) => {
              const isMe = emp.id === currentUser?.id

              return (
                <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${isMe ? 'bg-indigo-50/30' : ''}`}>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900">{emp.name}</span>
                    {isMe && (
                      <span className="ml-2 badge badge-blue text-[9px] py-0 px-1.5 font-bold">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-600">
                    {emp.phone}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${
                      emp.role === 'SUPER_ADMIN'
                        ? 'bg-purple-100 text-purple-800 font-bold border border-purple-200'
                        : emp.role === 'ADMIN'
                        ? 'badge-red font-bold'
                        : emp.role === 'MANAGER'
                        ? 'badge-blue font-bold'
                        : 'badge-green font-bold'
                    }`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${emp.isActive ? 'badge-green' : 'badge-red'}`}>
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {formatDate(emp.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    {/* Password Change Button */}
                    <button
                      onClick={() => {
                        setResetModal(emp)
                        setNewPassword('')
                        setShowPass(false)
                      }}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                      title="Change Password"
                    >
                      🔑 {isMe ? 'Change Password' : 'Reset Pass'}
                    </button>

                    {/* Edit Staff Details */}
                    <button
                      onClick={() => openEdit(emp)}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                    >
                      Edit
                    </button>

                    {/* Delete Staff Member */}
                    {!isMe && emp.role !== 'SUPER_ADMIN' && (currentUser?.role === 'SUPER_ADMIN' || emp.role !== 'ADMIN') && (
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                        title="Permanently Delete Account"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ─── ADD / EDIT STAFF MODAL ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editEmployee ? 'Edit Staff Details' : 'Register New Staff Member'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="label-title">Full Name *</label>
                <input
                  className="input text-xs"
                  required
                  placeholder="e.g. Shakil Ahmed / Admin"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label-title">Phone Number (Used for Login) *</label>
                <input
                  className="input text-xs font-mono"
                  required
                  placeholder="01700000000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="label-title">Access Role</label>
                <select
                  className="input text-xs font-semibold"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {currentUser?.role === 'SUPER_ADMIN' && (
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Master Control / Invisible)</option>
                  )}
                  <option value="ADMIN">ADMIN (Full System Access)</option>
                  <option value="MANAGER">MANAGER (POS, Stock, Inventory, Reports)</option>
                  <option value="CASHIER">CASHIER (POS Billing & Shift)</option>
                </select>
              </div>

              {!editEmployee && (
                <div>
                  <label className="label-title">Login Password * (Min 6 chars)</label>
                  <input
                    type="password"
                    required
                    className="input text-xs font-mono"
                    placeholder="Enter strong password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              )}

              {editEmployee && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <label htmlFor="isActiveCheck" className="text-xs text-slate-700 font-semibold cursor-pointer">
                    Account Active & Allowed to Sign In
                  </label>
                </div>
              )}

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Saving...' : 'Save Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CHANGE / RESET PASSWORD MODAL ─────────────────────────────────── */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                🔑 {resetModal.id === currentUser?.id ? 'Change My Password' : `Change Password: ${resetModal.name}`}
              </h3>
              <button onClick={() => setResetModal(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Account: <strong>{resetModal.name}</strong> ({resetModal.phone})
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="label-title">Enter New Password (Min 6 characters) *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="input text-xs font-mono pr-8"
                    placeholder="Enter new password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-700"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 text-xs font-bold">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DELETE MODAL ──────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-2xl mx-auto">
              🗑️
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Delete Staff Account?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete account <strong>"{deleteTarget.name}"</strong> ({deleteTarget.phone})? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="btn-danger flex-1 text-xs py-2 font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
