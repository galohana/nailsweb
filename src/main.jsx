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
