# Smart Cashback – Xerox & Recharge Shop Management

A complete, production-ready cashback loyalty management system for small Xerox, printing, and mobile recharge shops.

## Features

- 🟢 **Customer Loyalty Wallet** — Every customer identified by mobile number earns 2% cashback
- 🧾 **POS Billing** — 5-step billing flow with instant cashback calculation
- 📊 **Dashboard** — Real-time stats, sales charts, and recent transactions
- 👥 **Customer Management** — Search, register, edit, view complete history
- 🔍 **Wallet Lookup** — Quick balance check by mobile number
- 📈 **Reports** — Daily, weekly, monthly, custom-range, CSV export
- ⚙️ **Settings** — Shop info, cashback %, service categories, password change
- 🔒 **Secure Auth** — Supabase Auth + Row Level Security
- 🛡️ **Server-side Transactions** — All billing runs via secure PostgreSQL function

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | React 18 + TypeScript 5 + Vite 6    |
| Styling      | Tailwind CSS 3                      |
| State        | Zustand 5                           |
| Database     | Supabase (PostgreSQL)               |
| Auth         | Supabase Auth                       |
| Charts       | Chart.js + react-chartjs-2          |
| Routing      | React Router v6                     |
| Toasts       | react-hot-toast                     |
| Export       | XLSX / CSV                          |
| Deployment   | Vercel                              |

---

## Prerequisites

- Node.js v18+
- npm v9+
- Supabase account (free tier works)

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd cashback-website
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New project**
3. Choose a name, region, and database password
4. Wait for the project to initialize (~1 minute)

### 4. Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run** (or press Ctrl/Cmd + Enter)

This creates all tables, indexes, RLS policies, and secure RPC functions.

### 5. Create your admin account

In Supabase dashboard:
1. Go to **Authentication → Users**
2. Click **Add user → Create new user**
3. Enter your email and a strong password
4. Click **Create user**

### 6. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these values in Supabase: **Settings → API → Project URL & anon key**

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with your admin credentials.

---

## Cashback Business Rules

| Rule | Value |
|------|-------|
| Minimum eligible purchase | ₹99 (configurable) |
| Cashback rate | 2% (configurable) |
| Cashback base | Amount paid after redemption |
| Maximum redemption | Lesser of wallet balance or bill amount |
| Cashback on cashback | ❌ No — only on actual cash paid |

### Formula

```
If bill_amount >= minimum_eligible_purchase:
  cashback_earned = (bill_amount - cashback_redeemed) × (rate / 100)
Else:
  cashback_earned = ₹0
```

### Example

| Purchase | Redeemed | Amount Paid | Cashback Earned |
|----------|----------|-------------|-----------------|
| ₹500     | ₹10      | ₹490        | ₹9.80           |
| ₹99      | ₹0       | ₹99         | ₹1.98           |
| ₹50      | ₹0       | ₹50         | ₹0.00 (below threshold) |

---

## Database Schema

```
customers           — mobile (unique), name, cashback_balance, totals
transactions        — billing records, idempotency_key (prevents duplicates)
cashback_ledger     — immutable credit/debit history
service_categories  — configurable service list
shop_settings       — cashback %, min purchase, shop info
```

All financial operations go through `process_billing()` PostgreSQL function (SECURITY DEFINER) — the frontend **cannot** directly modify wallet balances or ledger entries.

---

## Security Architecture

- **RLS on all tables** — only authenticated users can access data
- **SECURITY DEFINER RPCs** — billing runs as database owner, not the user
- **Idempotency keys** — prevents double-billing on network retry
- **Row locking** — `SELECT ... FOR UPDATE` prevents concurrent double-spending
- **Server-side validation** — all business rules enforced in SQL, not just frontend
- **No secrets in frontend** — only anon key (public) is exposed; service role key never used client-side

---

## Deployment (Vercel)

```bash
# Build
npm run build

# Vercel CLI deployment
npx vercel --prod
```

In Vercel project settings → Environment Variables, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Future: SMS Integration

The notification module in `src/lib/notifications.ts` is a ready stub. To enable SMS:

1. Choose an SMS provider (e.g., Twilio, MSG91, Fast2SMS)
2. Create a Supabase Edge Function: `supabase/functions/send-sms/index.ts`
3. Store API credentials as Supabase secrets (never in frontend)
4. Replace the stub call in `src/lib/notifications.ts`

```typescript
// Replace this line in notifications.ts:
await supabase.functions.invoke('send-sms', { body: payload })
```

---

## Test Scenarios

| Test | Input | Expected |
|------|-------|----------|
| Below threshold | ₹50 | Cashback: ₹0.00 |
| At threshold | ₹99 | Cashback: ₹1.98 |
| Round amount | ₹100 | Cashback: ₹2.00 |
| Large amount | ₹500 | Cashback: ₹10.00 |
| With redemption | ₹200, redeem ₹10 | Paid: ₹190, Cashback: ₹3.80 |
| Exceed balance | Redeem ₹50, balance ₹10 | ❌ Rejected |
| Duplicate mobile | Same number | Existing customer found, no duplicate |
| Concurrent billing | Same wallet, two requests | Row lock prevents double-spend |
| Cancel transaction | Completed tx | Ledger reversal created, history preserved |

---

## Project Structure

```
src/
├── components/
│   └── layout/
│       └── AppLayout.tsx       # Sidebar + main layout
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── cashback.ts             # Calculation utilities
│   └── notifications.ts        # SMS stub
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── BillingPage.tsx
│   ├── CustomersPage.tsx
│   ├── CustomerDetailPage.tsx
│   ├── WalletLookupPage.tsx
│   ├── ReportsPage.tsx
│   └── SettingsPage.tsx
├── store/
│   ├── authStore.ts            # Zustand auth state
│   └── settingsStore.ts        # Zustand settings state
├── types/
│   └── index.ts                # TypeScript types
├── App.tsx                     # Router + protected routes
├── main.tsx                    # Entry point
└── index.css                   # Global styles

supabase/
└── migrations/
    └── 001_initial_schema.sql  # Complete DB schema
```

---

## License

MIT © 2024 Smart Cashback
