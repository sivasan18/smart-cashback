// ==============================================================================
// SMART CASHBACK – SUPABASE EDGE FUNCTION: send-report
// ==============================================================================
// Deno Edge Function for automated and manual Excel sales report delivery via Resend.
// Deploy with: supabase functions deploy send-report --no-verify-jwt
// Required secrets: RESEND_API_KEY (already set), CRON_SECRET
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
// @ts-ignore
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Smart Cashback <onboarding@resend.dev>";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ─── Restrictive CORS Allowlist ─────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://smart-cashback-psi.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app");
  const allowOrigin = isAllowed ? origin : "https://smart-cashback-psi.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface ReportRequest {
  action?: "send_report" | "send_verification" | "verify_email";
  report_type?: "weekly" | "monthly" | "manual" | "custom" | "test";
  start_date?: string;
  end_date?: string;
  period_label?: string;
  recipient_email?: string;
  verification_code?: string;
}

// ─── Timezone Date Calculations (Asia/Kolkata UTC+5:30) ──────────────────────
function getISTDateRange(reportType: string, customStart?: string, customEnd?: string): {
  startISO: string;
  endISO: string;
  label: string;
  filenameSuffix: string;
} {
  const now = new Date();
  // IST offset in ms: +5 hours 30 mins
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffsetMs);

  if (reportType === "weekly") {
    // Current day in IST: 0 = Sun, 1 = Mon...
    const currentDay = nowIST.getUTCDay();
    // Previous Sunday (end of previous completed week)
    const daysSinceSunday = currentDay === 0 ? 7 : currentDay;
    const endIST = new Date(nowIST);
    endIST.setUTCDate(nowIST.getUTCDate() - daysSinceSunday);
    endIST.setUTCHours(23, 59, 59, 999);

    // Previous Monday (start of previous completed week)
    const startIST = new Date(endIST);
    startIST.setUTCDate(endIST.getUTCDate() - 6);
    startIST.setUTCHours(0, 0, 0, 0);

    const startUTC = new Date(startIST.getTime() - istOffsetMs);
    const endUTC = new Date(endIST.getTime() - istOffsetMs);

    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const label = `Weekly Report: ${fmt(startIST)} to ${fmt(endIST)} (Mon–Sun IST)`;
    return {
      startISO: startUTC.toISOString(),
      endISO: endUTC.toISOString(),
      label,
      filenameSuffix: `Weekly-${fmt(endIST)}`,
    };
  }

  if (reportType === "monthly") {
    // Previous calendar month
    const year = nowIST.getUTCFullYear();
    const month = nowIST.getUTCMonth(); // 0-indexed

    // Last day of previous month
    const endIST = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    // First day of previous month
    const startIST = new Date(Date.UTC(endIST.getUTCFullYear(), endIST.getUTCMonth(), 1, 0, 0, 0, 0));

    const startUTC = new Date(startIST.getTime() - istOffsetMs);
    const endUTC = new Date(endIST.getTime() - istOffsetMs);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[endIST.getUTCMonth()];
    const label = `Monthly Report: ${monthName} ${endIST.getUTCFullYear()} (${startIST.toISOString().split("T")[0]} to ${endIST.toISOString().split("T")[0]})`;

    return {
      startISO: startUTC.toISOString(),
      endISO: endUTC.toISOString(),
      label,
      filenameSuffix: `Monthly-${monthName}-${endIST.getUTCFullYear()}`,
    };
  }

  // Custom or manual
  const s = customStart ? new Date(customStart) : new Date(now.getTime() - 7 * 86400000);
  const e = customEnd ? new Date(customEnd) : now;
  const sStr = s.toISOString().split("T")[0];
  const eStr = e.toISOString().split("T")[0];
  const label = `Report Period: ${sStr} to ${eStr}`;
  return {
    startISO: s.toISOString(),
    endISO: e.toISOString(),
    label,
    filenameSuffix: `${sStr}_to_${eStr}`,
  };
}

// ─── Excel Generation (2 Worksheets) ─────────────────────────────────────────
function generateExcelBuffer(periodLabel: string, customers: any[], transactions: any[], summary: any): Uint8Array {
  const wb = XLSX.utils.book_new();

  // SHEET 1: CUSTOMER DETAILS (All customers)
  const custHeaders = [
    "Customer ID",
    "Customer Name",
    "Mobile Number",
    "Account Created Date",
    "Current Wallet Balance (₹)",
    "Total Purchase Count",
    "Lifetime Total Spending (₹)",
    "Lifetime Cashback Earned (₹)",
    "Lifetime Cashback Redeemed (₹)",
    "Last Purchase Date",
    "Customer Status",
  ];

  const custRows = (customers || []).map((c) => [
    c.id,
    c.name,
    c.mobile,
    c.created_at ? new Date(c.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
    Number(c.cashback_balance || 0),
    Number(c.purchase_count || 0),
    Number(c.total_purchases || 0),
    Number(c.cashback_earned || 0),
    Number(c.cashback_redeemed || 0),
    c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "No purchases",
    c.status || "Active",
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet([custHeaders, ...custRows]);
  ws1["!cols"] = [
    { wch: 38 }, { wch: 22 }, { wch: 15 }, { wch: 22 }, { wch: 24 },
    { wch: 20 }, { wch: 26 }, { wch: 26 }, { wch: 28 }, { wch: 22 }, { wch: 16 }
  ];
  ws1["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws1["!autofilter"] = { ref: `A1:K${Math.max(1, custRows.length + 1)}` };
  XLSX.utils.book_append_sheet(wb, ws1, "Customer Details");

  // SHEET 2: SALES AND TRANSACTIONS (WITH SUMMARY BLOCK)
  const summaryBlock = [
    ["SMART CASHBACK — SALES & TRANSACTION AUDIT REPORT"],
    ["Reporting Period:", periodLabel],
    ["Generated At (IST):", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
    [""],
    ["KEY PERFORMANCE METRICS", "VALUE"],
    ["Total Completed Sales (₹):", Number(summary.total_completed_sales || 0)],
    ["Number of Completed Transactions:", Number(summary.completed_tx_count || 0)],
    ["Average Bill Value (₹):", Number(summary.average_bill_value || 0)],
    ["Total Cashback Earned (₹):", Number(summary.total_cashback_earned || 0)],
    ["Total Cashback Redeemed (₹):", Number(summary.total_cashback_redeemed || 0)],
    ["Total Cancelled Transactions:", Number(summary.cancelled_tx_count || 0)],
    ["Total Pending Transactions:", Number(summary.pending_tx_count || 0)],
    ["Total Gross Bill Amount (₹):", Number(summary.total_gross_bill || 0)],
    [""],
    ["DETAILED TRANSACTION LEDGER"],
  ];

  const txHeaders = [
    "Transaction ID",
    "Transaction Date",
    "Transaction Time",
    "Customer Name",
    "Customer Mobile Number",
    "Original Bill Amount (₹)",
    "Cashback Redeemed (₹)",
    "Final Payable Amount (₹)",
    "Payment Mode",
    "Cashback Earned (₹)",
    "Transaction Status",
    "Service Category",
  ];

  const txRows = (transactions || []).map((t) => {
    const d = t.created_at ? new Date(t.created_at) : new Date();
    const dateStr = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    const timeStr = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    return [
      t.id,
      dateStr,
      timeStr,
      t.customer_name || "Unknown",
      t.customer_mobile || "",
      Number(t.bill_amount || 0),
      Number(t.cashback_redeemed || 0),
      Number(t.amount_paid || 0),
      t.payment_mode || "Cash",
      Number(t.cashback_earned || 0),
      t.status || "completed",
      t.service_category || "General",
    ];
  });

  const grandTotalRow = [
    "GRAND TOTALS",
    "",
    "",
    "",
    "",
    Number(summary.total_gross_bill || 0),
    Number(summary.total_cashback_redeemed || 0),
    Number(summary.total_completed_sales || 0),
    "",
    Number(summary.total_cashback_earned || 0),
    `${(transactions || []).length} Records`,
    "",
  ];

  const ws2 = XLSX.utils.aoa_to_sheet([...summaryBlock, txHeaders, ...txRows, grandTotalRow]);
  ws2["!cols"] = [
    { wch: 38 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 16 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 20 },
    { wch: 18 }, { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Sales and Transactions");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return new Uint8Array(wbout);
}

// Convert Uint8Array to base64
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

// ─── Main Request Handler ───────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── 1. Authentication & Authorization Verification ─────────────────────
    const authHeader = req.headers.get("authorization") || "";
    const cronSecretHeader = req.headers.get("x-cron-secret") || "";

    let isAuthorized = false;
    let isCron = false;
    let callerEmail = "unknown";

    // A. Check Cron Authentication (requires non-empty server secret)
    if (cronSecretHeader) {
      if (!CRON_SECRET || CRON_SECRET.trim().length < 8 || cronSecretHeader !== CRON_SECRET) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid or unconfigured Cron Secret" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      isAuthorized = true;
      isCron = true;
      callerEmail = "system_cron";
    }

    // B. Check Bearer Token (Service Role or Dynamic Administrator Supabase Auth JWT)
    if (!isAuthorized && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();

      if (SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY) {
        isAuthorized = true;
        callerEmail = "service_role";
      } else if (token) {
        const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !user) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: Invalid or expired authentication token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Dynamic Administrator Verification:
        // 1. NEVER trust client-editable user_metadata.
        // 2. Check server-managed app_metadata.role
        const isAppAdmin = user.app_metadata?.role === "admin" || user.app_metadata?.role === "super_admin";

        // 3. Check central database registry: public.admin_users
        // Must have confirmed email AND is_active = true
        let isDbAdmin = false;
        if (!isAppAdmin && user.email && user.email_confirmed_at) {
          const userEmail = user.email.toLowerCase().trim();
          const { data: adminRow } = await supabase
            .from("admin_users")
            .select("id, is_active")
            .or(`user_id.eq.${user.id},email.ilike.${userEmail}`)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

          if (adminRow?.is_active) {
            isDbAdmin = true;
          }
        }

        if (!isAppAdmin && !isDbAdmin) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Administrator privileges required to access reporting functions" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        isAuthorized = true;
        callerEmail = user.email || "authenticated_admin";
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Valid administrator authorization or Cron Secret required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 2. Parse & Validate Payload ────────────────────────────────────────
    const payload: ReportRequest = await req.json().catch(() => ({}));
    const action = payload.action || "send_report";

    const allowedActions = ["send_report", "send_verification", "verify_email"];
    if (!allowedActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action '${action}'. Allowed: ${allowedActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 3. Fetch Report Settings ───────────────────────────────────────────
    const { data: settingsData } = await supabase.from("report_settings").select("*").limit(1).single();
    const settings = settingsData || {
      id: undefined,
      recipient_email: "sivar75@gmail.com",
      is_email_verified: false,
      weekly_enabled: false,
      monthly_enabled: false,
    };

    // ─── ACTION: send_verification ──────────────────────────────────────────
    if (action === "send_verification") {
      const targetEmail = (payload.recipient_email || settings.recipient_email || "").trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!targetEmail || !emailRegex.test(targetEmail)) {
        return new Response(JSON.stringify({ error: "Valid recipient email address is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase.from("report_settings").upsert({
        id: settings.id,
        recipient_email: targetEmail,
        is_email_verified: false,
        verification_code: code,
        verification_sent_at: new Date().toISOString(),
      });

      if (!RESEND_API_KEY) {
        return new Response(
          JSON.stringify({
            success: true,
            warning: "RESEND_API_KEY not configured. Verification code saved in database.",
            devVerificationCode: code
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send Verification Email via Resend
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [targetEmail],
          subject: "Smart Cashback — Report Recipient Verification Code",
          html: `
            <div style="font-family: sans-serif; background-color: #0b0f17; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 500px; margin: auto;">
              <h2 style="color: #38bdf8; margin-top: 0;">Smart Cashback POS</h2>
              <p>You requested to set this email as the authorized recipient for automated sales and customer Excel reports.</p>
              <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #38bdf8;">${code}</span>
              </div>
              <p style="font-size: 13px; color: #94a3b8;">Enter this 6-digit code in the Smart Cashback Settings page within 15 minutes to verify your ownership.</p>
            </div>
          `,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        return new Response(JSON.stringify({ error: resendData.message || "Failed to send verification email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Verification code sent to " + targetEmail }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ─── ACTION: verify_email ───────────────────────────────────────────────
    if (action === "verify_email") {
      const code = (payload.verification_code || "").trim();
      if (!code || code !== settings.verification_code) {
        return new Response(JSON.stringify({ error: "Invalid verification code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check 15-minute OTP expiration
      if (settings.verification_sent_at) {
        const sentTime = new Date(settings.verification_sent_at).getTime();
        if (Date.now() - sentTime > 15 * 60 * 1000) {
          return new Response(JSON.stringify({ error: "Verification code has expired. Please request a new code." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      await supabase.from("report_settings").update({
        is_email_verified: true,
        verification_code: null,
      }).eq("id", settings.id);

      return new Response(JSON.stringify({ success: true, verified: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ─── ACTION: send_report ────────────────────────────────────────────────
    const reportType = payload.report_type || "manual";
    const allowedReportTypes = ["weekly", "monthly", "manual", "custom", "test"];
    if (!allowedReportTypes.includes(reportType)) {
      return new Response(
        JSON.stringify({ error: `Invalid report_type '${reportType}'. Allowed: ${allowedReportTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Date Validation
    if (payload.start_date && isNaN(Date.parse(payload.start_date))) {
      return new Response(
        JSON.stringify({ error: "Invalid start_date format. Must be a valid date or ISO 8601 string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (payload.end_date && isNaN(Date.parse(payload.end_date))) {
      return new Response(
        JSON.stringify({ error: "Invalid end_date format. Must be a valid date or ISO 8601 string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (payload.start_date && payload.end_date) {
      if (new Date(payload.start_date) > new Date(payload.end_date)) {
        return new Response(
          JSON.stringify({ error: "start_date cannot be later than end_date." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // STRICT RECIPIENT PROTECTION:
    // Report recipient is read EXCLUSIVELY from the protected report_settings table.
    // Client payload.recipient_email is ignored to prevent arbitrary data exfiltration.
    const recipientEmail = (settings.recipient_email || "").trim();

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return new Response(
        JSON.stringify({ error: "No recipient email configured. Please configure an authorized recipient email in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.is_email_verified) {
      return new Response(
        JSON.stringify({ error: "Recipient email is not verified. Please verify recipient email in Settings before generating or sending reports." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For scheduled reports, verify enabled in settings
    if (reportType === "weekly" && !settings.weekly_enabled && isCron) {
      return new Response(JSON.stringify({ message: "Weekly reports disabled in settings. Skipping." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (reportType === "monthly" && !settings.monthly_enabled && isCron) {
      return new Response(JSON.stringify({ message: "Monthly reports disabled in settings. Skipping." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Calculate dates
    const { startISO, endISO, label: periodLabel, filenameSuffix } = getISTDateRange(
      reportType,
      payload.start_date,
      payload.end_date
    );

    const fileName = `Smart-Cashback-Report-${filenameSuffix}.xlsx`;
    let reportHistoryId: string | undefined;

    // ─── 4. Atomic Concurrency & Idempotency / Rate-Limit Claim ─────────────
    if (reportType === "weekly" || reportType === "monthly") {
      // ATOMIC SCHEDULED REPORT CLAIM:
      // Uses PostgreSQL advisory lock + status checks to guarantee:
      // - Only one worker executes for this period
      // - Recovers stale processing records (> 10 minutes)
      // - Safely allows retries if a prior run failed
      const { data: claimData, error: claimErr } = await supabase.rpc("claim_scheduled_report", {
        p_report_type: reportType,
        p_period_label: periodLabel,
        p_period_start: startISO,
        p_period_end: endISO,
        p_recipient_email: recipientEmail,
        p_initiated_by: callerEmail,
        p_file_name: fileName,
        p_stale_minutes: 10,
      });

      if (claimErr) {
        // Direct query fallback if RPC is not yet applied
        const { data: existingReport } = await supabase
          .from("report_history")
          .select("id, status, created_at")
          .eq("report_type", reportType)
          .eq("period_label", periodLabel)
          .in("status", ["success", "processing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingReport && (existingReport.status === "success" || new Date(existingReport.created_at).getTime() > Date.now() - 10 * 60 * 1000)) {
          return new Response(
            JSON.stringify({
              message: `Report for period '${periodLabel}' has already been processed or is currently running.`,
              already_processed: true,
              report_id: existingReport.id,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: fallbackRow } = await supabase.from("report_history").insert({
          report_type: reportType,
          period_label: periodLabel,
          period_start: startISO,
          period_end: endISO,
          recipient_email: recipientEmail,
          status: "processing",
          total_customers: 0,
          total_transactions: 0,
          total_sales_amount: 0,
          initiated_by: callerEmail,
          file_name: fileName,
        }).select().single();
        reportHistoryId = fallbackRow?.id;
      } else {
        const claim = claimData && claimData[0];
        if (!claim?.claimed) {
          const reason = claim?.reason || "already_completed";
          const msg = reason === "in_progress"
            ? `Report for period '${periodLabel}' is currently being generated by an active process.`
            : `Report for period '${periodLabel}' has already been completed and dispatched.`;

          return new Response(
            JSON.stringify({
              message: msg,
              already_processed: true,
              report_id: claim?.history_id,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        reportHistoryId = claim.history_id;
      }
    } else {
      // ATOMIC MANUAL REPORT CLAIM & 60-SECOND RATE LIMITER:
      // Uses PostgreSQL advisory lock on admin identity to guarantee:
      // - Max 1 manual dispatch per 60 seconds per admin
      // - Prevents double-click races
      // - Never permanently locks if a delivery fails
      // - Excludes scheduled cron runs from this quota
      const { data: claimData, error: claimErr } = await supabase.rpc("claim_manual_report", {
        p_report_type: reportType,
        p_period_label: periodLabel,
        p_period_start: startISO,
        p_period_end: endISO,
        p_recipient_email: recipientEmail,
        p_initiated_by: callerEmail,
        p_file_name: fileName,
        p_cooldown_secs: 60,
      });

      if (claimErr) {
        // Direct query fallback if RPC is not yet applied
        const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const { data: recentReports } = await supabase
          .from("report_history")
          .select("id, created_at")
          .eq("initiated_by", callerEmail)
          .in("report_type", ["manual", "custom", "test"])
          .gte("created_at", sixtySecondsAgo)
          .limit(1);

        if (recentReports && recentReports.length > 0) {
          return new Response(
            JSON.stringify({
              error: "Rate limit exceeded: Reports can only be manually dispatched once every 60 seconds. Please wait before generating another report."
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: fallbackRow } = await supabase.from("report_history").insert({
          report_type: reportType,
          period_label: periodLabel,
          period_start: startISO,
          period_end: endISO,
          recipient_email: recipientEmail,
          status: "processing",
          total_customers: 0,
          total_transactions: 0,
          total_sales_amount: 0,
          initiated_by: callerEmail,
          file_name: fileName,
        }).select().single();
        reportHistoryId = fallbackRow?.id;
      } else {
        const claim = claimData && claimData[0];
        if (!claim?.allowed) {
          const retrySecs = claim?.retry_after_secs || 60;
          return new Response(
            JSON.stringify({
              error: `Rate limit exceeded: Reports can only be manually dispatched once every 60 seconds. Please wait ${retrySecs} second${retrySecs === 1 ? '' : 's'} before generating another report.`
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        reportHistoryId = claim.history_id;
      }
    }

    // ─── 5. Fetch Report Data via RPC ───────────────────────────────────────
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_report_data", {
      p_start_date: startISO,
      p_end_date: endISO,
    });

    let customers = rpcData?.customers || [];
    let transactions = rpcData?.transactions || [];
    let summary = rpcData?.summary || {};

    if (rpcErr || !rpcData) {
      // Direct query fallback via service_role
      const { data: custs } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      customers = custs || [];

      const { data: txs } = await supabase
        .from("transactions")
        .select("*, customers(name, mobile)")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });

      transactions = (txs || []).map((t: any) => ({
        ...t,
        customer_name: t.customers?.name || "Unknown",
        customer_mobile: t.customers?.mobile || "",
      }));

      const completed = transactions.filter((t: any) => t.status === "completed");
      const totalSales = completed.reduce((sum: number, t: any) => sum + Number(t.amount_paid || 0), 0);
      const totalGross = completed.reduce((sum: number, t: any) => sum + Number(t.bill_amount || 0), 0);
      const earned = completed.reduce((sum: number, t: any) => sum + Number(t.cashback_earned || 0), 0);
      const redeemed = completed.reduce((sum: number, t: any) => sum + Number(t.cashback_redeemed || 0), 0);

      summary = {
        total_completed_sales: totalSales,
        total_gross_bill: totalGross,
        completed_tx_count: completed.length,
        average_bill_value: completed.length > 0 ? Math.round((totalGross / completed.length) * 100) / 100 : 0,
        total_cashback_earned: earned,
        total_cashback_redeemed: redeemed,
        cancelled_tx_count: transactions.filter((t: any) => t.status === "cancelled").length,
        pending_tx_count: 0,
      };
    }

    // ─── 6. Generate Excel Workbook ─────────────────────────────────────────
    const xlsxBuffer = generateExcelBuffer(periodLabel, customers, transactions, summary);
    const base64Content = uint8ArrayToBase64(xlsxBuffer);

    // ─── 7. Check Resend Configuration ──────────────────────────────────────
    if (!RESEND_API_KEY) {
      const errMsg = "RESEND_API_KEY is not configured in Supabase Edge Function secrets.";
      if (reportHistoryId) {
        await supabase.from("report_history").update({
          status: "failed",
          error_message: errMsg,
          total_customers: customers.length,
          total_transactions: transactions.length,
          total_sales_amount: summary.total_completed_sales || 0,
        }).eq("id", reportHistoryId);
      }

      return new Response(
        JSON.stringify({
          error: errMsg,
          details: `Workbook generated successfully (${customers.length} customers, ${transactions.length} transactions). Set RESEND_API_KEY in Supabase secrets to enable delivery.`
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 8. Email Delivery via Resend ───────────────────────────────────────
    let subject = `Smart Cashback — Requested Excel Report (${periodLabel})`;
    if (reportType === "weekly") {
      subject = `Smart Cashback — Weekly Sales & Customer Report (${periodLabel})`;
    } else if (reportType === "monthly") {
      subject = `Smart Cashback — Monthly Sales & Customer Report (${periodLabel})`;
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #07090e; color: #f1f5f9; padding: 40px 20px; min-height: 100%;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%); padding: 32px 30px; text-align: left;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #020617; letter-spacing: -0.5px;">Smart Cashback</h1>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: #0f172a;">${subject}</p>
          </div>

          <!-- Body -->
          <div style="padding: 30px;">
            <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700;">Audit Timeframe</p>
              <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #38bdf8;">${periodLabel}</p>
            </div>

            <!-- KPI Grid -->
            <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 24px;">
              <tr>
                <td style="width: 50%; background-color: #1e293b; padding: 16px; border-radius: 10px;">
                  <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Total Completed Sales</span>
                  <div style="font-size: 24px; font-weight: 800; color: #f8fafc; margin-top: 4px;">₹${Number(summary.total_completed_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </td>
                <td style="width: 50%; background-color: #1e293b; padding: 16px; border-radius: 10px;">
                  <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Completed Bills</span>
                  <div style="font-size: 24px; font-weight: 800; color: #38bdf8; margin-top: 4px;">${summary.completed_tx_count || 0}</div>
                </td>
              </tr>
              <tr>
                <td style="width: 50%; background-color: #1e293b; padding: 16px; border-radius: 10px;">
                  <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Cashback Distributed</span>
                  <div style="font-size: 24px; font-weight: 800; color: #34d399; margin-top: 4px;">+₹${Number(summary.total_cashback_earned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </td>
                <td style="width: 50%; background-color: #1e293b; padding: 16px; border-radius: 10px;">
                  <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Cashback Redeemed</span>
                  <div style="font-size: 24px; font-weight: 800; color: #fbbf24; margin-top: 4px;">−₹${Number(summary.total_cashback_redeemed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </td>
              </tr>
            </table>

            <div style="background-color: #1e293b; border-left: 4px solid #38bdf8; padding: 16px 18px; border-radius: 8px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                📎 <strong>Excel Attachment:</strong> <code>${fileName}</code> is attached with 2 verified worksheets: <em>Customer Details</em> (${customers.length} total customer accounts) and <em>Sales and Transactions</em> (${transactions.length} audit records).
              </p>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 24px; line-height: 1.5;">
              Generated securely from Smart Cashback POS database. Recipient: <code>${recipientEmail}</code>. Timezone: Asia/Kolkata.
            </p>
          </div>
        </div>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [recipientEmail],
        subject,
        html: htmlContent,
        attachments: [
          {
            filename: fileName,
            content: base64Content,
          },
        ],
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      const errMsg = resendData.message || "Resend email delivery failed";
      if (reportHistoryId) {
        await supabase.from("report_history").update({
          status: "failed",
          error_message: errMsg,
          total_customers: customers.length,
          total_transactions: transactions.length,
          total_sales_amount: summary.total_completed_sales || 0,
        }).eq("id", reportHistoryId);
      }

      await supabase.from("report_settings").update({
        last_report_at: new Date().toISOString(),
        last_report_status: "failed",
        last_report_error: errMsg,
      }).eq("id", settings.id);

      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ─── 9. Record Success in report_history ─────────────────────────────────
    const messageId = resendData.id || "resend_" + Date.now();

    if (reportHistoryId) {
      await supabase.from("report_history").update({
        status: "success",
        resend_message_id: messageId,
        total_customers: customers.length,
        total_transactions: transactions.length,
        total_sales_amount: summary.total_completed_sales || 0,
        error_message: null,
      }).eq("id", reportHistoryId);
    }

    await supabase.from("report_settings").update({
      last_report_at: new Date().toISOString(),
      last_report_status: "success",
      last_report_error: null,
    }).eq("id", settings.id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        reportId: reportHistoryId,
        periodLabel,
        fileName,
        recipientEmail,
        totalCustomers: customers.length,
        totalTransactions: transactions.length,
        totalSales: summary.total_completed_sales,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
