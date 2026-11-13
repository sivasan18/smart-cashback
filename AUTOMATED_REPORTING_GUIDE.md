# Smart Cashback — Automated Excel Reporting & Email System Guide

## Overview
This document explains the setup, architecture, and operational workflows for the automated sales and customer reporting system integrated into the Smart Cashback POS application.

---

## 1. Components Created & Modified

### Database Migration
- **[supabase/migrations/005_automated_reporting_system.sql](file:///Users/tsr/Downloads/Anti-Gravity/cashback%20website/supabase/migrations/005_automated_reporting_system.sql)**:
  - `report_settings`: Configuration table storing authorized recipient email, verification status, weekly/monthly delivery switches, day/time, and timezone (`Asia/Kolkata`).
  - `report_history`: Audit trail tracking every automated and manual report delivery (type, reporting period, recipient, status, Resend message ID, customer count, transaction count, errors).
  - `get_report_data`: High-performance read-only RPC aggregating customer master records, period transactions, and sales summary statistics in a single transaction.
  - Row-Level Security (RLS) policies restricting report settings and logs to authenticated administrators.

### Backend Edge Function
- **[supabase/functions/send-report/index.ts](file:///Users/tsr/Downloads/Anti-Gravity/cashback%20website/supabase/functions/send-report/index.ts)**:
  - TypeScript / Deno runtime function.
  - Handles actions: `send_report`, `send_verification`, `verify_email`.
  - Date range calculations in IST (`Asia/Kolkata`) for Weekly (Mon–Sun) and Monthly (1st to last day of previous month).
  - Generates the two-sheet Excel workbook in server memory (`xlsx`).
  - Dispatches emails with attached `.xlsx` files using the Resend API.
  - Records delivery status and message IDs in `report_history`.

### Frontend User Interface
- **[src/pages/ReportsPage.tsx](file:///Users/tsr/Downloads/Anti-Gravity/cashback%20website/src/pages/ReportsPage.tsx)**:
  - **"Send Excel Report"** button: Opens interactive dispatch modal with timeframe selection (This Week, Last Week, This Month, Last Month, Today, All-Time, Custom Range), recipient verification check, confirmation, real-time loading state, and actual API delivery feedback.
  - **"Export Excel (.xlsx)"** button: Client-side export allowing the administrator to download the exact 2-worksheet Excel workbook directly in the browser for offline inspection.
  - **"Automated & Manual Report Delivery History"**: Real-time audit log table tracking past report dispatches with status badges and record counts.
- **[src/pages/SettingsPage.tsx](file:///Users/tsr/Downloads/Anti-Gravity/cashback%20website/src/pages/SettingsPage.tsx)**:
  - Dedicated **"Automated Email Reports & Scheduling"** card.
  - Recipient email address input with inline **Verified / Unverified** badge and 6-digit OTP verification flow.
  - Toggle switches for **Weekly Automatic Report** (Sunday 9:00 PM IST) and **Monthly Automatic Report** (1st of month 9:00 AM IST).
  - Timezone display (`Asia/Kolkata`), last delivery timestamp, and status pill.
  - **"Send Test Email Report"** button for immediate verification.
  - Password change flow enhanced to re-verify current password before updating.
- **[src/lib/excelReport.ts](file:///Users/tsr/Downloads/Anti-Gravity/cashback%20website/src/lib/excelReport.ts)**:
  - Shared SheetJS generator for the two worksheets:
    - **Sheet 1: Customer Details** (11 columns).
    - **Sheet 2: Sales and Transactions** (Top Executive Summary Block + detailed transaction rows + grand totals).
- **[src/types/index.ts](file:///Users/tsr/Downloads/Anti-Gravity/cashback%20website/src/types/index.ts)**:
  - TypeScript interfaces for `ReportSettings` and `ReportHistory`.

---

## 2. Excel Workbook Structure

Every generated workbook contains two sheets:

### Sheet 1: "Customer Details"
Includes all registered customer accounts:
1. `Customer ID`
2. `Customer Name`
3. `Mobile Number`
4. `Account Created Date` (dd/MM/yyyy HH:mm IST)
5. `Current Wallet Balance (₹)`
6. `Total Purchase Count`
7. `Lifetime Total Spending (₹)`
8. `Lifetime Cashback Earned (₹)`
9. `Lifetime Cashback Redeemed (₹)`
10. `Last Purchase Date`
11. `Customer Status` (Active / Inactive)

### Sheet 2: "Sales and Transactions"
- **Top Summary Block (Rows 1–14):**
  - Reporting Period & Generation Timestamp
  - Total Completed Sales (₹)
  - Number of Completed Transactions
  - Average Bill Value (₹)
  - Total Cashback Earned (₹)
  - Total Cashback Redeemed (₹)
  - Total Cancelled Transactions
  - Total Pending Transactions
  - Total Gross Bill Amount (₹)
- **Detailed Transactions Table:**
  1. `Transaction ID`
  2. `Transaction Date` (dd/MM/yyyy)
  3. `Transaction Time` (HH:mm:ss)
  4. `Customer Name`
  5. `Customer Mobile Number`
  6. `Original Bill Amount (₹)`
  7. `Cashback Redeemed (₹)`
  8. `Final Payable Amount (₹)`
  9. `Payment Mode` (Cash / UPI)
  10. `Cashback Earned (₹)`
  11. `Transaction Status` (completed / cancelled)
  12. `Service Category`
- **Grand Totals Row:** Bottom summation row verifying gross bills, redemptions, final sales, and cashback earnings.

---

## 3. Resend & Supabase Setup Instructions

### Step 1: Run Migration in Supabase SQL Editor
1. Open your Supabase Dashboard: **SQL Editor** -> **New query**.
2. Paste the contents of `supabase/migrations/005_automated_reporting_system.sql`.
3. Click **Run**.

### Step 2: Configure Resend Secret in Supabase
In terminal or Supabase Dashboard (**Settings** -> **Edge Functions** -> **Secrets**):
```bash
# Set your Resend API key (from https://resend.com/api-keys)
supabase secrets set RESEND_API_KEY="re_123456789..."

# Optional: Set a custom sender or cron secret
supabase secrets set RESEND_FROM_EMAIL="Smart Cashback <reports@yourdomain.com>"
supabase secrets set CRON_SECRET="your_custom_cron_secret"
```

### Step 3: Deploy the Edge Function
```bash
supabase functions deploy send-report --no-verify-jwt
```

### Step 4: Schedule Supabase Cron (pg_cron)
In Supabase SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Weekly Report: Every Sunday at 9:00 PM IST (15:30 UTC)
SELECT cron.schedule(
  'smart_cashback_weekly_report',
  '30 15 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/functions/v1/send-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR-SUPABASE-SERVICE-ROLE-KEY>',
      'X-Cron-Secret', '<YOUR-CRON-SECRET>'
    ),
    body := jsonb_build_object('report_type', 'weekly')
  ) AS request_id;
  $$
);

-- 2. Monthly Report: 1st of every month at 9:00 AM IST (03:30 UTC)
SELECT cron.schedule(
  'smart_cashback_monthly_report',
  '30 3 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/functions/v1/send-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR-SUPABASE-SERVICE-ROLE-KEY>',
      'X-Cron-Secret', '<YOUR-CRON-SECRET>'
    ),
    body := jsonb_build_object('report_type', 'monthly')
  ) AS request_id;
  $$
);
```

---

## 4. Verification & Testing Checklist

- [x] **XLSX 2-Worksheet Generation**: Verified using `xlsx@0.18.5`.
- [x] **Client-Side Export**: Verified with "Export Excel (.xlsx)" in Reports tab.
- [x] **Manual Report Dispatch**: Verified with "Send Excel Report" modal in Reports tab.
- [x] **Settings Management**: Verified email verification flow and schedule toggles in Settings tab.
- [x] **Audit Trail**: Verified `report_history` table queries and UI display.
- [x] **TypeScript & Production Build**: Verified with `tsc -b` and `vite build` (0 errors).

