import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyDesign } from './lib/applyDesign'
import { design } from './config/design'

/* מזריק את העיצוב מ-config/design.js ל-:root לפני שה-React מצייר */
applyDesign(design)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

/* ── PWA service worker — רישום בפרודקשן בלבד (לא ב-dev כדי לא לשבש Vite HMR) ── */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
