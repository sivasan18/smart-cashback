import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#0D1117',
          color: '#E2E8F0',
          border: '1px solid #1E2638',
          borderRadius: '12px',
          fontSize: '14px',
          boxShadow: '0 12px 30px 0 rgb(0 0 0 / 0.45)',
        },
        success: { iconTheme: { primary: '#F59E0B', secondary: '#08090D' } },
        error:   { iconTheme: { primary: '#F59E0B', secondary: '#08090D' } },
      }}
    />
  </StrictMode>,
)
