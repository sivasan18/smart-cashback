import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Receipt, Users, Wallet, Search, BarChart3,
  LayoutDashboard, Settings, LogOut, Menu, X,
  Zap, Sun, Moon, Laptop, Monitor, Sparkles, Store
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useThemeStore, type ThemeMode } from '@/store/themeStore'
import toast from 'react-hot-toast'

// Exact requested menu order:
// 1. New Bill
// 2. Customers
// 3. Cashback Wallet
// 4. Wallet Lookup
// 5. Reports
// 6. Dashboard
// 7. Settings
const NAV_ITEMS = [
  { to: '/billing',       icon: Receipt,         label: 'New Bill' },
  { to: '/customers',     icon: Users,           label: 'Customers' },
  { to: '/wallet',        icon: Wallet,          label: 'Cashback Wallet', end: true },
  { to: '/wallet/lookup', icon: Search,          label: 'Wallet Lookup' },
  { to: '/reports',       icon: BarChart3,       label: 'Reports' },
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/settings',      icon: Settings,        label: 'Settings' },
]

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { signOut, user, profile } = useAuthStore()
  const { settings } = useSettingsStore()
  const { theme, setTheme, resolvedTheme } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    sessionStorage.removeItem('just_logged_in')
    await signOut()
    toast.success('Signed out successfully')
    navigate('/login', { replace: true })
  }

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light',  label: 'Light',  icon: Sun },
    { value: 'dark',   label: 'Dark',   icon: Moon },
    { value: 'system', label: 'Auto',   icon: Laptop },
  ]

  return (
    <div className="flex h-screen bg-[#06080d] text-slate-100 overflow-hidden font-sans select-none">
      {/* ── Mobile Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (Dark Luxury Obsidian with Golden Accents) ── */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-[#0b0f17]/90 backdrop-blur-2xl border-r border-white/5 flex flex-col
          transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.35)] flex-shrink-0">
            <Zap size={18} className="text-neutral-950 fill-neutral-950" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate tracking-tight flex items-center gap-1.5">
              <span>{settings?.shop_name || 'Smart Cashback'}</span>
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-[10px] font-semibold text-amber-400/90 tracking-wider uppercase">
                {profile?.shop_name || 'Outlet #01 HQ'}
              </p>
            </div>
          </div>
          <button
            className="ml-auto lg:hidden btn-icon"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => {
            const isActive = end
              ? location.pathname === to
              : location.pathname.startsWith(to)

            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1 text-xs tracking-wide">{label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Customer Display Launcher in Sidebar (Only shown if enabled in Settings) */}
        {settings?.customer_display_enabled !== false && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => {
                window.open(
                  '/customer-display',
                  'smart-cashback-customer-display',
                  'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'
                )
                toast.success('Customer display opened! Move to your external monitor.')
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-400/10 hover:bg-amber-400/15 border border-amber-400/30 transition-all shadow-sm group cursor-pointer"
              title="Open Customer Display on 2nd monitor"
            >
              <div className="flex items-center gap-2.5">
                <Monitor size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Customer Display</span>
              </div>
              <span className="text-[9px] bg-amber-400 text-neutral-950 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider">
                2nd Screen
              </span>
            </button>
          </div>
        )}

        {/* Theme Switcher (Preserved for compatibility) */}
        <div className="px-3 py-2.5 border-t border-white/5">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Theme Mode
            </span>
            <span className="text-[10px] text-amber-400/80">
              {theme === 'system' ? `Auto (${resolvedTheme})` : theme}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
            {themeOptions.map(({ value, label, icon: Icon }) => {
              const active = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-neutral-950 shadow-sm font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title={`${label} Theme`}
                >
                  <Icon size={12} />
                  <span className="text-[10px]">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* User Footer with Outlet Info */}
        <div className="px-3 py-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2 mb-1.5 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {user?.email || 'Administrator'}
              </p>
              <p className="text-[10px] text-amber-400/80 font-medium">
                {profile?.role === 'admin' ? 'Master Admin' : 'Store Operator'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out Terminal</span>
          </button>
        </div>
      </aside>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#06080d]">
        {/* Top Header */}
        <header className="bg-[#0b0f17]/70 backdrop-blur-xl border-b border-white/5 px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <button
            className="btn-icon lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="text-xs font-semibold text-neutral-300">
                POS Terminal Online
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-medium">
              <Sparkles size={12} className="text-amber-400" />
              <span>Cashback Engine 2.0 Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <NavLink
              to="/billing"
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-[0_0_18px_rgba(251,191,36,0.35)] transition-all cursor-pointer"
            >
              <Receipt size={14} />
              <span>+ New Bill</span>
            </NavLink>
          </div>
        </header>

        {/* Page View with Ambient Background */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#06080d] relative animate-fade-in">
          {/* Subtle gold ambient glow in the top-right corner */}
          <div className="pointer-events-none absolute top-0 right-0 w-96 h-96 bg-amber-400/5 blur-[120px] rounded-full" />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
