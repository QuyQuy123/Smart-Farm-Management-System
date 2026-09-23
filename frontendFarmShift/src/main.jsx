// d:\Smart-Farm-Management-System\frontendFarmShift\src\main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './assets/global.css' // Import global CSS tokens
import './index.css'           // Import full design system (farm colors, typography, etc.)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
