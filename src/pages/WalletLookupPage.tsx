import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Wallet, Receipt, Gift, ShoppingBag,
  Users, ChevronRight, Sparkles, ArrowRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, validateMobile, normalizeMobile } from '@/lib/cashback'
import { format } from 'date-fns'
import type { Customer, Transaction } from '@/types'
import DigitalCashbackPass3D from '@/components/common/DigitalCashbackPass3D'

export default function WalletLookupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Determine active view: 'overview' (Cashback Wallet) vs 'lookup' (Wallet Lookup)
  const isLookupPath = location.pathname.includes('/lookup') || searchParams.get('tab') === 'lookup'
  const [activeTab, setActiveTab] = useState<'overview' | 'lookup'>(isLookupPath ? 'lookup' : 'overview')

  // Overview State
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [overviewSearch, setOverviewSearch] = useState('')
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [walletStats, setWalletStats] = useState({
    outstandingBalance: 0,
    totalIssued: 0,
    totalRedeemed: 0,
    walletsWithBalance: 0,
  })

  // Individual Lookup State
  const [mobile, setMobile] = useState(searchParams.get('mobile') ?? '')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [searched, setSearched] = useState(false)
  const [loadingLookup, setLoadingLookup] = useState(false)
  const [mobileError, setMobileError] = useState('')

  useEffect(() => {
    if (location.pathname.includes('/lookup')) {
      setActiveTab('lookup')
    }
  }, [location.pathname])

  // 1. CASHBACK WALLET OVERVIEW DATA
  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .not('name', 'eq', '[Deleted Customer]')
      .not('mobile', 'like', 'DEL%')
      .order('cashback_balance', { ascending: false })

    const list = (data as Customer[]) ?? []
    setAllCustomers(list)

    const outstanding = list.reduce((sum, c) => sum + (c.cashback_balance || 0), 0)
    const issued = list.reduce((sum, c) => sum + (c.cashback_earned || 0), 0)
    const redeemed = list.reduce((sum, c) => sum + (c.cashback_redeemed || 0), 0)
    const activeCount = list.filter(c => (c.cashback_balance || 0) > 0).length

    setWalletStats({
      outstandingBalance: outstanding,
      totalIssued: issued,
      totalRedeemed: redeemed,
      walletsWithBalance: activeCount,
    })
    setLoadingOverview(false)
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  // 2. INDIVIDUAL WALLET LOOKUP
  const handleSearch = useCallback(async (searchMobile?: string) => {
    const m = normalizeMobile((searchMobile ?? mobile).trim())
    if (!validateMobile(m)) {
      setMobileError('Enter a valid 10-digit mobile number')
      return
    }
    setMobileError('')
    setLoadingLookup(true)
    setSearched(true)

    const { data: cust } = await supabase
      .from('customers')
      .select('*')
      .eq('mobile', m)
      .maybeSingle()

    setCustomer(cust as Customer | null)

    if (cust) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_id', cust.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50)

      setTransactions((txs as Transaction[]) ?? [])
    } else {
      setTransactions([])
    }
    setLoadingLookup(false)
  }, [mobile])

  useEffect(() => {
    const m = searchParams.get('mobile')
    if (m) {
      setMobile(m)
      handleSearch(m)
    }
  }, [searchParams, handleSearch])

  const filteredOverview = allCustomers.filter(c => {
    if (!overviewSearch.trim()) return true
    const q = overviewSearch.toLowerCase().trim()
    return c.name.toLowerCase().includes(q) || c.mobile.includes(q)
  })

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#08090D] via-[#0D1117] to-[#08090D] text-white relative overflow-hidden font-sans space-y-7">
      {/* ── Ambient Background Glows (Cyber-Teal Glassmorphic V2) ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[160px]" />

      {/* ── Header Title & Tab Switcher ── */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Cashback Wallet & VIP Pass
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Monitor store-wide cashback liability and lookup customer pass balances
              </p>
            </div>
          </div>
        </div>

        {/* Tab pill switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
          <button
            onClick={() => {
              setActiveTab('overview')
              navigate('/wallet')
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Cashback Wallet Overview
          </button>
          <button
            onClick={() => {
              setActiveTab('lookup')
              navigate('/wallet/lookup')
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'lookup'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Individual Wallet Lookup
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: CASHBACK WALLET OVERVIEW
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in relative z-10">
          {/* Top 4 KPI Glass Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Liability</span>
              <p className="text-3xl font-black text-white mt-2">{formatCurrency(walletStats.outstandingBalance)}</p>
              <p className="text-[11px] text-cyan-300 mt-1">Total circulating store credit</p>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cashback Issued</span>
              <p className="text-3xl font-black text-emerald-400 mt-2">+{formatCurrency(walletStats.totalIssued)}</p>
              <p className="text-[11px] text-emerald-400/80 mt-1">Cumulative earned by customers</p>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cashback Used</span>
              <p className="text-3xl font-black text-amber-400 mt-2">−{formatCurrency(walletStats.totalRedeemed)}</p>
              <p className="text-[11px] text-amber-400/80 mt-1">Redeemed against POS bills</p>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Wallets</span>
              <p className="text-3xl font-black text-cyan-300 mt-2">{walletStats.walletsWithBalance} / {allCustomers.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">Patrons with positive balance</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={overviewSearch}
              onChange={e => setOverviewSearch(e.target.value)}
              placeholder="Filter customer wallets by name or mobile…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 backdrop-blur-xl border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
            />
          </div>

          {/* Customers Wallet Directory Table */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Mobile</th>
                    <th className="px-5 py-4">Available Wallet Balance</th>
                    <th className="px-5 py-4">Total Earned</th>
                    <th className="px-5 py-4">Total Redeemed</th>
                    <th className="px-5 py-4 text-right pr-6">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingOverview && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <div className="flex justify-center items-center gap-2">
                          <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          Loading wallet ledgers…
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loadingOverview && filteredOverview.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400 text-sm">
                        No customer wallets found.
                      </td>
                    </tr>
                  )}

                  {filteredOverview.map(c => (
                    <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center">
                            {c.name[0]?.toUpperCase() || 'C'}
                          </div>
                          <span className="font-bold text-white text-sm">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-cyan-300">{c.mobile}</td>
                      <td className="px-5 py-4">
                        <span className={`font-black text-sm ${c.cashback_balance > 0 ? 'text-cyan-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}>
                          {formatCurrency(c.cashback_balance)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-emerald-400 font-semibold">+{formatCurrency(c.cashback_earned)}</td>
                      <td className="px-5 py-4 text-amber-400 font-semibold">{c.cashback_redeemed > 0 ? `− ${formatCurrency(c.cashback_redeemed)}` : '—'}</td>
                      <td className="px-5 py-4 text-right pr-6">
                        <button
                          onClick={() => {
                            setMobile(c.mobile)
                            setActiveTab('lookup')
                            navigate(`/wallet/lookup?mobile=${c.mobile}`)
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <span>Open Pass</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: INDIVIDUAL WALLET LOOKUP & 3D VIP PASS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'lookup' && (
        <div className="space-y-6 animate-fade-in relative z-10 max-w-3xl mx-auto">
          {/* Lookup Input Card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-6 shadow-2xl transition-all duration-300 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Search size={16} className="text-cyan-400" />
              Customer Wallet & Balance Lookup
            </h2>

            <form
              onSubmit={e => {
                e.preventDefault()
                handleSearch()
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => {
                    setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                    setMobileError('')
                  }}
                  placeholder="Enter 10-digit customer mobile number"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-base text-cyan-300 font-mono tracking-wider transition-colors"
                  maxLength={10}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loadingLookup}
                className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-md shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loadingLookup ? 'Looking up…' : 'Lookup Pass'}
              </button>
            </form>
            {mobileError && <p className="text-xs text-rose-400 font-semibold">{mobileError}</p>}
          </div>

          {/* Not found */}
          {searched && !loadingLookup && !customer && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center animate-fade-in space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
                🔍
              </div>
              <p className="font-bold text-white text-base">No Customer Found</p>
              <p className="text-xs text-slate-400">
                No active rewards account registered for mobile <strong>+91 {normalizeMobile(mobile)}</strong>
              </p>
              <button
                onClick={() => navigate('/billing')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-cyan-500/25 mt-2"
              >
                Create Bill & Register Customer
              </button>
            </div>
          )}

          {/* Customer Wallet Found with Luxury 3D Digital Cashback Pass */}
          {customer && (
            <div className="space-y-6 animate-fade-in">
              {/* Luxury 3D Digital Cashback VIP Pass */}
              <div className="py-2 flex justify-center">
                <DigitalCashbackPass3D
                  customerName={customer.name}
                  mobile={customer.mobile}
                  balance={customer.cashback_balance}
                  lifetimeEarned={customer.cashback_earned}
                  shopName="Smart Cashback POS"
                />
              </div>

              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Purchases', value: formatCurrency(customer.total_purchases), icon: ShoppingBag, color: 'text-white' },
                  { label: 'Cashback Earned', value: formatCurrency(customer.cashback_earned), icon: Gift, color: 'text-emerald-400' },
                  { label: 'Cashback Used', value: formatCurrency(customer.cashback_redeemed), icon: Receipt, color: 'text-amber-400' },
                  { label: 'Current Wallet', value: formatCurrency(customer.cashback_balance), icon: Wallet, color: 'text-cyan-300' },
                ].map(({ label, value, icon: Icon, color }, i) => (
                  <div key={i} className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
                    <Icon size={16} className={`${color} mb-1`} />
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
                    <p className={`text-lg font-black ${color} mt-0.5`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Recent Transactions Table */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">Recent Purchase Transactions</h3>
                  <button
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold"
                  >
                    View Full Customer Ledger →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="bg-white/[0.03] border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Service</th>
                        <th className="px-5 py-3">Bill Amount</th>
                        <th className="px-5 py-3">Redeemed</th>
                        <th className="px-5 py-3">Amount Paid</th>
                        <th className="px-5 py-3">Earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 text-sm">
                            No transactions recorded yet for this customer.
                          </td>
                        </tr>
                      ) : (
                        transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                              {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}
                            </td>
                            <td className="px-5 py-3 font-semibold text-white">{tx.service_category}</td>
                            <td className="px-5 py-3 font-medium text-slate-200">{formatCurrency(tx.bill_amount)}</td>
                            <td className="px-5 py-3 text-amber-400 font-semibold">
                              {tx.cashback_redeemed > 0 ? `− ${formatCurrency(tx.cashback_redeemed)}` : '—'}
                            </td>
                            <td className="px-5 py-3 font-bold text-white">{formatCurrency(tx.amount_paid)}</td>
                            <td className="px-5 py-3 font-bold text-emerald-400">+{formatCurrency(tx.cashback_earned)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
