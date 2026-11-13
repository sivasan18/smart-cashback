import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Download, BarChart3, Filter, Calendar, TrendingUp, Sparkles, Receipt,
  Wallet, Coins, Mail, FileSpreadsheet, Send, History, CheckCircle2,
  XCircle, Clock, RefreshCw, ShieldCheck, AlertCircle, X, ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/cashback'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import toast from 'react-hot-toast'
import type { Transaction, ReportSettings, ReportHistory } from '@/types'
import { downloadExcelReport, sendServerReport, type BuildWorkbookParams } from '@/lib/excelReport'
import { Link } from 'react-router-dom'

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom' | 'cashback_issued' | 'cashback_redeemed' | 'outstanding'

interface ReportRow extends Transaction {
  customer_name: string
  customer_mobile: string
}

type ModalPeriodType = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'today' | 'custom' | 'all_time'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('daily')
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  // Automated Reporting / Email State
  const [showSendModal, setShowSendModal] = useState(false)
  const [modalPeriodType, setModalPeriodType] = useState<ModalPeriodType>('this_week')
  const [customStart, setCustomStart] = useState(format(subWeeks(new Date(), 1), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [confirmedSend, setConfirmedSend] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [exportingLocalExcel, setExportingLocalExcel] = useState(false)
  const [reportSettings, setReportSettings] = useState<ReportSettings | null>(null)
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [lastSendStatus, setLastSendStatus] = useState<{
    success: boolean
    message: string
    messageId?: string
  } | null>(null)

  // Fetch Report Settings & History
  const fetchReportSettings = useCallback(async () => {
    const { data } = await supabase.from('report_settings').select('*').limit(1).maybeSingle()
    if (data) {
      setReportSettings(data as ReportSettings)
    }
  }, [])

  const fetchReportHistory = useCallback(async () => {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('report_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) {
      setReportHistory(data as ReportHistory[])
    }
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    fetchReportSettings()
    fetchReportHistory()
  }, [fetchReportSettings, fetchReportHistory])

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

  const totals = useMemo(() => {
    const sales = rows.reduce((s, r) => s + (r.amount_paid || 0), 0)
    const grossBills = rows.reduce((s, r) => s + (r.bill_amount || 0), 0)
    const cashbackIssued = rows.reduce((s, r) => s + (r.cashback_earned || 0), 0)
    const cashbackRedeemed = rows.reduce((s, r) => s + (r.cashback_redeemed || 0), 0)
    return { sales, grossBills, cashbackIssued, cashbackRedeemed }
  }, [rows])

  // ─────────────────────────────────────────────────────────────
  // 1. EXPORT CSV
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // 2. EXPORT EXCEL WORKBOOK (.xlsx) DIRECTLY IN BROWSER
  // ─────────────────────────────────────────────────────────────
  const exportExcelWorkbook = async () => {
    setExportingLocalExcel(true)
    try {
      const [from, to] = getDateRange()
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_report_data', {
        p_start_date: from,
        p_end_date: to,
      })

      let customersData = rpcData?.customers || []
      let txsData = rpcData?.transactions || []
      let summaryData = rpcData?.summary || {}

      if (rpcErr || !rpcData) {
        // Fallback: fetch customers and transactions directly
        const { data: custs } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
        customersData = custs || []

        const { data: txs } = await supabase
          .from('transactions')
          .select('*, customers(name, mobile)')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at', { ascending: false })

        txsData = (txs || []).map((t: any) => ({
          ...t,
          customer_name: t.customers?.name || 'Unknown',
          customer_mobile: t.customers?.mobile || '',
        }))

        const completed = txsData.filter((t: any) => t.status === 'completed')
        const totalSales = completed.reduce((sum: number, t: any) => sum + Number(t.amount_paid || 0), 0)
        const totalGross = completed.reduce((sum: number, t: any) => sum + Number(t.bill_amount || 0), 0)
        const earned = completed.reduce((sum: number, t: any) => sum + Number(t.cashback_earned || 0), 0)
        const redeemed = completed.reduce((sum: number, t: any) => sum + Number(t.cashback_redeemed || 0), 0)

        summaryData = {
          total_completed_sales: totalSales,
          total_gross_bill: totalGross,
          completed_tx_count: completed.length,
          average_bill_value: completed.length > 0 ? Math.round((totalGross / completed.length) * 100) / 100 : 0,
          total_cashback_earned: earned,
          total_cashback_redeemed: redeemed,
          cancelled_tx_count: txsData.filter((t: any) => t.status === 'cancelled').length,
          pending_tx_count: 0,
        }
      }

      const periodLabel = `${format(new Date(from), 'dd MMM yyyy')} to ${format(new Date(to), 'dd MMM yyyy')}`

      downloadExcelReport(`Smart-Cashback-Report-${format(new Date(), 'yyyy-MM-dd')}`, {
        periodLabel,
        customers: customersData,
        transactions: txsData,
        summary: {
          totalCompletedSales: summaryData.total_completed_sales || 0,
          completedTxCount: summaryData.completed_tx_count || 0,
          averageBillValue: summaryData.average_bill_value || 0,
          totalCashbackEarned: summaryData.total_cashback_earned || 0,
          totalCashbackRedeemed: summaryData.total_cashback_redeemed || 0,
          cancelledTxCount: summaryData.cancelled_tx_count || 0,
          pendingTxCount: summaryData.pending_tx_count || 0,
          totalGrossBill: summaryData.total_gross_bill || 0,
        },
      })

      toast.success('Excel workbook downloaded successfully! (2 worksheets)')
    } catch (err: any) {
      toast.error('Failed to export Excel report: ' + (err.message || 'Unknown error'))
    } finally {
      setExportingLocalExcel(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. SEND REPORT VIA EMAIL (MODAL ACTION)
  // ─────────────────────────────────────────────────────────────
  const getModalDateBounds = (): { start: string; end: string; label: string; type: 'weekly' | 'monthly' | 'manual' | 'custom' } => {
    const now = new Date()
    switch (modalPeriodType) {
      case 'this_week': {
        const s = startOfWeek(now, { weekStartsOn: 1 })
        const e = endOfWeek(now, { weekStartsOn: 1 })
        return {
          start: s.toISOString(),
          end: e.toISOString(),
          label: `This Week (${format(s, 'dd MMM')} – ${format(e, 'dd MMM yyyy')})`,
          type: 'weekly',
        }
      }
      case 'last_week': {
        const prev = subWeeks(now, 1)
        const s = startOfWeek(prev, { weekStartsOn: 1 })
        const e = endOfWeek(prev, { weekStartsOn: 1 })
        return {
          start: s.toISOString(),
          end: e.toISOString(),
          label: `Last Week (${format(s, 'dd MMM')} – ${format(e, 'dd MMM yyyy')})`,
          type: 'weekly',
        }
      }
      case 'this_month': {
        const s = startOfMonth(now)
        const e = endOfMonth(now)
        return {
          start: s.toISOString(),
          end: e.toISOString(),
          label: `This Month (${format(s, 'MMMM yyyy')})`,
          type: 'monthly',
        }
      }
      case 'last_month': {
        const prev = subMonths(now, 1)
        const s = startOfMonth(prev)
        const e = endOfMonth(prev)
        return {
          start: s.toISOString(),
          end: e.toISOString(),
          label: `Last Month (${format(s, 'MMMM yyyy')})`,
          type: 'monthly',
        }
      }
      case 'today': {
        const s = startOfDay(now)
        const e = endOfDay(now)
        return {
          start: s.toISOString(),
          end: e.toISOString(),
          label: `Today (${format(now, 'dd MMM yyyy')})`,
          type: 'manual',
        }
      }
      case 'all_time': {
        return {
          start: new Date('2020-01-01T00:00:00.000Z').toISOString(),
          end: now.toISOString(),
          label: 'Complete Historical (All-Time)',
          type: 'manual',
        }
      }
      case 'custom':
      default: {
        const [fy, fm, fd] = customStart.split('-').map(Number)
        const [ty, tm, td] = customEnd.split('-').map(Number)
        const s = new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString()
        const e = new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString()
        return {
          start: s,
          end: e,
          label: `Custom Period (${customStart} to ${customEnd})`,
          type: 'custom',
        }
      }
    }
  }

  const handleSendReportViaEmail = async () => {
    if (!reportSettings?.recipient_email) {
      toast.error('Please configure a recipient email in Settings before dispatching reports')
      return
    }
    if (!confirmedSend) {
      toast.error('Please confirm the delivery checkbox before sending')
      return
    }

    setSendingReport(true)
    setLastSendStatus(null)

    const { start, end, label, type } = getModalDateBounds()

    try {
      const result = await sendServerReport({
        reportType: type,
        startDate: start,
        endDate: end,
        periodLabel: label,
        recipientEmail: reportSettings.recipient_email,
      })

      setLastSendStatus({
        success: true,
        message: `Report successfully dispatched to ${reportSettings.recipient_email}!`,
        messageId: result?.messageId || result?.resendMessageId,
      })
      toast.success('Report dispatched successfully to ' + reportSettings.recipient_email)
      fetchReportHistory()
      fetchReportSettings()
    } catch (err: any) {
      const errMsg = err.message || 'Failed to dispatch report via Resend'
      setLastSendStatus({
        success: false,
        message: errMsg,
      })
      toast.error('Dispatch failed: ' + errMsg)
      fetchReportHistory()
    } finally {
      setSendingReport(false)
    }
  }

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
    <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#08090D] via-[#0D1117] to-[#08090D] text-white relative overflow-hidden font-sans space-y-7">
      {/* ── Ambient Background Glows ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[160px]" />

      {/* ── Top Bar Header ── */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Audit Reports & Analytics
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Financial statements, automated Excel report dispatches, and loyalty ledgers
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Send Excel Report Button (Admin Delivery Modal) */}
          <button
            onClick={() => {
              setConfirmedSend(false)
              setLastSendStatus(null)
              setShowSendModal(true)
            }}
            className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 shadow-lg shadow-amber-500/25 hover:shadow-amber-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Mail size={15} />
            <span>Send Excel Report</span>
          </button>

          {/* Download Excel (.xlsx) directly */}
          <button
            onClick={exportExcelWorkbook}
            disabled={exportingLocalExcel}
            className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            <FileSpreadsheet size={15} />
            <span>{exportingLocalExcel ? 'Generating…' : 'Export Excel (.xlsx)'}</span>
          </button>

          {rows.length > 0 && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-white/10 hover:border-white/20 transition-all"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Glass Card ── */}
      <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/30 rounded-2xl p-6 shadow-2xl transition-all duration-300 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Select Timeframe & Filter Criteria
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {format(new Date(), 'dd MMM yyyy')}
          </span>
        </div>

        {/* Timeframe Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setReportType(value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                reportType === value
                  ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
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
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3.5 py-2 bg-slate-950 border border-white/10 focus:border-cyan-400 rounded-xl text-xs text-white"
                max={toDate}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3.5 py-2 bg-slate-950 border border-white/10 focus:border-cyan-400 rounded-xl text-xs text-white"
                min={fromDate}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-start">
          <button
            onClick={runReport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> Generating…
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
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sales Paid</span>
            <p className="text-3xl font-black text-white mt-2">{formatCurrency(totals.sales)}</p>
            <p className="text-[11px] text-cyan-300 mt-1">Gross bills: {formatCurrency(totals.grossBills)}</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cashback Issued</span>
            <p className="text-3xl font-black text-emerald-400 mt-2">+{formatCurrency(totals.cashbackIssued)}</p>
            <p className="text-[11px] text-emerald-400/80 mt-1">Loyalty rewards distributed</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cashback Redeemed</span>
            <p className="text-3xl font-black text-amber-400 mt-2">−{formatCurrency(totals.cashbackRedeemed)}</p>
            <p className="text-[11px] text-amber-400/80 mt-1">Customer wallet redemptions</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transactions Run</span>
            <p className="text-3xl font-black text-cyan-300 mt-2">{rows.length}</p>
            <p className="text-[11px] text-slate-400 mt-1">Completed records in range</p>
          </div>
        </div>
      )}

      {/* ── Results Glass Table ── */}
      {hasRun && !loading && (
        <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                    <td colSpan={9} className="text-center py-16 text-slate-400 text-sm">
                      No completed transactions recorded for this selected timeframe.
                    </td>
                  </tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                        {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-5 py-4 font-bold text-white">{r.customer_name}</td>
                      <td className="px-5 py-4 font-mono text-cyan-300">{r.customer_mobile}</td>
                      <td className="px-5 py-4 text-slate-300">{r.service_category}</td>
                      <td className="px-5 py-4 font-medium text-slate-200">{formatCurrency(r.bill_amount)}</td>
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

      {/* ── REPORT HISTORY & AUDIT LOG TABLE ── */}
      <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <History size={18} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Automated & Manual Report Delivery History
            </h2>
          </div>
          <button
            onClick={() => fetchReportHistory()}
            disabled={loadingHistory}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors p-1"
            title="Refresh history"
          >
            <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Dispatched At (IST)</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reporting Period</th>
                <th className="px-4 py-3">Recipient Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Records Included</th>
                <th className="px-4 py-3">Initiated By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                    No report dispatches recorded yet. Use the <strong className="text-amber-300">"Send Excel Report"</strong> button to trigger your first delivery.
                  </td>
                </tr>
              ) : (
                reportHistory.map(h => (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors text-xs">
                    <td className="px-4 py-3 text-slate-400 font-mono">
                      {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        h.report_type === 'weekly' ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' :
                        h.report_type === 'monthly' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' :
                        'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {h.report_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{h.period_label}</td>
                    <td className="px-4 py-3 font-mono text-cyan-300">{h.recipient_email}</td>
                    <td className="px-4 py-3">
                      {h.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> Delivered
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full cursor-help"
                          title={h.error_message || 'Delivery failed'}
                        >
                          <XCircle size={12} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {h.total_customers} cust · {h.total_transactions} txs
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono truncate max-w-[140px]">
                      {h.initiated_by}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: SEND EXCEL REPORT VIA RESEND ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              onClick={() => setShowSendModal(false)}
              className="absolute top-5 right-5 p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30">
                <Sparkles size={13} />
                <span>On-Demand Excel Report Dispatch</span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Send Excel Report via Email
              </h2>
              <p className="text-xs text-slate-400">
                Dispatches a verified two-sheet workbook (Customer Master & Sales Ledger) as an attachment using Resend.
              </p>
            </div>

            {/* Recipient Details & Verification Status */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Configured Recipient
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono font-bold text-cyan-300">
                  {reportSettings?.recipient_email || 'No email configured'}
                </span>
                {reportSettings?.recipient_email ? (
                  reportSettings.is_email_verified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <ShieldCheck size={13} /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                      <AlertCircle size={13} /> Unverified
                    </span>
                  )
                ) : (
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                  >
                    Configure in Settings <ExternalLink size={12} />
                  </Link>
                )}
              </div>
              {!reportSettings?.recipient_email && (
                <p className="text-[11px] text-rose-400 pt-1">
                  Recipient email is required before sending reports. Please set it in the Settings page.
                </p>
              )}
            </div>

            {/* Timeframe Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Reporting Period
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'this_week', label: 'This Week' },
                  { id: 'last_week', label: 'Last Week' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'today', label: 'Today' },
                  { id: 'all_time', label: 'All-Time' },
                  { id: 'custom', label: 'Custom Range' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setModalPeriodType(p.id as ModalPeriodType)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      modalPeriodType === p.id
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                        : 'bg-slate-950/60 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Range Inputs */}
              {modalPeriodType === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">Start Date</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 focus:border-amber-400 rounded-xl text-xs text-white"
                      max={customEnd}
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">End Date</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 focus:border-amber-400 rounded-xl text-xs text-white"
                      min={customStart}
                      max={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Workbook Contents Summary Note */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">Attachment Structure:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-[11px]">
                <li><strong className="text-slate-200">Customer Details:</strong> All customer balances, lifetime spending, and reward stats</li>
                <li><strong className="text-slate-200">Sales and Transactions:</strong> Filtered transactions with top Executive Summary KPI block</li>
              </ul>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-white/10 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedSend}
                onChange={e => setConfirmedSend(e.target.checked)}
                className="mt-0.5 rounded border-white/20 text-amber-500 focus:ring-amber-400"
              />
              <span className="text-xs text-slate-300">
                Confirm sending this Excel workbook to <strong className="text-white font-mono">{reportSettings?.recipient_email || 'configured recipient'}</strong>.
              </span>
            </label>

            {/* Real Delivery Status Banner */}
            {lastSendStatus && (
              <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                lastSendStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {lastSendStatus.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <span>{lastSendStatus.success ? 'Dispatch Succeeded' : 'Dispatch Failed'}</span>
                </div>
                <p className="text-[11px] leading-relaxed">{lastSendStatus.message}</p>
                {lastSendStatus.messageId && (
                  <p className="font-mono text-[10px] text-emerald-400/80">Message ID: {lastSendStatus.messageId}</p>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                disabled={sendingReport}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendReportViaEmail}
                disabled={sendingReport || !confirmedSend || !reportSettings?.recipient_email}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 shadow-lg shadow-amber-500/25 hover:shadow-amber-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {sendingReport ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Sending via Resend…</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Send Report Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
