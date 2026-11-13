/**
 * Smart Cashback – Automated Excel Reporting & Delivery Service
 *
 * Implements server-side and client-side XLSX generation, date range calculations
 * for Asia/Kolkata (IST), and Edge Function communication via Resend.
 */

import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { Customer, Transaction, ReportSettings, ReportHistory } from '@/types'

export interface ReportSummaryStats {
  totalCompletedSales: number
  completedTxCount: number
  averageBillValue: number
  totalCashbackEarned: number
  totalCashbackRedeemed: number
  cancelledTxCount: number
  pendingTxCount: number
  totalGrossBill: number
}

export interface BuildWorkbookParams {
  periodLabel: string
  customers: Array<{
    id: string
    name: string
    mobile: string
    created_at: string
    cashback_balance: number
    purchase_count?: number
    total_purchases: number
    cashback_earned: number
    cashback_redeemed: number
    last_purchase_date?: string
    status?: string
  }>
  transactions: Array<{
    id: string
    created_at: string
    customer_name?: string
    customer_mobile?: string
    service_category: string
    bill_amount: number
    cashback_redeemed: number
    amount_paid: number
    payment_mode?: string
    cashback_earned: number
    status: string
  }>
  summary: ReportSummaryStats
}

/**
 * Builds the verified 2-worksheet Excel workbook:
 * - Sheet 1: Customer Details (All customers with 11 standard columns)
 * - Sheet 2: Sales and Transactions (Top Summary Block + Detailed Transaction rows)
 */
export function buildExcelWorkbook(params: BuildWorkbookParams): XLSX.WorkBook {
  const { periodLabel, customers, transactions, summary } = params
  const wb = XLSX.utils.book_new()

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: CUSTOMER DETAILS (All customers)
  // ─────────────────────────────────────────────────────────────
  const customerHeaders = [
    'Customer ID',
    'Customer Name',
    'Mobile Number',
    'Account Created Date',
    'Current Wallet Balance (₹)',
    'Total Purchase Count',
    'Lifetime Total Spending (₹)',
    'Lifetime Cashback Earned (₹)',
    'Lifetime Cashback Redeemed (₹)',
    'Last Purchase Date',
    'Customer Status',
  ]

  const customerRows = customers.map(c => [
    c.id,
    c.name,
    c.mobile,
    c.created_at ? new Date(c.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
    Number(c.cashback_balance || 0),
    Number(c.purchase_count ?? 0),
    Number(c.total_purchases || 0),
    Number(c.cashback_earned || 0),
    Number(c.cashback_redeemed || 0),
    c.last_purchase_date
      ? new Date(c.last_purchase_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      : 'No purchases',
    c.status || (c.cashback_balance > 0 ? 'Active' : 'Active'),
  ])

  const ws1Data = [customerHeaders, ...customerRows]
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)

  ws1['!cols'] = [
    { wch: 38 }, // Customer ID
    { wch: 22 }, // Customer Name
    { wch: 15 }, // Mobile Number
    { wch: 22 }, // Account Created Date
    { wch: 24 }, // Current Wallet Balance
    { wch: 20 }, // Total Purchase Count
    { wch: 26 }, // Lifetime Total Spending
    { wch: 26 }, // Lifetime Cashback Earned
    { wch: 28 }, // Lifetime Cashback Redeemed
    { wch: 22 }, // Last Purchase Date
    { wch: 16 }, // Customer Status
  ]

  ws1['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws1['!autofilter'] = { ref: `A1:K${Math.max(1, customerRows.length + 1)}` }
  XLSX.utils.book_append_sheet(wb, ws1, 'Customer Details')

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: SALES AND TRANSACTIONS (WITH SUMMARY AT TOP)
  // ─────────────────────────────────────────────────────────────
  const summaryBlock = [
    ['SMART CASHBACK — SALES & TRANSACTION AUDIT REPORT'],
    ['Reporting Period:', periodLabel],
    ['Generated At (IST):', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
    [''],
    ['KEY PERFORMANCE METRICS', 'VALUE'],
    ['Total Completed Sales (₹):', Number(summary.totalCompletedSales || 0)],
    ['Number of Completed Transactions:', Number(summary.completedTxCount || 0)],
    ['Average Bill Value (₹):', Number(summary.averageBillValue || 0)],
    ['Total Cashback Earned (₹):', Number(summary.totalCashbackEarned || 0)],
    ['Total Cashback Redeemed (₹):', Number(summary.totalCashbackRedeemed || 0)],
    ['Total Cancelled Transactions:', Number(summary.cancelledTxCount || 0)],
    ['Total Pending Transactions:', Number(summary.pendingTxCount || 0)],
    ['Total Gross Bill Amount (₹):', Number(summary.totalGrossBill || 0)],
    [''],
    ['DETAILED TRANSACTION LEDGER'],
  ]

  const txHeaders = [
    'Transaction ID',
    'Transaction Date',
    'Transaction Time',
    'Customer Name',
    'Customer Mobile Number',
    'Original Bill Amount (₹)',
    'Cashback Redeemed (₹)',
    'Final Payable Amount (₹)',
    'Payment Mode',
    'Cashback Earned (₹)',
    'Transaction Status',
    'Service Category',
  ]

  const txRows = transactions.map(t => {
    const d = t.created_at ? new Date(t.created_at) : new Date()
    const dateStr = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    const timeStr = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
    return [
      t.id,
      dateStr,
      timeStr,
      t.customer_name || 'Unknown',
      t.customer_mobile || '',
      Number(t.bill_amount || 0),
      Number(t.cashback_redeemed || 0),
      Number(t.amount_paid || 0),
      t.payment_mode || 'Cash',
      Number(t.cashback_earned || 0),
      t.status || 'completed',
      t.service_category || 'General',
    ]
  })

  const grandTotalRow = [
    'GRAND TOTALS',
    '',
    '',
    '',
    '',
    Number(summary.totalGrossBill || 0),
    Number(summary.totalCashbackRedeemed || 0),
    Number(summary.totalCompletedSales || 0),
    '',
    Number(summary.totalCashbackEarned || 0),
    `${transactions.length} Records`,
    '',
  ]

  const ws2Data = [...summaryBlock, txHeaders, ...txRows, grandTotalRow]
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)

  ws2['!cols'] = [
    { wch: 38 }, // Tx ID
    { wch: 16 }, // Date
    { wch: 14 }, // Time
    { wch: 22 }, // Customer Name
    { wch: 16 }, // Mobile
    { wch: 22 }, // Bill Amount
    { wch: 22 }, // Cashback Redeemed
    { wch: 22 }, // Amount Paid
    { wch: 16 }, // Mode
    { wch: 20 }, // Cashback Earned
    { wch: 18 }, // Status
    { wch: 24 }, // Category
  ]

  XLSX.utils.book_append_sheet(wb, ws2, 'Sales and Transactions')

  return wb
}

/**
 * Downloads the generated Excel workbook directly in browser.
 */
export function downloadExcelReport(filename: string, params: BuildWorkbookParams) {
  const wb = buildExcelWorkbook(params)
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/**
 * Trigger report generation and email dispatch via Supabase Edge Function 'send-report'.
 */
export async function sendServerReport(options: {
  reportType: 'weekly' | 'monthly' | 'manual' | 'custom' | 'test'
  startDate?: string
  endDate?: string
  recipientEmail?: string
  periodLabel?: string
}) {
  const { data, error } = await supabase.functions.invoke('send-report', {
    body: {
      action: 'send_report',
      report_type: options.reportType,
      start_date: options.startDate,
      end_date: options.endDate,
      recipient_email: options.recipientEmail,
      period_label: options.periodLabel,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to dispatch report via Edge Function')
  }

  return data
}

/**
 * Request email verification code.
 */
export async function requestEmailVerification(email: string) {
  const { data, error } = await supabase.functions.invoke('send-report', {
    body: {
      action: 'send_verification',
      recipient_email: email,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to send verification code')
  }

  return data
}

/**
 * Verify 6-digit confirmation code.
 */
export async function submitVerificationCode(code: string) {
  const { data, error } = await supabase.functions.invoke('send-report', {
    body: {
      action: 'verify_email',
      verification_code: code,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to verify code')
  }

  return data
}

