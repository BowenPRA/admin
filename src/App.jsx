import { useEffect, useState } from 'react'
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
import { auth } from './lib/db'
import { DataProvider } from './lib/DataContext'
import { Spinner } from './components/ui'

function Guard({ children }) {
  const [state, setState] = useState({ loading: true, session: null })
  const location = useLocation()
  useEffect(() => {
    let alive = true
    auth.session().then((s) => alive && setState({ loading: false, session: s }))
    const off = auth.onChange((s) => alive && setState({ loading: false, session: s }))
    return () => { alive = false; off() }
  }, [])
  if (state.loading) return <Spinner />
  if (!state.session) return <Navigate to="/login" replace state={{ from: location }} />
  return <DataProvider>{children}</DataProvider>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/print/invoice/:id" element={<Guard><PrintInvoice /></Guard>} />
      <Route path="/print/receipt/:id" element={<Guard><PrintReceipt /></Guard>} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Home />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceBuilder />} />
        <Route path="/invoices/:id" element={<InvoiceEditor />} />
        <Route path="/students" element={<Students />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
