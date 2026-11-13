/* ─────────────────────────────────────────────
   Smart Cashback – Shared TypeScript Types
   ───────────────────────────────────────────── */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Database row shapes (mirrors Supabase tables) ───────────────────────────

export interface Customer {
  id: string
  name: string
  mobile: string
  total_purchases: number
  cashback_earned: number
  cashback_redeemed: number
  cashback_balance: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  customer_id: string
  customer_name?: string
  customer_mobile?: string
  service_category: string
  bill_amount: number
  cashback_redeemed: number
  amount_paid: number
  cashback_earned: number
  payment_method?: 'cash' | 'upi' | string
  status: 'completed' | 'cancelled' | 'reversed'
  notes?: string
  created_at: string
  updated_at: string
}

export interface CashbackLedger {
  id: string
  customer_id: string
  transaction_id?: string
  credit: number
  debit: number
  balance_after: number
  description: string
  created_at: string
}

export interface ServiceCategory {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface ShopSettings {
  id: string
  shop_name: string
  shop_address: string
  contact_number: string
  cashback_percentage: number
  minimum_eligible_purchase: number
  currency: string
  date_format: string
  time_format: string
  merchant_upi_id?: string
  merchant_display_name?: string
  qr_payment_method?: 'standard_upi' | 'payment_gateway'
  payment_expiry_seconds?: number
  display_timeout_seconds?: number
  customer_display_enabled?: boolean
  updated_at: string
}

// ─── UI / Form types ──────────────────────────────────────────────────────────

export interface BillingFormData {
  mobile: string
  customerName: string
  serviceCategory: string
  billAmount: string
  cashbackToRedeem: string
  notes: string
}

export interface BillingCalculation {
  billAmount: number
  cashbackAvailable: number
  cashbackToRedeem: number
  amountPaid: number
  cashbackEarned: number
  newBalance: number
}

export interface DashboardStats {
  todaySales: number
  totalCustomers: number
  todayNewCustomers: number
  totalCashbackIssued: number
  totalCashbackRedeemed: number
  outstandingCashback: number
}

export interface DateRange {
  from: Date
  to: Date
}

export interface ReportRow {
  date: string
  customerName: string
  customerMobile: string
  serviceCategory: string
  billAmount: number
  cashbackRedeemed: number
  amountPaid: number
  cashbackEarned: number
  status: string
}

// ─── Automated Reporting & Email Types ───────────────────────────────────────

export interface ReportSettings {
  id: string
  recipient_email: string
  is_email_verified: boolean
  verification_code?: string | null
  verification_sent_at?: string | null
  weekly_enabled: boolean
  weekly_day_of_week: number // 0 = Sunday
  weekly_time: string // HH:mm (24-hour)
  monthly_enabled: boolean
  monthly_day_of_month: number
  monthly_time: string // HH:mm (24-hour)
  timezone: string
  last_report_at?: string | null
  last_report_status?: 'success' | 'failed' | null
  last_report_error?: string | null
  created_at: string
  updated_at: string
}

export interface ReportHistory {
  id: string
  report_type: 'weekly' | 'monthly' | 'manual' | 'custom' | 'test'
  period_label: string
  period_start?: string | null
  period_end?: string | null
  recipient_email: string
  status: 'success' | 'failed' | 'processing'
  resend_message_id?: string | null
  total_customers: number
  total_transactions: number
  total_sales_amount: number
  initiated_by: string
  error_message?: string | null
  file_name?: string | null
  created_at: string
}

// ─── Notification stub (future SMS) ──────────────────────────────────────────

export type NotificationEvent =
  | 'cashback_earned'
  | 'cashback_redeemed'
  | 'balance_inquiry'
  | 'monthly_summary'
  | 'promotional'

export interface NotificationPayload {
  event: NotificationEvent
  customerId: string
  customerName: string
  mobile: string
  data: Record<string, string | number>
}
