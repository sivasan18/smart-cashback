const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function clearTestData() {
  console.log('🧹 Starting cleanup of test/sample transactions and customer metrics for LIVE launch...');

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    const env = Object.fromEntries(
      envContent
        .split('\n')
        .filter(l => l.includes('='))
        .map(l => {
          const idx = l.indexOf('=');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        })
    );
    supabaseUrl = supabaseUrl || env.VITE_SUPABASE_URL;
    supabaseAnonKey = supabaseAnonKey || env.VITE_SUPABASE_ANON_KEY;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    supabaseUrl = 'https://lpmdrmkjzbausqkakbge.supabase.co';
    supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwbWRybWtqemJhdXNxa2FrYmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTg5MDUsImV4cCI6MjEwODk3NDkwNX0.-D4iVGH7BnCj44sItaxeR9R-GuHKjtmeqhz7h416c_s';
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'sivar75@gmail.com',
    password: 'San@1818'
  });

  if (authErr) {
    console.error('❌ Supabase Auth Failed:', authErr.message);
    process.exit(1);
  }

  console.log('✅ Authenticated successfully as:', auth.user.email);

  // 1. Delete all rows from cashback_ledger
  console.log('⏳ Deleting test records from cashback_ledger...');
  const { error: ledgerErr } = await supabase
    .from('cashback_ledger')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

  if (ledgerErr) {
    console.error('❌ Error clearing cashback_ledger:', ledgerErr.message);
  } else {
    console.log('✅ Successfully cleared test records from cashback_ledger');
  }

  // 2. Delete all rows from transactions
  console.log('⏳ Deleting test records from transactions...');
  const { error: txErr } = await supabase
    .from('transactions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

  if (txErr) {
    console.error('❌ Error clearing transactions:', txErr.message);
  } else {
    console.log('✅ Successfully cleared test records from transactions');
  }

  // 3. Reset all customer balances and totals to 0.0
  console.log('⏳ Resetting customer metrics (total_purchases=0, cashback_earned=0, cashback_redeemed=0, cashback_balance=0)...');
  const { error: custErr } = await supabase
    .from('customers')
    .update({
      total_purchases: 0.0,
      cashback_earned: 0.0,
      cashback_redeemed: 0.0,
      cashback_balance: 0.0
    })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // update all customers

  if (custErr) {
    console.error('❌ Error resetting customer metrics:', custErr.message);
  } else {
    console.log('✅ Successfully reset all customer balances and metrics to 0.0');
  }

  // 4. Verify post-cleanup state
  const [
    { count: txCount },
    { count: ledgerCount },
    { data: activeCustomers }
  ] = await Promise.all([
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase.from('cashback_ledger').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('id, name, cashback_balance, total_purchases').limit(5)
  ]);

  console.log('\n--- POST-CLEANUP VERIFICATION ---');
  console.log('Transactions remaining:', txCount);
  console.log('Cashback Ledger entries remaining:', ledgerCount);
  console.log('Sample customers after reset:', activeCustomers);

  if (txCount === 0 && ledgerCount === 0) {
    console.log('\n🎉 SUCCESS: All test data has been cleared and database is 100% clean for live production!');
  } else {
    console.log('\n⚠️ Some rows may still exist. Check RLS or table policies.');
  }
}

clearTestData().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

