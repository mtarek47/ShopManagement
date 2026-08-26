import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './hooks/useAuthStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import POSPage from './pages/POSPage'
import InventoryPage from './pages/InventoryPage'
import SuppliersPage from './pages/SuppliersPage'
import PurchasesPage from './pages/PurchasesPage'
import CustomersPage from './pages/CustomersPage'
import EmployeesPage from './pages/EmployeesPage'
import ReportsPage from './pages/ReportsPage'
import AdminPage from './pages/AdminPage'
import ShiftsPage from './pages/ShiftsPage'

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // SUPER_ADMIN has full universal master access to ALL routes and features
  if (user?.role === 'SUPER_ADMIN') {
    return children
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/pos" replace />
  }

  return children
}

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/pos" replace /> : <LoginPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="suppliers" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
            <SuppliersPage />
          </ProtectedRoute>
        } />
        <Route path="purchases" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
            <PurchasesPage />
          </ProtectedRoute>
        } />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
            <ReportsPage />
          </ProtectedRoute>
        } />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="employees" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <EmployeesPage />
          </ProtectedRoute>
        } />
        <Route path="admin" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminPage />
          </ProtectedRoute>
        } />
      </Route>

      {/* Fallback to POS */}
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  )
}

export default App
