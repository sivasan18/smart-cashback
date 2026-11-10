import { useState, useCallback, useMemo } from 'react'
import { Download, BarChart3, Filter, Calendar, TrendingUp, Sparkles, Receipt, Wallet, Coins } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/cashback'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import type { Transaction } from '@/types'

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom' | 'cashback_issued' | 'cashback_redeemed' | 'outstanding'

interface ReportRow extends Transaction {
  customer_name: string
  customer_mobile: string
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('daily')
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  const getDateRange = useCallback((): [string, string] => {
    const now = new Date()
    switch (reportType) {
      case 'daily': return [startOfDay(now).toISOString(), endOfDay(now).toISOString()]
      case 'weekly': return [startOfWeek(now, { weekStartsOn: 1 }).toISOString(), endOfWeek(now, { weekStartsOn: 1 }).toISOString()]
      case 'monthly': return [startOfMonth(now).toISOString(), endOfMonth(now).toISOString()]
      case 'custom':
      case 'cashback_issued':
      case 'cashback_redeemed':
      case 'outstanding': {
        const [fy, fm, fd] = fromDate.split('-').map(Number)
        const [ty, tm, td] = toDate.split('-').map(Number)
        const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString()
        const end = new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString()
        return [start, end]
      }
    }
  }, [reportType, fromDate, toDate])

  const runReport = useCallback(async () => {
    setLoading(true)
    setHasRun(true)
    const [from, to] = getDateRange()

    let query = supabase
      .from('transactions')
      .select('*, customers(name, mobile)')
      .eq('status', 'completed')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })

    if (reportType === 'cashback_issued') {
      query = query.gt('cashback_earned', 0)
    } else if (reportType === 'cashback_redeemed') {
      query = query.gt('cashback_redeemed', 0)
    }

    const { data, error } = await query.limit(500)
    if (error) {
      toast.error('Failed to load report')
      setLoading(false)
      return
    }

    setRows(
      ((data ?? []) as Record<string, unknown>[]).map(t => ({
        ...t,
        customer_name: ((t.customers as { name: string } | null)?.name) ?? 'Unknown',
        customer_mobile: ((t.customers as { mobile: string } | null)?.mobile) ?? '',
      })) as ReportRow[]
    )
    setLoading(false)
  }, [getDateRange, reportType])

  const exportCSV = () => {
    if (rows.length === 0) {
      toast.error('No data to export')
      return
    }
    const headers = ['Date', 'Customer', 'Mobile', 'Service', 'Bill Amount', 'Cashback Redeemed', 'Amount Paid', 'Cashback Earned', 'Status']
    const csvRows = rows.map(r => [
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      r.customer_name,
      r.customer_mobile,
      r.service_category,
      r.bill_amount.toFixed(2),
      r.cashback_redeemed.toFixed(2),
      r.amount_paid.toFixed(2),
      r.cashback_earned.toFixed(2),
      r.status,
    ])
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smart-cashback-report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported as CSV')
  }

  const totals = useMemo(() => {
    const sales = rows.reduce((s, r) => s + (r.amount_paid || 0), 0)
    const grossBills = rows.reduce((s, r) => s + (r.bill_amount || 0), 0)
    const cashbackIssued = rows.reduce((s, r) => s + (r.cashback_earned || 0), 0)
    const cashbackRedeemed = rows.reduce((s, r) => s + (r.cashback_redeemed || 0), 0)
    return { sales, grossBills, cashbackIssued, cashbackRedeemed }
  }, [rows])

  const REPORT_TYPES: { value: ReportType; label: string }[] = [
    { value: 'daily', label: 'Today' },
    { value: 'weekly', label: 'This Week' },
    { value: 'monthly', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' },
    { value: 'cashback_issued', label: 'Cashback Issued' },
    { value: 'cashback_redeemed', label: 'Cashback Redeemed' },
    { value: 'outstanding', label: 'All Transactions' },
  ]

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#06080d] via-[#0b0f17] to-[#06080d] text-white relative overflow-hidden font-sans space-y-7">
      {/* ── Ambient Background Glows (Dark Luxury Golden Aesthetic) ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-amber-400/10 rounded-full blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-amber-400/5 rounded-full blur-[160px]" />

      {/* ── Top Bar Header ── */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Audit Reports & Analytics
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                Financial statements, cashback issuance ledgers, and transaction exports
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <button
              onClick={exportCSV}
              className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-neutral-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 shadow-lg shadow-amber-500/25 hover:shadow-amber-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Glass Card ── */}
      <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-amber-400/30 rounded-2xl p-6 shadow-2xl transition-all duration-300 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Select Timeframe & Filter Criteria
            </h2>
          </div>
          <span className="text-xs text-neutral-400 font-mono">
            {format(new Date(), 'dd MMM yyyy')}
          </span>
        </div>

        {/* Timeframe Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setReportType(value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                reportType === value
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm shadow-amber-500/30'
                  : 'bg-black/50 text-neutral-400 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {(reportType === 'custom' || reportType === 'cashback_issued' || reportType === 'cashback_redeemed' || reportType === 'outstanding') && (
          <div className="flex flex-wrap gap-4 items-end pt-2 border-t border-white/10">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3.5 py-2 bg-black/60 border border-white/10 focus:border-amber-400 rounded-xl text-xs text-white focus:outline-none"
                max={toDate}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3.5 py-2 bg-black/60 border border-white/10 focus:border-amber-400 rounded-xl text-xs text-white focus:outline-none"
                min={fromDate}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-start">
          <button
            onClick={runReport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-neutral-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 shadow-md shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" /> Generating…
              </span>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Run Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards (Triggered after run) ── */}
      {hasRun && !loading && (
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Total Sales Paid</span>
            <p className="text-3xl font-black text-white mt-2">{formatCurrency(totals.sales)}</p>
            <p className="text-[11px] text-amber-400 mt-1">Gross bills: {formatCurrency(totals.grossBills)}</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Cashback Issued</span>
            <p className="text-3xl font-black text-emerald-400 mt-2">+{formatCurrency(totals.cashbackIssued)}</p>
            <p className="text-[11px] text-emerald-400/80 mt-1">Loyalty rewards distributed</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Cashback Redeemed</span>
            <p className="text-3xl font-black text-amber-400 mt-2">−{formatCurrency(totals.cashbackRedeemed)}</p>
            <p className="text-[11px] text-amber-400/80 mt-1">Customer wallet redemptions</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Transactions Run</span>
            <p className="text-3xl font-black text-amber-300 mt-2">{rows.length}</p>
            <p className="text-[11px] text-neutral-400 mt-1">Completed records in range</p>
          </div>
        </div>
      )}

      {/* ── Results Glass Table ── */}
      {hasRun && !loading && (
        <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <th className="px-5 py-4">Date & Time</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Mobile</th>
                  <th className="px-5 py-4">Service</th>
                  <th className="px-5 py-4">Bill Amount</th>
                  <th className="px-5 py-4">Redeemed</th>
                  <th className="px-5 py-4">Amount Paid</th>
                  <th className="px-5 py-4">Cashback Earned</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-neutral-400 text-sm">
                      No completed transactions recorded for this selected timeframe.
                    </td>
                  </tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4 text-xs text-neutral-400 font-mono">
                        {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-5 py-4 font-bold text-white">{r.customer_name}</td>
                      <td className="px-5 py-4 font-mono text-amber-300">{r.customer_mobile}</td>
                      <td className="px-5 py-4 text-neutral-300">{r.service_category}</td>
                      <td className="px-5 py-4 font-medium text-neutral-200">{formatCurrency(r.bill_amount)}</td>
                      <td className="px-5 py-4 text-amber-400 font-medium">
                        {r.cashback_redeemed > 0 ? `− ${formatCurrency(r.cashback_redeemed)}` : '—'}
                      </td>
                      <td className="px-5 py-4 font-bold text-white">{formatCurrency(r.amount_paid)}</td>
                      <td className="px-5 py-4 font-bold text-emerald-400">+{formatCurrency(r.cashback_earned)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {r.status}
                        </span>
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
  )
    </div>
  )
}
