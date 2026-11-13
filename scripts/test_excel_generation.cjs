const XLSX = require('xlsx');

function buildReportWorkbook({ periodLabel, customers, transactions, summary }) {
  const wb = XLSX.utils.book_new();

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: CUSTOMER DETAILS
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
    'Customer Status'
  ];

  const customerRows = customers.map(c => [
    c.id,
    c.name,
    c.mobile,
    c.created_at,
    Number(c.cashback_balance || 0),
    Number(c.purchase_count || 0),
    Number(c.total_purchases || 0),
    Number(c.cashback_earned || 0),
    Number(c.cashback_redeemed || 0),
    c.last_purchase_date || 'No purchases',
    c.status || 'Active'
  ]);

  const ws1Data = [customerHeaders, ...customerRows];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

  // Column widths for Sheet 1
  ws1['!cols'] = [
    { wch: 38 }, // ID
    { wch: 22 }, // Name
    { wch: 15 }, // Mobile
    { wch: 20 }, // Created
    { wch: 24 }, // Balance
    { wch: 20 }, // Purchase count
    { wch: 26 }, // Total spending
    { wch: 26 }, // Cashback earned
    { wch: 28 }, // Cashback redeemed
    { wch: 20 }, // Last purchase
    { wch: 16 }  // Status
  ];

  // Freeze top row of Sheet 1
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
  // Autofilter for Sheet 1
  ws1['!autofilter'] = { ref: `A1:K${Math.max(1, customerRows.length + 1)}` };

  XLSX.utils.book_append_sheet(wb, ws1, 'Customer Details');

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: SALES AND TRANSACTIONS (WITH SUMMARY AT TOP)
  // ─────────────────────────────────────────────────────────────
  const summaryBlock = [
    ['SMART CASHBACK — SALES & TRANSACTION AUDIT REPORT'],
    ['Reporting Period:', periodLabel],
    ['Generated At:', new Date().toISOString()],
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
  ];

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
    'Service Category'
  ];

  const txRows = transactions.map(t => [
    t.id,
    t.date,
    t.time,
    t.customer_name,
    t.customer_mobile,
    Number(t.bill_amount || 0),
    Number(t.cashback_redeemed || 0),
    Number(t.amount_paid || 0),
    t.payment_mode || 'Cash',
    Number(t.cashback_earned || 0),
    t.status,
    t.service_category || 'General'
  ]);

  // Grand total row
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
    ''
  ];

  const ws2Data = [...summaryBlock, txHeaders, ...txRows, grandTotalRow];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);

  // Column widths for Sheet 2
  ws2['!cols'] = [
    { wch: 38 }, // Tx ID
    { wch: 16 }, // Date
    { wch: 14 }, // Time
    { wch: 22 }, // Name
    { wch: 16 }, // Mobile
    { wch: 22 }, // Bill Amount
    { wch: 22 }, // Cashback Redeemed
    { wch: 22 }, // Final Paid
    { wch: 16 }, // Mode
    { wch: 20 }, // Cashback Earned
    { wch: 18 }, // Status
    { wch: 24 }  // Category
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'Sales and Transactions');

  return wb;
}

// Test generation
const dummyCustomers = [
  { id: '1111-2222', name: 'John Doe', mobile: '9876543210', created_at: '2026-11-01 10:00', cashback_balance: 150.5, purchase_count: 5, total_purchases: 4500, cashback_earned: 90, cashback_redeemed: 30, last_purchase_date: '2026-11-10 14:30', status: 'Active' },
  { id: '3333-4444', name: 'Jane Smith', mobile: '9123456780', created_at: '2026-11-02 11:15', cashback_balance: 0, purchase_count: 1, total_purchases: 500, cashback_earned: 10, cashback_redeemed: 10, last_purchase_date: '2026-11-02 11:30', status: 'Active' }
];

const dummyTxs = [
  { id: 'tx-1', date: '10/11/2026', time: '14:30:00', customer_name: 'John Doe', customer_mobile: '9876543210', bill_amount: 1000, cashback_redeemed: 20, amount_paid: 980, payment_mode: 'UPI', cashback_earned: 19.6, status: 'completed', service_category: 'Colour Printing' }
];

const dummySummary = {
  totalCompletedSales: 980,
  completedTxCount: 1,
  averageBillValue: 1000,
  totalCashbackEarned: 19.6,
  totalCashbackRedeemed: 20,
  cancelledTxCount: 0,
  pendingTxCount: 0,
  totalGrossBill: 1000
};

const wb = buildReportWorkbook({
  periodLabel: '03 Nov 2026 – 09 Nov 2026',
  customers: dummyCustomers,
  transactions: dummyTxs,
  summary: dummySummary
});

const outPath = '/tmp/test_report.xlsx';
XLSX.writeFile(wb, outPath);
console.log('Successfully wrote test excel file to', outPath);

