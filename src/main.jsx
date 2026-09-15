import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { LangProvider } from './lib/i18n'
import { ToastProvider } from './lib/toast'

// HashRouter keeps deep links (#/invoice/...) working on GitHub Pages with no
// server config needed.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <LangProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </LangProvider>
    </HashRouter>
  </StrictMode>,
)
