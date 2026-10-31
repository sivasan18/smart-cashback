/**
 * Cashback calculation utilities
 * All monetary operations use fixed 2-decimal precision.
 *
 * Business Rules:
 * - Minimum eligible purchase: configurable (default ₹99)
 * - Cashback rate: configurable (default 2%)
 * - Cashback is calculated on the amount AFTER redemption
 * - Cashback cannot exceed final payable amount
 * - Redemption cannot exceed available wallet balance
 */

export interface CashbackInput {
  billAmount: number
  cashbackToRedeem: number
  availableBalance: number
  cashbackPercentage: number   // e.g. 2 for 2%
  minimumEligiblePurchase: number
}

export interface CashbackResult {
  billAmount: number
  cashbackToRedeem: number
  amountPaid: number
  cashbackEarned: number
  newBalance: number
  isEligible: boolean
  error?: string
}

export function calculateCashback(input: CashbackInput): CashbackResult {
  const {
    billAmount,
    cashbackToRedeem,
    availableBalance,
    cashbackPercentage,
    minimumEligiblePurchase,
  } = input

  // Validate inputs
  if (billAmount <= 0) {
    return makeError(input, 'Bill amount must be greater than zero.')
  }
  if (cashbackToRedeem < 0) {
    return makeError(input, 'Redemption amount cannot be negative.')
  }
  if (cashbackToRedeem > availableBalance) {
    return makeError(input, 'Redemption exceeds available wallet balance.')
  }
  if (cashbackToRedeem > billAmount) {
    return makeError(input, 'Redemption cannot exceed the bill amount.')
  }

  const redeem = round2(Math.min(cashbackToRedeem, billAmount))
  const amountPaid = round2(billAmount - redeem)

  // Cashback is calculated on amountPaid (not on redeemed portion)
  const isEligible = billAmount >= minimumEligiblePurchase
  const cashbackEarned = isEligible
    ? round2(amountPaid * (cashbackPercentage / 100))
    : 0

  const newBalance = round2(availableBalance - redeem + cashbackEarned)

  return {
    billAmount: round2(billAmount),
    cashbackToRedeem: redeem,
    amountPaid,
    cashbackEarned,
    newBalance,
    isEligible,
  }
}

function makeError(input: CashbackInput, error: string): CashbackResult {
  return {
    billAmount: input.billAmount,
    cashbackToRedeem: 0,
    amountPaid: input.billAmount,
    cashbackEarned: 0,
    newBalance: input.availableBalance,
    isEligible: false,
    error,
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Format a number as Indian Rupee currency string.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Validate Indian mobile number (10 digits, starts with 6–9).
 * Handles +91, 91 prefix, spaces, dashes.
 */
export function validateMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/[\s\-().]/g, '')
  const normalized = cleaned.startsWith('+91')
    ? cleaned.slice(3)
    : cleaned.startsWith('91') && cleaned.length === 12
    ? cleaned.slice(2)
    : cleaned
  return /^[6-9]\d{9}$/.test(normalized)
}

/**
 * Normalize mobile to 10-digit format (strips country code).
 */
export function normalizeMobile(mobile: string): string {
  const cleaned = mobile.replace(/[\s\-().]/g, '')
  if (cleaned.startsWith('+91') && cleaned.length === 13) return cleaned.slice(3)
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2)
  return cleaned
}
