import React, { useEffect, Component, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useThemeStore } from '@/store/themeStore'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import BillingPage from '@/pages/BillingPage'
import CustomersPage from '@/pages/CustomersPage'
import CustomerDetailPage from '@/pages/CustomerDetailPage'
import WalletLookupPage from '@/pages/WalletLookupPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import CustomerDisplayPage from '@/pages/CustomerDisplayPage'
import { Zap, AlertTriangle, RefreshCw } from 'lucide-react'

// ─── Luxury Amber Glowing Skeleton / Loader ──────────────────────────────────
function LuxuryAmberLoader() {
  return (
    <div className="min-h-screen bg-[#06080d] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Ambient background gold glow */}
      <div className="absolute w-96 h-96 rounded-full bg-amber-400/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Pulsing golden badge */}
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-[0_0_40px_rgba(251,191,36,0.35)] animate-pulse">
            <Zap size={32} className="text-neutral-950 fill-neutral-950" />
          </div>
          <span className="absolute -inset-1 rounded-2xl border border-amber-400/40 animate-ping opacity-30" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mb-2 font-sans">
          Smart <span className="text-amber-400">Cashback</span>
        </h2>
        <p className="text-xs text-neutral-400 tracking-wide mb-6">
          Initializing secure POS terminal & engine…
        </p>

        {/* Golden linear progress bar */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-amber-400 to-amber-200 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ─── Global Error Boundary (Prevents ANY Blank / White Screen) ────────────────
interface ErrorBoundaryProps {
  children: ReactNode
}
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught unhandled rendering error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/billing'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06080d] flex items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full backdrop-blur-xl bg-slate-900/80 border border-amber-400/30 rounded-3xl p-8 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">POS Interface Restored</h2>
            <p className="text-xs text-neutral-400 mb-6">
              A temporary interface state occurred. Your active records, balances, and database transactions remain 100% safe.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.35)] transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              Reload Billing Terminal
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Protected Route Guard ────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, initialized, loading } = useAuthStore()
  const location = useLocation()

  if (!initialized || loading) {
    return <LuxuryAmberLoader />
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// ─── Main App Entry ──────────────────────────────────────────────────────────
export default function App() {
  const { initialize: initAuth } = useAuthStore()
  const { fetchSettings } = useSettingsStore()
  const { initialize: initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
    initAuth().then(() => fetchSettings())
  }, [initAuth, fetchSettings, initTheme])

  return (
    <GlobalErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/customer-display" element={<CustomerDisplayPage />} />

          {/* Root path: Immediately redirects to /billing */}
          <Route path="/" element={<Navigate to="/billing" replace />} />

          {/* Protected Outlet & Admin Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/wallet" element={<WalletLookupPage />} />
            <Route path="/wallet/lookup" element={<WalletLookupPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Shop ID branch routing fallback */}
            <Route path="/shop/:id" element={<Navigate to="/billing" replace />} />
          </Route>

          {/* Catch-all redirect to New Bill */}
          <Route path="*" element={<Navigate to="/billing" replace />} />
        </Routes>
      </BrowserRouter>
    </GlobalErrorBoundary>
  )
}
