import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, Wallet, Gift, ShoppingBag, XCircle, User, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/cashback'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { Customer, Transaction, CashbackLedger } from '@/types'
import DigitalCashbackPass3D from '@/components/common/DigitalCashbackPass3D'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [ledger, setLedger] = useState<CashbackLedger[]>([])
  const [tab, setTab] = useState<'transactions' | 'ledger'>('transactions')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [custRes, txRes, ledgerRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('transactions').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('cashback_ledger').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    ])
    setCustomer(custRes.data as Customer)
    setTransactions((txRes.data as Transaction[]) ?? [])
    setLedger((ledgerRes.data as CashbackLedger[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCancelTx = async (tx: Transaction) => {
    if (tx.status !== 'completed') return
    if (!confirm('Cancel this transaction? A reversal entry will be created.')) return

    const { error } = await supabase.rpc('cancel_transaction', { p_transaction_id: tx.id })
    if (error) {
      toast.error('Failed to cancel: ' + error.message)
      return
    }
    toast.success('Transaction cancelled and cashback reversed')
    fetchData()
  }

  if (loading) {
    return (
      <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#0b171d] via-[#0d1d24] to-[#071116] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#0b171d] via-[#0d1d24] to-[#071116] text-white text-center py-20">
        <p className="text-slate-400">Customer not found.</p>
        <button onClick={() => navigate('/customers')} className="text-cyan-400 hover:underline font-semibold mt-2 inline-block">
          Return to Customers
        </button>
      </div>
    )
  }

  const stats = [
    { label: 'Total Purchases', value: formatCurrency(customer.total_purchases), icon: ShoppingBag, color: 'text-white' },
    { label: 'Cashback Earned', value: formatCurrency(customer.cashback_earned), icon: Gift, color: 'text-emerald-400' },
    { label: 'Cashback Used', value: formatCurrency(customer.cashback_redeemed), icon: Receipt, color: 'text-amber-400' },
    { label: 'Available Balance', value: formatCurrency(customer.cashback_balance), icon: Wallet, color: 'text-cyan-300' },
  ]

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#0b171d] via-[#0d1d24] to-[#071116] text-white relative overflow-hidden font-sans space-y-7">
      {/* ── Ambient Background Glows ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[160px]" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/customers')}
              className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white flex items-center justify-center transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{customer.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-cyan-300">{customer.mobile}</span> · Registered {format(new Date(customer.created_at), 'dd MMMM yyyy')}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
            <ShieldCheck size={13} /> VIP Profile
          </span>
        </div>

        {/* 3D VIP Digital Cashback Pass */}
        <div className="py-2 flex justify-center">
          <DigitalCashbackPass3D
            customerName={customer.name}
            mobile={customer.mobile}
            balance={customer.cashback_balance}
            lifetimeEarned={customer.cashback_earned}
            shopName="Smart Cashback POS"
          />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
              <Icon size={18} className={`${color} mb-1`} />
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
              <p className={`text-xl font-black ${color} mt-1`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setTab('transactions')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              tab === 'transactions'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setTab('ledger')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              tab === 'ledger'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            Cashback Ledger
          </button>
        </div>

        {/* Transactions table */}
        {tab === 'transactions' && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Service</th>
                    <th className="px-5 py-3">Bill Amount</th>
                    <th className="px-5 py-3">Redeemed</th>
                    <th className="px-5 py-3">Paid</th>
                    <th className="px-5 py-3">Cashback</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400 text-sm">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3 text-xs font-mono text-slate-400">
                          {format(new Date(tx.created_at), 'dd MMM yyyy, hh:mm a')}
                        </td>
                        <td className="px-5 py-3 font-semibold text-white">{tx.service_category}</td>
                        <td className="px-5 py-3 font-medium text-slate-200">{formatCurrency(tx.bill_amount)}</td>
                        <td className="px-5 py-3 text-amber-400 font-semibold">
                          {tx.cashback_redeemed > 0 ? `−${formatCurrency(tx.cashback_redeemed)}` : '—'}
                        </td>
                        <td className="px-5 py-3 font-bold text-white">{formatCurrency(tx.amount_paid)}</td>
                        <td className="px-5 py-3 font-bold text-emerald-400">+{formatCurrency(tx.cashback_earned)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            tx.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right pr-6">
                          {tx.status === 'completed' && (
                            <button
                              onClick={() => handleCancelTx(tx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Cancel transaction"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ledger table */}
        {tab === 'ledger' && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Credit</th>
                    <th className="px-5 py-3">Debit</th>
                    <th className="px-5 py-3 text-right pr-6">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                        No ledger entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    ledger.map(entry => (
                      <tr key={entry.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3 text-xs font-mono text-slate-400">
                          {format(new Date(entry.created_at), 'dd MMM yyyy, hh:mm a')}
                        </td>
                        <td className="px-5 py-3 text-slate-300 font-medium">{entry.description}</td>
                        <td className="px-5 py-3 font-bold text-emerald-400">
                          {entry.credit > 0 ? `+${formatCurrency(entry.credit)}` : '—'}
                        </td>
                        <td className="px-5 py-3 font-bold text-rose-400">
                          {entry.debit > 0 ? `−${formatCurrency(entry.debit)}` : '—'}
                        </td>
                        <td className="px-5 py-3 font-black text-cyan-300 text-right pr-6">
                          {formatCurrency(entry.balance_after)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
