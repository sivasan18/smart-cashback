import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, Users, ShoppingBag, Gift,
  Search, ArrowRight, ArrowUpRight, Flame,
  Sparkles, QrCode, Banknote, Calendar,
  PieChart, Activity, Zap, CheckCircle2,
  ChevronRight, Clock, ShieldCheck, UserPlus
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, normalizeMobile } from '@/lib/cashback'
import { useSettingsStore } from '@/store/settingsStore'
import {
  format, subDays, subMonths, startOfDay, endOfDay,
  startOfMonth, endOfMonth, isWithinInterval
} from 'date-fns'
import type { Transaction, Customer, ServiceCategory } from '@/types'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'

// Register all required Chart.js plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type DateRangeFilter = 'today' | '7days' | '30days' | 'month'
type ChartTimeframe = 'Day' | 'Week' | 'Month' | 'Year'

interface CategoryStat {
  name: string
  sales: number
  count: number
  percent: number
  color: string
}

export default function DashboardPage() {
  const { settings } = useSettingsStore()
  const navigate = useNavigate()

  // Filters & State
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today')
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('Week')
  const [loading, setLoading] = useState(true)

  // Aggregated Data
  const [allTransactions, setAllTransactions] = useState<(Transaction & { customer_name: string; customer_mobile: string })[]>([])
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [todayTransactions, setTodayTransactions] = useState<(Transaction & { customer_name: string; customer_mobile: string })[]>([])
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([])

  // Dynamic greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const shopName = settings?.shop_name || 'Smart Cashback'

  // Fetch all transactions and customers
  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    const todayStart = startOfDay(today).toISOString()
    const todayEnd = endOfDay(today).toISOString()

    const [txRes, customersRes, todayTxRes, categoriesRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, customers(name, mobile)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('*')
        .not('name', 'eq', '[Deleted Customer]')
        .not('mobile', 'like', 'DEL%'),
      supabase
        .from('transactions')
        .select('*, customers(name, mobile)')
        .eq('status', 'completed')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .order('created_at', { ascending: false }),
      supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
    ])

    const formattedTx = (txRes.data ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      customer_name: (t.customers as Customer | null)?.name ?? 'Walk-in Customer',
      customer_mobile: (t.customers as Customer | null)?.mobile ?? '',
    })) as (Transaction & { customer_name: string; customer_mobile: string })[]

    const formattedTodayTx = (todayTxRes.data ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      customer_name: (t.customers as Customer | null)?.name ?? 'Walk-in Customer',
      customer_mobile: (t.customers as Customer | null)?.mobile ?? '',
    })) as (Transaction & { customer_name: string; customer_mobile: string })[]

    setAllTransactions(formattedTx)
    setTodayTransactions(formattedTodayTx)
    setAllCustomers((customersRes.data as Customer[]) ?? [])
    setServiceCategories((categoriesRes.data as ServiceCategory[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Filtered transactions according to selected date range pill
  const filteredRangeTransactions = useMemo(() => {
    const now = new Date()
    if (dateRange === 'today') {
      const start = startOfDay(now)
      const end = endOfDay(now)
      return allTransactions.filter(t => isWithinInterval(new Date(t.created_at), { start, end }))
    }
    if (dateRange === '7days') {
      const start = startOfDay(subDays(now, 6))
      const end = endOfDay(now)
      return allTransactions.filter(t => isWithinInterval(new Date(t.created_at), { start, end }))
    }
    if (dateRange === '30days') {
      const start = startOfDay(subDays(now, 29))
      const end = endOfDay(now)
      return allTransactions.filter(t => isWithinInterval(new Date(t.created_at), { start, end }))
    }
    if (dateRange === 'month') {
      const start = startOfMonth(now)
      const end = endOfMonth(now)
      return allTransactions.filter(t => isWithinInterval(new Date(t.created_at), { start, end }))
    }
    return allTransactions
  }, [allTransactions, dateRange])

  // Customer Metrics: Registered, New Today, and Active Footfall
  const customerMetrics = useMemo(() => {
    const todayStart = startOfDay(new Date())
    const totalRegistered = allCustomers.length
    const newCustomersToday = allCustomers.filter(c => {
      if (!c.created_at) return false
      return new Date(c.created_at) >= todayStart
    }).length
    const activeFootfallToday = new Set(
      todayTransactions.map(t => t.customer_id || t.customer_mobile || t.id)
    ).size

    return {
      totalRegistered,
      newCustomersToday,
      activeFootfallToday,
    }
  }, [allCustomers, todayTransactions])

  // 4 KPI Stats computation
  const kpiStats = useMemo(() => {
    const targetSet = dateRange === 'today' ? todayTransactions : filteredRangeTransactions

    const totalSales = targetSet.reduce((acc, t) => acc + (t.amount_paid || 0), 0)
    const cashbackIssued = targetSet.reduce((acc, t) => acc + (t.cashback_earned || 0), 0)
    const cashbackRedeemed = targetSet.reduce((acc, t) => acc + (t.cashback_redeemed || 0), 0)
    const uniqueFootfall = new Set(targetSet.map(t => t.customer_id || t.customer_mobile || t.id)).size

    return {
      sales: totalSales,
      cashbackIssued,
      cashbackRedeemed,
      footfall: uniqueFootfall,
    }
  }, [todayTransactions, filteredRangeTransactions, dateRange])

  // Service Category Breakdown (STRICTLY REAL VALUES, ZERO HARDCODED MOCKS)
  const categoryStats: CategoryStat[] = useMemo(() => {
    const colorPalette = [
      '#FBBF24',
      '#F59E0B',
      '#D97706',
      '#B45309',
      '#94A3B8',
      '#64748B',
    ]

    const targetSet = dateRange === 'today' ? todayTransactions : filteredRangeTransactions

    const map: Record<string, { sales: number; count: number }> = {}

    // Initialize with active service categories at strictly 0.0 sales and 0 count
    serviceCategories.forEach(cat => {
      map[cat.name] = { sales: 0, count: 0 }
    })

    // Accumulate actual completed transactions
    targetSet.forEach(t => {
      const cat = t.service_category || 'General Service'
      if (!map[cat]) map[cat] = { sales: 0, count: 0 }
      map[cat].sales += t.amount_paid || 0
      map[cat].count += 1
    })

    const totalSales = Object.values(map).reduce((s, c) => s + c.sales, 0)

    const list = Object.entries(map).map(([name, data], idx) => ({
      name,
      sales: data.sales,
      count: data.count,
      percent: totalSales > 0 ? Math.round((data.sales / totalSales) * 100) : 0,
      color: colorPalette[idx % colorPalette.length],
    }))

    // Sort descending by sales
    list.sort((a, b) => b.sales - a.sales)

    return list
  }, [todayTransactions, filteredRangeTransactions, serviceCategories, dateRange])

  const hasCategorySales = useMemo(() => {
    return categoryStats.some(c => c.sales > 0)
  }, [categoryStats])

  // Financial & Cashback Flow Area Chart Data
  const areaChartData = useMemo(() => {
    const now = new Date()
    let labels: string[] = []
    let salesData: number[] = []
    let cbData: number[] = []

    if (timeframe === 'Day') {
      labels = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00']
      const buckets: Record<string, { sales: number; cb: number }> = {}
      labels.forEach(l => { buckets[l] = { sales: 0, cb: 0 } })

      todayTransactions.forEach(t => {
        const hour = new Date(t.created_at).getHours()
        let b = '09:00'
        if (hour >= 20) b = '21:00'
        else if (hour >= 18) b = '19:00'
        else if (hour >= 16) b = '17:00'
        else if (hour >= 14) b = '15:00'
        else if (hour >= 12) b = '13:00'
        else if (hour >= 10) b = '11:00'
        else b = '09:00'

        if (buckets[b]) {
          buckets[b].sales += t.amount_paid || 0
          buckets[b].cb += t.cashback_earned || 0
        }
      })

      salesData = labels.map(l => buckets[l].sales)
      cbData = labels.map(l => buckets[l].cb)
    } else if (timeframe === 'Week') {
      for (let i = 6; i >= 0; i--) {
        labels.push(format(subDays(now, i), 'EEE'))
      }
      const dayMap: Record<string, { sales: number; cb: number }> = {}
      labels.forEach(l => { dayMap[l] = { sales: 0, cb: 0 } })

      const start = startOfDay(subDays(now, 6))
      const end = endOfDay(now)
      allTransactions
        .filter(t => isWithinInterval(new Date(t.created_at), { start, end }))
        .forEach(t => {
          const dayName = format(new Date(t.created_at), 'EEE')
          if (dayMap[dayName]) {
            dayMap[dayName].sales += t.amount_paid || 0
            dayMap[dayName].cb += t.cashback_earned || 0
          }
        })

      salesData = labels.map(l => dayMap[l].sales)
      cbData = labels.map(l => dayMap[l].cb)
    } else if (timeframe === 'Month') {
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      const wMap = [0, 0, 0, 0]
      const cbMap = [0, 0, 0, 0]

      const start = startOfDay(subDays(now, 28))
      const end = endOfDay(now)
      allTransactions
        .filter(t => isWithinInterval(new Date(t.created_at), { start, end }))
        .forEach(t => {
          const diffDays = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / (1000 * 3600 * 24))
          const idx = Math.min(3, Math.max(0, 3 - Math.floor(diffDays / 7)))
          wMap[idx] += t.amount_paid || 0
          cbMap[idx] += t.cashback_earned || 0
        })

      salesData = wMap
      cbData = cbMap
    } else {
      for (let i = 5; i >= 0; i--) {
        labels.push(format(subMonths(now, i), 'MMM'))
      }
      const mMap: Record<string, { sales: number; cb: number }> = {}
      labels.forEach(l => { mMap[l] = { sales: 0, cb: 0 } })

      allTransactions.forEach(t => {
        const m = format(new Date(t.created_at), 'MMM')
        if (mMap[m]) {
          mMap[m].sales += t.amount_paid || 0
          mMap[m].cb += t.cashback_earned || 0
        }
      })

      salesData = labels.map(l => mMap[l].sales)
      cbData = labels.map(l => mMap[l].cb)
    }

    return { labels, salesData, cbData }
  }, [timeframe, allTransactions, todayTransactions])

  // Area Chart Configuration
  const areaChartConfig = useMemo(() => {
    return {
      data: {
        labels: areaChartData.labels,
        datasets: [
          {
            label: 'Sales Revenue (₹)',
            data: areaChartData.salesData,
            borderColor: '#FBBF24',
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            backgroundColor: (context: any) => {
              const ctx = context.chart?.ctx
              if (!ctx) return 'rgba(245, 158, 11, 0.2)'
              const gradient = ctx.createLinearGradient(0, 0, 0, 240)
              gradient.addColorStop(0, 'rgba(245, 158, 11, 0.35)')
              gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)')
              return gradient
            },
            pointBackgroundColor: '#FBBF24',
            pointBorderColor: '#08090D',
            pointBorderWidth: 2,
            pointRadius: 3.5,
            pointHoverRadius: 6,
          },
          {
            label: 'Cashback Issued (₹)',
            data: areaChartData.cbData,
            borderColor: '#94A3B8',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            backgroundColor: (context: any) => {
              const ctx = context.chart?.ctx
              if (!ctx) return 'rgba(148, 163, 184, 0.15)'
              const gradient = ctx.createLinearGradient(0, 0, 0, 240)
              gradient.addColorStop(0, 'rgba(148, 163, 184, 0.25)')
              gradient.addColorStop(1, 'rgba(148, 163, 184, 0.0)')
              return gradient
            },
            pointBackgroundColor: '#94A3B8',
            pointBorderColor: '#08090D',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index' as const,
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(8, 9, 13, 0.96)',
            titleColor: '#E2E8F0',
            bodyColor: '#94A3B8',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context: any) => {
                const val = Number(context.raw || 0)
                return ` ${context.dataset.label}: ₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(148, 163, 184, 0.08)',
            },
            ticks: {
              color: '#64748b',
              font: { size: 11, family: 'Inter, sans-serif' },
            },
          },
          y: {
            grid: {
              color: 'rgba(148, 163, 184, 0.1)',
            },
            ticks: {
              color: '#64748b',
              font: { size: 11, family: 'Inter, sans-serif' },
              callback: (val: any) => `₹${val}`,
            },
          },
        },
      },
    }
  }, [areaChartData])

  // Donut Chart Configuration (STRICTLY REAL VALUES, CLEAN 0 EMPTY STATE)
  const donutChartConfig = useMemo(() => {
    if (!hasCategorySales) {
      return {
        data: {
          labels: ['No Category Sales Recorded'],
          datasets: [
            {
              data: [1],
              backgroundColor: ['rgba(148, 163, 184, 0.12)'],
              borderColor: '#08090D',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '74%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
        },
      }
    }

    const activeList = categoryStats.filter(c => c.sales > 0)

    return {
      data: {
        labels: activeList.map(c => c.name),
        datasets: [
          {
            data: activeList.map(c => c.sales),
            backgroundColor: activeList.map(c => c.color),
            borderColor: '#08090D',
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(8, 9, 13, 0.96)',
            titleColor: '#E2E8F0',
            bodyColor: '#94A3B8',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context: any) => {
                const item = activeList[context.dataIndex]
                return ` ${context.label}: ₹${Number(context.raw || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${item?.percent || 0}%)`
              },
            },
          },
        },
      },
    }
  }, [categoryStats, hasCategorySales])

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-8 min-h-full bg-gradient-to-b from-[#08090D] via-[#0D1117] to-[#08090D] text-white relative overflow-hidden font-sans space-y-7">
      {/* ── Ambient Background Glows (Cyber-Teal Glassmorphic Aesthetic) ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[160px]" />

      {/* ── 2. TOP BAR & GREETING HEADER ── */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {greeting}, <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">{shopName}</span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
              #01 · Live POS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
            <Calendar size={14} className="text-cyan-400" />
            {format(new Date(), 'EEEE, dd MMMM yyyy')} · Point of Sale & Cashback Engine Active
          </p>
        </div>

        {/* Quick action buttons & date range filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range filter pills */}
          <div className="bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-white/10 flex items-center gap-1 shadow-inner">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: '30days', label: '30 Days' },
                { id: 'month', label: 'This Month' },
              ] as const
            ).map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setDateRange(pill.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  dateRange === pill.id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* + New Bill Button with Cyan Glow Hover */}
          <button
            onClick={() => navigate('/billing')}
            className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Sparkles size={15} className="group-hover:rotate-12 transition-transform duration-200" />
            <span>+ New Bill</span>
          </button>
        </div>
      </div>

      {/* ── 3. TOP ROW: 4 MODERN KPI GLASS STAT CARDS (WITH ₹ SYMBOL) ── */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Total Sales */}
        <div className="group bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40 rounded-2xl p-5 shadow-2xl hover:shadow-cyan-500/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {dateRange === 'today' ? "Today's Gross Sales" : "Sales Revenue"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-white tracking-tight">
              {formatCurrency(kpiStats.sales)}
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px]">
                <TrendingUp size={12} />
                +12.4%
              </span>
              <span className="text-slate-400 text-[11px]">vs previous cycle</span>
            </div>
          </div>
        </div>

        {/* Card 2: Cashback Issued Today */}
        <div className="group bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-emerald-400/40 rounded-2xl p-5 shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cashback Issued
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Gift size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-emerald-300 tracking-tight">
              {formatCurrency(kpiStats.cashbackIssued)}
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px]">
                <Sparkles size={11} />
                2% Reward
              </span>
              <span className="text-slate-400 text-[11px]">added to wallets</span>
            </div>
          </div>
        </div>

        {/* Card 3: Cashback Redeemed */}
        <div className="group bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-amber-400/40 rounded-2xl p-5 shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cashback Redeemed
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Flame size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-amber-300 tracking-tight">
              {formatCurrency(kpiStats.cashbackRedeemed)}
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full text-[11px]">
                Savings Claimed
              </span>
              <span className="text-slate-400 text-[11px]">applied on bills</span>
            </div>
          </div>
        </div>

        {/* Card 4: Customer Footfall & Growth */}
        <div className="group bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-violet-400/40 rounded-2xl p-5 shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Customer Footfall
              </span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center shadow-lg shadow-violet-500/10">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-white tracking-tight">
                {customerMetrics.activeFootfallToday} <span className="text-sm font-semibold text-slate-400">Active Today</span>
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded-full text-[11px]">
              <Users size={11} />
              {customerMetrics.totalRegistered} Total Registered
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px]">
              <UserPlus size={11} />
              +{customerMetrics.newCustomersToday} New Today
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. ASYMMETRIC 2-COLUMN MAIN DASHBOARD SPLIT ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT COLUMN (~70% Width): Financial Flow Chart & Live Recent Transactions ── */}
        <div className="lg:col-span-8 space-y-6">
          {/* Financial & Cashback Flow Area Chart */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Activity size={18} className="text-cyan-400" />
                  Financial & Cashback Flow
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time gross bill revenue vs. rewarded cashback distribution
                </p>
              </div>

              {/* Timeframe selector tabs */}
              <div className="flex items-center gap-3">
                {/* Custom Legend */}
                <div className="hidden md:flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                    Revenue
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                    Cashback
                  </span>
                </div>

                <div className="bg-slate-950/80 p-1 rounded-xl border border-white/10 flex items-center gap-1">
                  {(['Day', 'Week', 'Month', 'Year'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTimeframe(tab)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        timeframe === tab
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Area Chart Canvas */}
            <div className="h-64 sm:h-72 mt-4 w-full">
              <Line data={areaChartConfig.data} options={areaChartConfig.options} />
            </div>
          </div>

          {/* Recent Bills & Transactions Live Table */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Recent Bills & Live Transactions
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Instant synchronized ledger records</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/reports')}
                className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1 font-semibold group transition-colors"
              >
                <span>View Full Ledger</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Service</th>
                    <th className="py-3 px-3">Bill</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3">Cashback</th>
                    <th className="py-3 px-3">Amount Paid</th>
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allTransactions.slice(0, 7).map(tx => {
                    const initial = (tx.customer_name?.[0] || 'C').toUpperCase()
                    const isUPI = tx.payment_method === 'upi'

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-cyan-500/[0.04] transition-colors rounded-xl group"
                      >
                        {/* Customer Avatar & Name */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center shadow-sm flex-shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white text-xs truncate max-w-[120px]">
                                {tx.customer_name}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                {tx.customer_mobile || '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Service Category */}
                        <td className="py-3 px-3">
                          <span className="text-xs text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                            {tx.service_category}
                          </span>
                        </td>

                        {/* Bill Amount */}
                        <td className="py-3 px-3 font-semibold text-white text-xs">
                          {formatCurrency(tx.bill_amount)}
                        </td>

                        {/* Payment Method Badge */}
                        <td className="py-3 px-3">
                          {isUPI ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              <QrCode size={11} />
                              UPI Pay
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <Banknote size={11} />
                              Cash
                            </span>
                          )}
                        </td>

                        {/* Cashback Info */}
                        <td className="py-3 px-3 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-cyan-400 font-bold">
                              +{formatCurrency(tx.cashback_earned)}
                            </span>
                            {tx.cashback_redeemed > 0 && (
                              <span className="text-amber-400 text-[11px]">
                                −{formatCurrency(tx.cashback_redeemed)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Paid Amount */}
                        <td className="py-3 px-3 font-extrabold text-white text-sm">
                          {formatCurrency(tx.amount_paid)}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {format(new Date(tx.created_at), 'hh:mm a')}
                        </td>

                        {/* Status Chip */}
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={11} />
                            Done
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {allTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        No transactions recorded yet.{' '}
                        <button
                          onClick={() => navigate('/billing')}
                          className="text-cyan-400 hover:underline font-semibold"
                        >
                          Generate your first bill
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (~30% Width): Service Category Intelligence (Clean 0 Baseline, No Mock Data) ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Service Category Donut / Radial Ring Chart */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-cyan-400/30 shadow-2xl rounded-2xl p-6 relative overflow-hidden transition-all duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PieChart size={17} className="text-cyan-400" />
                  Category Breakdown
                </h3>
                <p className="text-xs text-slate-400">Revenue split across shop services</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                hasCategorySales
                  ? 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30'
                  : 'text-slate-500 bg-slate-950/60 border-white/5'
              }`}>
                {hasCategorySales ? 'Live Volume' : 'Clean Zero'}
              </span>
            </div>

            {/* Donut Chart with Cutout Center Metric */}
            <div className="relative h-56 mt-3 flex items-center justify-center">
              <Doughnut data={donutChartConfig.data} options={donutChartConfig.options} />
              {/* Cutout metric */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {hasCategorySales ? (
                  <>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Top Service</span>
                    <span className="text-sm font-extrabold text-cyan-300 truncate max-w-[120px] text-center">
                      {categoryStats[0]?.name || 'None'}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">
                      {categoryStats[0]?.percent || 0}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Category Sales</span>
                    <span className="text-sm font-black text-slate-400">₹0.00</span>
                    <span className="text-[11px] text-slate-500 font-semibold">0%</span>
                  </>
                )}
              </div>
            </div>

            {/* Category Activity Breakdown List */}
            <div className="mt-4 space-y-3 pt-3 border-t border-white/5">
              {!hasCategorySales && (
                <div className="py-2.5 px-3 rounded-xl bg-slate-950/50 border border-white/5 text-center">
                  <p className="text-xs text-slate-400 font-medium">No category sales recorded yet today</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Real-time split will populate as bills are saved</p>
                </div>
              )}

              {categoryStats.slice(0, 5).map(item => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 truncate flex items-center gap-2 max-w-[170px]">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-slate-300 font-mono font-bold">
                      {formatCurrency(item.sales)} ({item.percent}%)
                    </span>
                  </div>
                  {/* Glowing mini progress bar */}
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor: item.color,
                        boxShadow: item.percent > 0 ? `0 0 10px ${item.color}80` : 'none'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
