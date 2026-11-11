# Security Review

**Date:** 2026-11-11

**Scope:** Repository-level review of the supplied 20-point checklist. No production service was contacted, no database changes were made, and no credentials or private environment values were inspected. Live Supabase and Vercel configuration was not verified. This is not a production security certification.

## Findings

| # | Severity | File | Lines | Finding | Confidence |
|---|---|---|---|---|---|
| 1 | HIGH | [supabase/migrations/001_initial_schema.sql](./supabase/migrations/001_initial_schema.sql) | 107-120, 231-246 | Financial `SECURITY DEFINER` RPCs lack explicit administrator authorization and migrations do not restrict their execute grants. `process_billing` also trusts caller-supplied payment totals without checking consistency with the bill and redemption. Confirm effective privileges and exposure in the live database before concluding whether an unauthenticated caller can invoke these functions. | 9/10 |
| 2 | HIGH | [supabase/migrations/001_initial_schema.sql](./supabase/migrations/001_initial_schema.sql), [supabase/migrations/002_customer_management_and_deletion.sql](./supabase/migrations/002_customer_management_and_deletion.sql) | 001: 296-312; 002: 17-34, 73-75, 157-160 | RLS policies and destructive RPCs treat any authenticated user as an administrator. If non-admin users can authenticate, they receive broad access to shop data and destructive actions. The live sign-up configuration was not checked. | 8/10 |
| 3 | MEDIUM | [src/pages/SettingsPage.tsx](./src/pages/SettingsPage.tsx) | 178-201 | Password change updates the password without verifying the current password; the current-password form value is not checked in this flow. | 8/10 |
| 4 | MEDIUM | [migrations/0008_clear_test_data.sql](./migrations/0008_clear_test_data.sql) | 69-80 | The manually run cleanup script deletes transaction and ledger data and resets customer totals without a test-data scope. Accidental execution against production could destroy data. | 9/10 |

## Checklist status

“Not verified” means repository inspection alone could not establish the control in the live service. “Not applicable in reviewed code” means no corresponding integration or feature was found; it does not rule out configuration outside this repository.

| # | Requirement | Status | Evidence / notes |
|---|---|---|---|
| 1 | Row-Level Security | **Partial / HIGH** | RLS is enabled on the five core tables in migration 001, but policies grant access to any authenticated user rather than a distinct administrator. |
| 2 | Authenticate every API route | **Not applicable in reviewed code** | No application API route or edge-function directory was found. Supabase RPC endpoints require separate privilege and authorization verification (finding 1). |
| 3 | Never trust the frontend | **Gap / HIGH** | Billing is implemented in a database function, but caller-provided payment totals are not cross-validated (finding 1). |
| 4 | Rate limiting | **Not verified** | Supabase Auth rate limits and any hosting-level limits are external configuration; no application-level limiter was identified in the reviewed surfaces. |
| 5 | Input validation and sanitization | **Partial** | Database constraints and billing validation exist, but billing total consistency is missing. Runtime XSS and input testing was not performed. |
| 6 | Parameterized database queries | **Partial / not runtime tested** | Application data access uses Supabase query methods and the billing function uses typed parameters. No injection tests were run. |
| 7 | Restrictive CORS | **Not verified** | Supabase and hosting CORS configuration are external to the inspected repository. |
| 8 | HTTPS everywhere | **Not verified** | Hosting and redirect/HSTS behavior were not tested against a deployed site. |
| 9 | Prevent IDOR | **Gap / HIGH** | Authenticated-user policies are broad and do not enforce an administrator identity or per-resource ownership boundary. |
| 10 | Disable production debugging | **Not verified** | Production deployment behavior and hosted error responses were not inspected. |
| 11 | CAPTCHA / bot protection | **Not verified** | Supabase Auth bot-protection settings are external configuration; no custom server-side verification was found. |
| 12 | Administrator audit logging | **Partial** | An audit-log table and logging calls exist, but migration 002 allows any authenticated user to read and insert logs. |
| 13 | Secure error and 404 pages | **Gap / partial** | The SPA wildcard route redirects to billing; dedicated 403/500 handling was not identified. No deployed error behavior was tested. |
| 14 | Private storage buckets | **Not verified** | Storage bucket configuration is external; no bucket access test was performed. |
| 15 | Proper admin page protection | **Gap / HIGH** | Frontend route protection checks for a session, while database authorization also treats every authenticated user as an administrator. |
| 16 | Dependency vulnerability audit | **Not run** | `npm audit` was not run as part of this review. |
| 17 | Secure file upload validation | **Not applicable in reviewed code** | No file-upload feature was identified in the reviewed surfaces. |
| 18 | Independent AI-assisted review | **Completed, source-only** | This review identified findings 1-4. It does not replace manual verification or live testing. |
| 19 | Security headers | **Gap / not verified** | `vercel.json` contains an SPA rewrite only; no security-header configuration was found there. Deployed headers were not checked. |
| 20 | Webhook signature verification | **Not applicable in reviewed code** | No server-side payment webhook handler was found. UPI/payment behavior and any provider-side integration were not tested. |

## Testing performed

- Read-only inspection of authentication, settings, database migrations, deployment rewrite configuration, and dependency manifest.
- No unauthenticated, normal-user, or administrator access tests were run against a live service.
- No cross-user, SQL injection, XSS, rate-limit, CORS, storage, webhook, HTTP-header, HTTPS, or dependency scan tests were run.
- No production records were viewed or modified.

## Recommended remediation

1. Revoke default execution privileges on privileged RPCs; grant only to the intended authenticated role and enforce an administrator claim inside each function.
2. Reconcile RLS policies and destructive RPC authorization around a server-controlled administrator role. Confirm public sign-up is disabled or otherwise appropriately restricted.
3. Validate billing totals and all financial invariants inside the database function.
4. Require recent authentication (or equivalent step-up verification) before changing an administrator password.
5. Restrict cleanup scripts to explicitly identified test data and require deliberate operator confirmation before running them.
6. Verify all “not verified” items against the live Supabase, Vercel, and dependency environments before production deployment.
