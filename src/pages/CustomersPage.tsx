import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Eye, Edit2, Trash2, X, AlertTriangle,
  User, Phone, Wallet, ShoppingBag, ShieldAlert, Sparkles,
  Users, TrendingUp, CheckCircle2, Coins
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, validateMobile, normalizeMobile } from '@/lib/cashback'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Add Customer modal / drawer
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMobile, setNewMobile] = useState('')
  const [adding, setAdding] = useState(false)

  // Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editName, setEditName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete Customer Modal
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCustomers = useCallback(async (q?: string) => {
    setLoading(true)
    let query = supabase
      .from('customers')
      .select('*')
      .not('name', 'eq', '[Deleted Customer]')
      .not('mobile', 'like', 'DEL%')
      .order('created_at', { ascending: false })

    if (q) {
      query = query.or(`name.ilike.%${q}%,mobile.ilike.%${q}%`)
    }
    const { data, error } = await query.limit(150)
    if (error) {
      toast.error('Failed to load customers')
    } else {
      setCustomers((data as Customer[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCustomers(search.trim())
  }

  // ── KPI Stats ──
  const kpiStats = useMemo(() => {
    const totalCount = customers.length
    const walletsWithBalance = customers.filter(c => (c.cashback_balance || 0) > 0).length
    const totalOutstandingBalance = customers.reduce((sum, c) => sum + (c.cashback_balance || 0), 0)
    const totalLifetimePurchases = customers.reduce((sum, c) => sum + (c.total_purchases || 0), 0)

    return {
      totalCount,
      walletsWithBalance,
      totalOutstandingBalance,
      totalLifetimePurchases,
    }
  }, [customers])

  // ADD CUSTOMER
  const handleAddCustomer = async () => {
    if (!newName.trim() || !newMobile.trim()) {
      toast.error('Name and mobile are required')
      return
    }
    const norm = normalizeMobile(newMobile.trim())
    if (!validateMobile(norm)) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }

    setAdding(true)
    const { error } = await supabase.from('customers').insert({
      name: newName.trim(),
      mobile: norm,
      cashback_balance: 0,
      cashback_earned: 0,
      cashback_redeemed: 0,
      total_purchases: 0,
    })
    setAdding(false)

    if (error) {
      toast.error(error.code === '23505' ? 'Mobile number already registered' : error.message)
      return
    }

    toast.success('Customer registered successfully')
    setShowAdd(false)
    setNewName('')
    setNewMobile('')
    fetchCustomers()
  }

  // EDIT CUSTOMER
  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c)
    setEditName(c.name)
    setEditMobile(c.mobile)
  }

  const handleSaveEdit = async () => {
    if (!editingCustomer) return
    if (!editName.trim() || !editMobile.trim()) {
      toast.error('Name and mobile number are required')
      return
    }
    const norm = normalizeMobile(editMobile.trim())
    if (!validateMobile(norm)) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }

    setSavingEdit(true)
    const { error } = await supabase
      .from('customers')
      .update({
        name: editName.trim(),
        mobile: norm,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingCustomer.id)

    setSavingEdit(false)

    if (error) {
      toast.error(error.code === '23505' ? 'Mobile number already in use by another customer' : error.message)
      return
    }

    toast.success('Customer details updated')
    setEditingCustomer(null)
    fetchCustomers(search.trim() || undefined)
  }

  // DELETE CUSTOMER
  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return
    setDeleting(true)

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_customer', {
        p_customer_id: deletingCustomer.id,
      })

      if (!rpcErr) {
        toast.success(`Customer ${deletingCustomer.name} deleted successfully`)
      } else {
        await supabase.from('cashback_ledger').delete().eq('customer_id', deletingCustomer.id)
        const { data: delRows, error: delErr } = await supabase
          .from('customers')
          .delete()
          .eq('id', deletingCustomer.id)
          .select()

        if (delErr || !delRows || delRows.length === 0) {
          const anonymizedMobile = 'DEL' + deletingCustomer.id.replace(/-/g, '').slice(0, 7)
          await supabase.from('customers').update({
            name: '[Deleted Customer]',
            mobile: anonymizedMobile,
            cashback_balance: 0,
            cashback_earned: 0,
            cashback_redeemed: 0,
            total_purchases: 0,
            updated_at: new Date().toISOString(),
          }).eq('id', deletingCustomer.id)
        }

        toast.success(`Customer ${deletingCustomer.name} removed successfully`)
      }

      setDeletingCustomer(null)
      fetchCustomers(search.trim() || undefined)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete customer')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#08090D] via-[#0D1117] to-[#08090D] text-white relative overflow-hidden font-sans space-y-7">
      {/* ── Ambient Background Glows (Cyber-Teal Glassmorphic V2) ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[160px]" />

      {/* ── Top Bar Header ── */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Customer Registry & Loyalty
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Manage registered patrons, cashback balances, and purchase activity
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            {customers.length} Profiles Registered
          </span>

          <button
            onClick={() => setShowAdd(v => !v)}
            className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
            <span>+ Add Customer</span>
          </button>
        </div>
      </div>

      {/* ── 4 Modern KPI Glass Stat Cards ── */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Registered */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Customers</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-white tracking-tight">{kpiStats.totalCount}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full text-[11px]">
                Active Directory
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Wallets With Balance */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Wallets</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-emerald-400 tracking-tight">{kpiStats.walletsWithBalance}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px]">
                {kpiStats.totalCount > 0 ? Math.round((kpiStats.walletsWithBalance / kpiStats.totalCount) * 100) : 0}% with balance
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Outstanding Balance */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Wallet Pool</span>
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
              <Coins size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(kpiStats.totalOutstandingBalance)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">Pending rewards liability</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Lifetime Purchases */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Store Volume</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(kpiStats.totalLifetimePurchases)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-emerald-400 text-[11px] font-semibold">Accumulated POS sales</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Customer Drawer / Card ── */}
      {showAdd && (
        <div className="relative z-10 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-6 shadow-2xl animate-fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-cyan-400" />
              <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                Register New Customer Profile
              </h2>
            </div>
            <button
              onClick={() => setShowAdd(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Customer Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Mobile Number (10 Digits)</label>
              <input
                type="tel"
                value={newMobile}
                onChange={e => setNewMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white font-mono placeholder-slate-500 transition-colors"
                placeholder="10-digit number"
                maxLength={10}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAddCustomer}
                disabled={adding}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {adding ? 'Saving…' : 'Register Customer'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div className="relative z-10 flex gap-2">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by customer name or mobile number…"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 backdrop-blur-xl border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
          />
        </form>
        <button
          onClick={handleSearch}
          className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); fetchCustomers() }}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Customers Glass Table ── */}
      <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Mobile</th>
                <th className="px-5 py-4">Total Purchases</th>
                <th className="px-5 py-4">Cashback Earned</th>
                <th className="px-5 py-4">Cashback Used</th>
                <th className="px-5 py-4">Wallet Balance</th>
                <th className="px-5 py-4">Registered</th>
                <th className="px-5 py-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex justify-center items-center gap-2">
                      <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      Loading customers…
                    </div>
                  </td>
                </tr>
              )}

              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 text-sm">
                    No active customers found.{' '}
                    <button onClick={() => setShowAdd(true)} className="text-cyan-400 hover:underline font-semibold ml-1">
                      Register your first customer.
                    </button>
                  </td>
                </tr>
              )}

              {customers.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {c.name[0]?.toUpperCase() || 'C'}
                      </div>
                      <span className="font-bold text-white text-sm">
                        {c.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-cyan-300 text-sm">{c.mobile}</td>
                  <td className="px-5 py-4 font-bold text-white">
                    {formatCurrency(c.total_purchases)}
                  </td>
                  <td className="px-5 py-4 font-semibold text-emerald-400">
                    +{formatCurrency(c.cashback_earned)}
                  </td>
                  <td className="px-5 py-4 font-semibold text-amber-400">
                    {c.cashback_redeemed > 0 ? `− ${formatCurrency(c.cashback_redeemed)}` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-black text-sm ${c.cashback_balance > 0 ? 'text-cyan-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.3)]' : 'text-slate-500'}`}>
                      {formatCurrency(c.cashback_balance)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {format(new Date(c.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-5 py-4 text-right pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                        title="View Ledger & Pass"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                        title="Edit details"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingCustomer(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete customer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Edit Customer Details</h3>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Customer Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 focus:border-cyan-400 rounded-xl text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Mobile Number</label>
              <input
                type="tel"
                value={editMobile}
                onChange={e => setEditMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 focus:border-cyan-400 rounded-xl text-sm text-white font-mono"
                maxLength={10}
              />
            </div>
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400 border-b border-rose-500/20 pb-3">
              <AlertTriangle size={20} />
              <h3 className="text-base font-bold text-white">Delete Customer Profile</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong>{deletingCustomer.name}</strong> ({deletingCustomer.mobile})?
              Their rewards wallet balance of <strong>{formatCurrency(deletingCustomer.cashback_balance)}</strong> will be ceased.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 transition-all disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
