import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Students from './pages/Students'
import Invoices from './pages/Invoices'
import InvoiceBuilder from './pages/InvoiceBuilder'
import InvoiceEditor from './pages/InvoiceEditor'
import PrintInvoice from './pages/PrintInvoice'
import PrintReceipt from './pages/PrintReceipt'
import SettingsPage from './pages/Settings'
import Reports from './pages/reports/Reports'
import ReportEditor from './pages/reports/ReportEditor'
import PrintReport from './pages/reports/PrintReport'
import PrintBatch from './pages/reports/PrintBatch'
import Teachers from './pages/reports/Teachers'
import ReportSettings from './pages/reports/ReportSettings'
import { DataProvider } from './lib/DataContext'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { Spinner } from './components/ui'

function Guard({ children }) {
  const { loading, session } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <DataProvider>{children}</DataProvider>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/print/invoice/:id" element={<Guard><PrintInvoice /></Guard>} />
        <Route path="/print/receipt/:id" element={<Guard><PrintReceipt /></Guard>} />
        <Route path="/print/report/:id" element={<Guard><PrintReport /></Guard>} />
        <Route path="/print/reports" element={<Guard><PrintBatch /></Guard>} />
        <Route element={<Guard><Layout /></Guard>}>
          <Route index element={<Home />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<InvoiceBuilder />} />
          <Route path="/invoices/:id" element={<InvoiceEditor />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/settings" element={<ReportSettings />} />
          <Route path="/reports/:id" element={<ReportEditor />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/students" element={<Students />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
