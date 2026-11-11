import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Settings, Save, Plus, Trash2, GripVertical, KeyRound,
  AlertOctagon, AlertTriangle, ShieldCheck, Lock, CheckCircle2, X,
  QrCode, Monitor, Store, CreditCard, Sparkles, RefreshCw, Search,
  Edit2, Check
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { ServiceCategory } from '@/types'

export default function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore()
  const { user } = useAuthStore()

  // Form State
  const [form, setForm] = useState({
    shop_name: '',
    shop_address: '',
    contact_number: '',
    cashback_percentage: 2,
    minimum_eligible_purchase: 99,
    currency: 'INR',
    date_format: 'DD/MM/YYYY',
    time_format: '12h',
    merchant_upi_id: '7708481818@upi',
    merchant_display_name: 'Smart Cashback',
    qr_payment_method: 'standard_upi' as 'standard_upi' | 'payment_gateway',
    payment_expiry_seconds: 300,
    display_timeout_seconds: 5,
    customer_display_enabled: true,
  })

  // Categories & Search State
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [categorySearch, setCategorySearch] = useState('')
  const [newCat, setNewCat] = useState('')
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')

  // Saving states
  const [savingRules, setSavingRules] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [pwdForm, setPwdForm] = useState({ currentPwd: '', newPwd: '', confirmPwd: '' })
  const [changingPwd, setChangingPwd] = useState(false)

  // Danger Zone: Reset Customer Data (Multi-step modal)
  const [showDangerModal, setShowDangerModal] = useState(false)
  const [dangerStep, setDangerStep] = useState<1 | 2 | 3 | 4>(1)
  const [typedPhrase, setTypedPhrase] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authChecking, setAuthChecking] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)

  // Danger Zone: Clear Test Transactions utility modal
  const [showClearTestModal, setShowClearTestModal] = useState(false)
  const [clearingTestData, setClearingTestData] = useState(false)

  const REQUIRED_PHRASE = 'DELETE ALL CUSTOMER DATA'

  useEffect(() => {
    if (settings) {
      setForm({
        shop_name: settings.shop_name || '',
        shop_address: settings.shop_address || '',
        contact_number: settings.contact_number || '',
        cashback_percentage: settings.cashback_percentage ?? 2,
        minimum_eligible_purchase: settings.minimum_eligible_purchase ?? 99,
        currency: settings.currency || 'INR',
        date_format: settings.date_format || 'DD/MM/YYYY',
        time_format: settings.time_format || '12h',
        merchant_upi_id: settings.merchant_upi_id || '7708481818@upi',
        merchant_display_name: settings.merchant_display_name || settings.shop_name || 'Smart Cashback',
        qr_payment_method: settings.qr_payment_method || 'standard_upi',
        payment_expiry_seconds: settings.payment_expiry_seconds || 300,
        display_timeout_seconds: settings.display_timeout_seconds || 5,
        customer_display_enabled: settings.customer_display_enabled !== false,
      })
    }
  }, [settings])

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('service_categories').select('*').order('sort_order')
    setCategories((data as ServiceCategory[]) ?? [])
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories
    const q = categorySearch.toLowerCase().trim()
    return categories.filter(c => c.name.toLowerCase().includes(q))
  }, [categories, categorySearch])

  // Save Shop Rules & Info
  const handleSaveShopRules = async () => {
    if (!form.shop_name.trim()) {
      toast.error('Shop name is required')
      return
    }
    if (form.cashback_percentage < 0 || form.cashback_percentage > 100) {
      toast.error('Cashback % must be between 0 and 100')
      return
    }
    if (form.minimum_eligible_purchase < 0) {
      toast.error('Minimum purchase must be positive')
      return
    }

    setSavingRules(true)
    await updateSettings(form)
    setSavingRules(false)
    toast.success('Shop Information & Rules saved successfully')
  }

  // Save UPI & Customer Display Settings
  const handleSavePaymentSettings = async () => {
    if (!form.merchant_upi_id.trim()) {
      toast.error('Merchant UPI ID is required')
      return
    }

    setSavingPayment(true)
    await updateSettings(form)
    setSavingPayment(false)
    toast.success('UPI & Display Controls saved successfully')
  }

  // Categories CRUD
  const handleAddCategory = async () => {
    if (!newCat.trim()) return
    const sortOrder = categories.length
    const { error } = await supabase.from('service_categories').insert({
      name: newCat.trim(),
      is_active: true,
      sort_order: sortOrder,
    })
    if (error) {
      toast.error('Failed to add category: ' + error.message)
      return
    }
    toast.success('Category added')
    setNewCat('')
    fetchCategories()
  }

  const handleToggleCategory = async (cat: ServiceCategory) => {
    await supabase.from('service_categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    fetchCategories()
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? This will not affect existing transactions.')) return
    await supabase.from('service_categories').delete().eq('id', id)
    fetchCategories()
    toast.success('Category removed')
  }

  const handleStartEditCategory = (cat: ServiceCategory) => {
    setEditingCatId(cat.id)
    setEditingCatName(cat.name)
  }

  const handleSaveCategoryName = async (id: string) => {
    if (!editingCatName.trim()) return
    await supabase.from('service_categories').update({ name: editingCatName.trim() }).eq('id', id)
    setEditingCatId(null)
    setEditingCatName('')
    fetchCategories()
    toast.success('Category name updated')
  }

  // Update Password
  const handleChangePassword = async () => {
    if (!pwdForm.newPwd) {
      toast.error('Enter a new password')
      return
    }
    if (pwdForm.newPwd !== pwdForm.confirmPwd) {
      toast.error('Passwords do not match')
      return
    }
    if (pwdForm.newPwd.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setChangingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwdForm.newPwd })
    setChangingPwd(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Password updated successfully')
    setPwdForm({ currentPwd: '', newPwd: '', confirmPwd: '' })
  }

  // ─────────────────────────────────────────────────────────────
  // DANGER UTILITY 1: CLEAR TEST TRANSACTIONS & RESET METRICS
  // ─────────────────────────────────────────────────────────────
  const handleClearTestTransactions = async () => {
    setClearingTestData(true)
    try {
      // 1. Try secure RPC first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('clear_test_transactions_and_metrics')

      if (!rpcErr && rpcData?.success) {
        toast.success('All test transactions cleared and customer metrics reset to 0.0!')
      } else {
        // 2. Client-side fallback: delete ledger, mark test txs cancelled, reset customer balances
        await supabase.from('cashback_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        const { data: txs } = await supabase.from('transactions').select('id')
        for (const t of txs || []) {
          await supabase.from('transactions').update({
            status: 'cancelled',
            notes: '[Test Transaction - Cleared for Live Launch]',
          }).eq('id', t.id)
        }

        await supabase.from('customers').update({
          total_purchases: 0.0,
          cashback_earned: 0.0,
          cashback_redeemed: 0.0,
          cashback_balance: 0.0,
        }).neq('id', '00000000-0000-0000-0000-000000000000')

        toast.success('Test transactions cleared & customer metrics cleanly reset to 0.0!')
      }

      setShowClearTestModal(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear test data')
    } finally {
      setClearingTestData(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DANGER UTILITY 2: RESET / PURGE ALL CUSTOMER DATA (4-STEP)
  // ─────────────────────────────────────────────────────────────
  const openDangerZone = () => {
    setDangerStep(1)
    setTypedPhrase('')
    setAdminPassword('')
    setShowDangerModal(true)
  }

  const closeDangerZone = () => {
    setShowDangerModal(false)
    setDangerStep(1)
    setTypedPhrase('')
    setAdminPassword('')
  }

  const handleVerifyPassword = async () => {
    if (!adminPassword) {
      toast.error('Please enter your administrator password')
      return
    }

    setAuthChecking(true)
    try {
      const email = user?.email || 'sivar75@gmail.com'
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: adminPassword,
      })

      if (error) {
        toast.error('Administrator authentication failed: incorrect password')
        setAuthChecking(false)
        return
      }

      setAuthChecking(false)
      setDangerStep(4)
    } catch {
      toast.error('Authentication verification error')
      setAuthChecking(false)
    }
  }

  const handleExecuteBulkDeletion = async () => {
    setIsDeletingAll(true)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_all_customers')

      if (!rpcErr) {
        toast.success('All customer data has been deleted and anonymized.')
      } else {
        await supabase.from('cashback_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        const { data: txs } = await supabase.from('transactions').select('customer_id')
        const referencedCustIds = new Set((txs || []).map(t => t.customer_id))
        const { data: allCusts } = await supabase.from('customers').select('id')

        for (const c of (allCusts || [])) {
          let deleted = false
          if (!referencedCustIds.has(c.id)) {
            const { data: delData } = await supabase.from('customers').delete().eq('id', c.id).select()
            if (delData && delData.length > 0) deleted = true
          }

          if (!deleted) {
            const anonymizedMobile = 'DEL' + c.id.replace(/-/g, '').slice(0, 7)
            await supabase.from('customers').update({
              name: '[Deleted Customer]',
              mobile: anonymizedMobile,
              cashback_balance: 0,
              cashback_earned: 0,
              cashback_redeemed: 0,
              total_purchases: 0,
              updated_at: new Date().toISOString(),
            }).eq('id', c.id)
          }
        }

        toast.success('All customer data has been deleted and anonymized.')
      }

      closeDangerZone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete customer data')
    } finally {
      setIsDeletingAll(false)
    }
  }

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#08090D] via-[#0D1117] to-[#08090D] text-white relative overflow-hidden font-sans space-y-7">
      {/* ── Ambient Background Glows (Cyber-Teal Glassmorphic V2) ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[160px]" />

      {/* ── Header Title & Subtitle ── */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Shop Settings & System Controls
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Configure store rules, UPI payment gateways, secondary display, and administrative security
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            Live Configuration
          </span>
        </div>
      </div>

      {/* ── ROW 1: CORE STORE & PAYMENT SETUP (BALANCED 2-COLUMN GRID) ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* LEFT CARD: Shop Information & Rules */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-6 shadow-2xl transition-all duration-300 relative flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Store size={18} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Shop Information & Rules
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                POS Identity
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Shop Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.shop_name}
                  onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
                  placeholder="e.g. Smart Xerox & Recharge"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Shop Address
                </label>
                <input
                  type="text"
                  value={form.shop_address}
                  onChange={e => setForm(f => ({ ...f, shop_address: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
                  placeholder="Full physical store address"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Shop Contact Number
                </label>
                <input
                  type="tel"
                  value={form.contact_number}
                  onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
                  placeholder="e.g. 7708481818"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Currency Symbol
                </label>
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white transition-colors"
                >
                  <option value="INR" className="bg-slate-900 text-white">INR (₹) – Indian Rupee</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Cashback Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.cashback_percentage}
                  onChange={e => setForm(f => ({ ...f, cashback_percentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white transition-colors font-semibold"
                />
                <p className="text-[11px] text-slate-400 mt-1">Default rate: {form.cashback_percentage}% on eligible bills</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Min. Eligible Purchase (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minimum_eligible_purchase}
                  onChange={e => setForm(f => ({ ...f, minimum_eligible_purchase: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white transition-colors font-semibold"
                />
                <p className="text-[11px] text-slate-400 mt-1">Threshold: ₹{form.minimum_eligible_purchase}+ for cashback</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSaveShopRules}
              disabled={savingRules}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Save size={15} />
              {savingRules ? 'Saving Rules…' : 'Save Shop Information'}
            </button>
          </div>
        </div>

        {/* RIGHT CARD: UPI Payment & Customer Display Controls */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-6 shadow-2xl transition-all duration-300 relative flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <QrCode size={18} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  UPI Payment & Customer Display Controls
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                NPCI / Dual Screen
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Merchant UPI ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.merchant_upi_id}
                  onChange={e => setForm(f => ({ ...f, merchant_upi_id: e.target.value.trim() }))}
                  placeholder="e.g. 7708481818@upi"
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-cyan-300 font-mono transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">Configured payee UPI VPA for customer QR payments</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Merchant Display Name
                </label>
                <input
                  type="text"
                  value={form.merchant_display_name}
                  onChange={e => setForm(f => ({ ...f, merchant_display_name: e.target.value }))}
                  placeholder="e.g. Smart Cashback Shop"
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">Displayed in customer UPI apps and QR request</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  QR Payment Method
                </label>
                <select
                  value={form.qr_payment_method}
                  onChange={e => setForm(f => ({ ...f, qr_payment_method: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white transition-colors"
                >
                  <option value="standard_upi" className="bg-slate-900 text-white">Standard NPCI UPI QR (Direct to Bank)</option>
                  <option value="payment_gateway" className="bg-slate-900 text-white">Payment Gateway (Webhook verified)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">NPCI standard dynamic deep link URI</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Payment QR Expiry Duration (Seconds)
                </label>
                <input
                  type="number"
                  min="60"
                  step="30"
                  value={form.payment_expiry_seconds}
                  onChange={e => setForm(f => ({ ...f, payment_expiry_seconds: parseInt(e.target.value) || 300 }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white font-mono transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">Validity window for dynamic QR codes (default: 300s)</p>
              </div>

              <div className="sm:col-span-2 pt-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Customer Display Auto-Reset Delay (Seconds)
                </label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  step="1"
                  value={form.display_timeout_seconds}
                  onChange={e => setForm(f => ({ ...f, display_timeout_seconds: parseInt(e.target.value) || 5 }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white font-mono transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Delay after transaction completion before returning to Welcome screen (default: 5s)
                </p>
              </div>

              {/* Customer Display Toggle */}
              <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                <div>
                  <label className="text-sm font-semibold text-white block">
                    Customer Display (Secondary Screen)
                  </label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Show or hide the secondary customer-facing display shortcut in the sidebar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.customer_display_enabled}
                  onClick={() => setForm(f => ({ ...f, customer_display_enabled: !f.customer_display_enabled }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    form.customer_display_enabled ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                      form.customer_display_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSavePaymentSettings}
              disabled={savingPayment}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Save size={15} />
              {savingPayment ? 'Saving Controls…' : 'Save Payment & Display Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 2: SERVICE CATEGORIES & PRODUCTS (FULL-WIDTH DEDICATED GLASS CARD) ── */}
      <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-6 shadow-2xl transition-all duration-300 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Service Categories & Products Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Organize shop billing categories, toggle active status, and maintain pricing catalogs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300">
              {categories.filter(c => c.is_active).length} Active Categories
            </span>
          </div>
        </div>

        {/* Search bar & Add category in a compact toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
              placeholder="Search existing categories…"
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
            />
          </div>

          <div className="md:col-span-6 flex gap-2">
            <input
              type="text"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              placeholder="Add new category (e.g. Spiral Binding)…"
              className="flex-1 px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <Plus size={16} />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Categories List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {filteredCategories.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 p-8 text-center bg-slate-950/40 rounded-xl border border-white/5">
              <p className="text-slate-400 text-sm">No service categories found matching &quot;{categorySearch}&quot;</p>
            </div>
          ) : (
            filteredCategories.map(cat => (
              <div
                key={cat.id}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-white/10 hover:border-cyan-400/30 transition-all duration-200 group"
              >
                <GripVertical size={14} className="text-slate-600 flex-shrink-0 cursor-grab" />

                <div className="flex-1 min-w-0">
                  {editingCatId === cat.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveCategoryName(cat.id)}
                        className="w-full px-2 py-1 bg-slate-900 border border-cyan-400 rounded text-xs text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveCategoryName(cat.id)}
                        className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${cat.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>
                        {cat.name}
                      </span>
                      <button
                        onClick={() => handleStartEditCategory(cat)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-cyan-300 p-0.5"
                        title="Edit category name"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      cat.is_active
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── ROW 3: SECURITY & DATA MANAGEMENT (BOTTOM ROW SPLIT) ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* LEFT CARD: Administrator Password / Account Security */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-6 shadow-2xl transition-all duration-300 relative flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <KeyRound size={18} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Administrator Password & Security
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                Auth Vault
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 border border-white/10 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-300">Signed In Administrator</p>
                <p className="text-xs text-cyan-300 font-mono mt-0.5">{user?.email || 'sivar75@gmail.com'}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <ShieldCheck size={12} /> Verified Admin
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={pwdForm.newPwd}
                  onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
                  placeholder="Min. 8 characters"
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={pwdForm.confirmPwd}
                  onChange={e => setPwdForm(f => ({ ...f, confirmPwd: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl text-sm text-white placeholder-slate-500 transition-colors"
                  placeholder="Repeat new password"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Passphrase must be at least 8 characters. Your session will remain securely active upon updating.
            </p>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPwd}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <KeyRound size={15} />
              {changingPwd ? 'Updating…' : 'Update Administrator Password'}
            </button>
          </div>
        </div>

        {/* RIGHT CARD: Danger Zone & Customer Management */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/30 hover:border-rose-500/50 rounded-2xl p-6 shadow-2xl transition-all duration-300 relative flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <AlertOctagon size={18} className="text-rose-400" />
                <h2 className="text-sm font-bold text-rose-300 uppercase tracking-wider">
                  Danger Zone & Customer Data Management
                </h2>
              </div>
              <span className="text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                Critical Operations
              </span>
            </div>

            <p className="text-xs text-rose-200/80 leading-relaxed">
              Permanent maintenance actions for this store. These utilities allow clearing test data prior to live deployment or purging customer account databases.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Utility 1: Clear Test Transactions & Reset Metrics */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-rose-500/20 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <RefreshCw size={13} className="text-cyan-400" /> Clear Test Transactions
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Reset ledger and wipe test bills to prepare store for real customer live billing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearTestModal(true)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all text-center"
                >
                  Clear Test Data
                </button>
              </div>

              {/* Utility 2: Reset Customer Data */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-rose-500/20 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Trash2 size={13} className="text-rose-400" /> Reset Customer Data
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Purge customer phone numbers, wallet balances, and user registrations with 4-step authentication.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openDangerZone}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider text-rose-300 bg-rose-950/60 border border-rose-500/30 hover:bg-rose-900/50 hover:border-rose-400 transition-all text-center"
                >
                  Purge Customers
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-rose-500/20 text-center">
            <span className="text-[11px] text-slate-500 font-mono">
              Shop configuration, service catalogs, and administrator logins are never deleted.
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: CLEAR TEST TRANSACTIONS CONFIRMATION
      ───────────────────────────────────────────────────────────── */}
      {showClearTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                <RefreshCw size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clear Test Transactions & Reset Metrics</h3>
                <p className="text-xs text-slate-400">Prepare system for live production</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-cyan-300">This utility will execute:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 font-mono text-[11px]">
                <li>DELETE all rows from transactions table</li>
                <li>DELETE all rows from cashback_ledger table</li>
                <li>Reset all customer total_purchases to 0.0</li>
                <li>Reset all customer cashback_balance to 0.0</li>
              </ul>
              <p className="text-slate-400 pt-1">
                Customer names and registered phone numbers are preserved so real customers can start fresh with zero balance.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearTestModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all"
                disabled={clearingTestData}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearTestTransactions}
                disabled={clearingTestData}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/25"
              >
                {clearingTestData ? 'Cleaning…' : 'Confirm & Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: MULTI-STEP DANGER ZONE (RESET CUSTOMER DATA)
      ───────────────────────────────────────────────────────────── */}
      {showDangerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-rose-500/40 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-rose-950/60 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={20} className="text-rose-400" />
                <h3 className="text-base font-bold text-rose-200">
                  Delete All Customer Data
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDangerZone}
                className="text-rose-400 hover:text-rose-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Step indicator */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>Step {dangerStep} of 4</span>
                <span className="text-rose-400">
                  {dangerStep === 1 && 'Impact Assessment'}
                  {dangerStep === 2 && 'Phrase Confirmation'}
                  {dangerStep === 3 && 'Admin Re-Authentication'}
                  {dangerStep === 4 && 'Final Authorization'}
                </span>
              </div>

              {/* STEP 1: WARNING & SCOPE */}
              {dangerStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 bg-rose-950/80 rounded-2xl border border-rose-500/40 text-xs text-rose-200 leading-relaxed font-medium">
                    ⚠️ <strong>WARNING:</strong> This action permanently purges all customer phone records, names, and cashback balances from the system.
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-white">What will be removed:</p>
                    <ul className="list-disc pl-5 text-slate-400 space-y-1">
                      <li>All customer names, mobile numbers, and records</li>
                      <li>All customer wallet balances and cashback accounts</li>
                      <li>Customer cashback reward ledger entries</li>
                    </ul>

                    <p className="font-semibold text-white pt-2">What is strictly preserved:</p>
                    <ul className="list-disc pl-5 text-cyan-300 space-y-1">
                      <li>Administrator credentials & login access</li>
                      <li>Shop settings & cashback rules</li>
                      <li>Service categories & POS configurations</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button type="button" onClick={closeDangerZone} className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setDangerStep(2)}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all"
                    >
                      I Understand, Proceed →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: REQUIRED PHRASE MATCH */}
              {dangerStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-sm text-slate-300">
                    To prevent accidental deletion, please type the following confirmation phrase in uppercase:
                  </p>

                  <div className="p-3 bg-slate-950 rounded-xl font-mono text-center font-bold text-rose-400 text-sm tracking-wider select-all border border-rose-500/30">
                    {REQUIRED_PHRASE}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={typedPhrase}
                      onChange={e => setTypedPhrase(e.target.value)}
                      placeholder="Type confirmation phrase here"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 focus:border-rose-400 rounded-xl font-mono text-sm tracking-wider text-white"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setDangerStep(1)} className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all">
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={typedPhrase !== REQUIRED_PHRASE}
                      onClick={() => setDangerStep(3)}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-all"
                    >
                      Verify Phrase →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: ADMINISTRATOR RE-AUTHENTICATION */}
              {dangerStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Lock size={16} className="text-cyan-400" />
                    Administrator Re-Authentication
                  </div>
                  <p className="text-xs text-slate-400">
                    Confirm your administrator password for <strong>{user?.email || 'sivar75@gmail.com'}</strong> to proceed.
                  </p>

                  <div>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Administrator Password"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 focus:border-cyan-400 rounded-xl text-sm text-white"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleVerifyPassword()}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setDangerStep(2)} className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all">
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!adminPassword || authChecking}
                      onClick={handleVerifyPassword}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 disabled:opacity-50 transition-all"
                    >
                      {authChecking ? 'Verifying…' : 'Authenticate →'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: FINAL EXECUTION */}
              {dangerStep === 4 && (
                <div className="space-y-4 animate-fade-in text-center">
                  <div className="w-16 h-16 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                    <ShieldCheck size={36} />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white">
                      Final Authorization
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Administrator identity verified. Click below to permanently purge all customer data from the database.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={closeDangerZone}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all"
                      disabled={isDeletingAll}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteBulkDeletion}
                      disabled={isDeletingAll}
                      className="flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-all shadow-lg shadow-rose-600/30"
                    >
                      {isDeletingAll ? 'Executing Deletion…' : 'PURGE ALL CUSTOMER DATA NOW'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
