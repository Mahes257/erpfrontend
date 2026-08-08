import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// ERP bulk-selection-toolbar.css port — pixel parity for the bulk action bar
import './bulk-selection-toolbar.css'
import App from './App.jsx'

// Restore theme before first paint to avoid a flash of the wrong theme.
try {
  if (localStorage.getItem('erp-theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  // storage unavailable - default to light theme
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
