# WAH Payroll System — Project Overview & Interview Guide

> A full-stack HR / payroll web application for WAH, a Philippine organization. Employees log in, see their dashboard, file **leaves**, **offset applications**, and **resignations**, and check attendance, pay slips, and salary history. HR/Admin manage employees, attendance, payroll, and government-reportable data (SSS, PhilHealth, Pag-IBIG, TIN, GSIS).

---

## Table of Contents

1. [What the system is](#1-what-the-system-is)
2. [Roles & authorization](#2-roles--authorization)
3. [Authentication flow](#3-authentication-flow)
4. [The employee module](#4-the-employee-module-the-core)
5. [Attendance](#5-attendance)
6. [Leave module](#6-leave-module-routed-separately-at-apileaves)
7. [Offsets module](#7-offsets-module)
8. [Resignation module](#8-resignation-module)
9. [Payroll engine](#9-payroll-engine-generatepayroll-line-4690--the-heart-of-the-app)
10. [Reports](#10-reports)
11. [File management & notifications](#11-file-management--notifications)
12. [Data layer & schema strategy](#12-data-layer--schema-strategy-interesting-for-interviews)
13. [Things I'd point out in an interview](#13-things-id-point-out-in-an-interview-weaknesses--what-id-improve)

---

## 1. What the system is

### Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + Vite 7, React Router 7, Tailwind CSS 4 + shadcn/ui (Radix), TanStack Query, Recharts, axios, jspdf + @react-pdf |
| Backend | Node.js + Express 4 (ESM), run via `tsx` (mixes `.js` and `.ts`), TypeScript in some files |
| Database | MySQL 8, accessed with **raw parameterized SQL** through a `mysql2/promise` connection pool — **no ORM** (`server/src/config/db.js`) |
| Storage | AWS S3/Cloudflare R2 for uploaded docs (`multer-s3`), DB `LONGBLOB` for reusable file templates, local disk for avatar photos |
| Auth | JWT access token (8d) + httpOnly refresh cookie; bcrypt passwords; Nodemailer + Puppeteer for PDF payslip emails |

### Layout

Monorepo with:

- `client/` — React SPA (pages: Login, Dashboard, HRDashboard, Employees, Attendance, Leave, Payroll, Payslips, SalaryHistory, Reports, HRReports, MyReports, Settings, FileManagement)
- `server/` — Express API (`src/controllers`, `src/routes`, `src/functions`, `src/middleware`, `src/helper`, `src/services`)
- `server/schema.sql` — canonical DDL-only schema (15 tables)
- Root `package.json` for building

---

## 2. Roles & authorization

Four roles stored in `employees.role` (`ENUM`): **Admin, Supervisor, HR, RankAndFile**. Everything is gated twice:

1. **Backend middleware** — `server/src/middleware/authMiddleware.js`:
   - `authenticateToken` verifies the `Bearer` JWT and attaches `req.user`.
   - `authorizeRoles(...allowedRoles)` checks `req.user.role`.

   Example: `GET /api/employees/payroll` is open to all four roles, but `POST /generate-payroll` is Admin-only (`employeeRoutes.js:290-294`). The whole `/api/employees` router sits behind `router.use(authenticateToken)`.

2. **Frontend** — `client/src/App.jsx` uses role-gated routes; `MainLayout`/`Sidebar` only render menu items the role may see.

Role resolution happens server-side with `normalizeRole()` in `authController.js` (`Admin`/`Supervisor`/`HR`/`RankAndFile`, defaulting to `RankAndFile`) and `employeeController.js` `resolveRoleFromProfile()` which derives a role from `designation`/`position` (e.g. `position` starting `supervisor(` → Supervisor).

> **Login quirk:** the username is the employee's **first name** (case-insensitive, spaces stripped), *not* their employee ID — `authController.js:70-75`. Logging in with `admin` looks up `first_name = 'Admin'`. Two employees with the same first name is a real risk (login silently picks `rows[0]`).

---

## 3. Authentication flow

- `POST /api/auth/login` (`authController.js:66`) → find employee by first name → verify password → issue two tokens:
  - **Access token** `{emp_id, role}`, 8-day expiry, signed with `JWT_SECRET`.
  - **Refresh token**, 8-day expiry, signed with `JWT_REFRESH`, set as an **httpOnly cookie** scoped to path `/api/auth/refresh`.
  - Returns `{token, user}`; client stores the access token in `localStorage`.
- `GET /api/auth/me` re-fetches the profile with the token.
- `POST /api/auth/refresh` (`helper/refresh.ts`) reads the httpOnly cookie, verifies it, issues a new access token.
- `POST /api/auth/logout` clears the cookie.
- **Client auto-refresh** (`client/src/hooks/interceptor.ts`): a shared axios instance attaches `Authorization: Bearer …` on every request (`request` interceptor) and, on a **401**, retries once — calls `/api/auth/refresh`, updates the token, and replays the original request. If refresh fails, it clears storage and bounces to `/`.

### Password rules unique to this app (`authController.js:30-64`, `checkPassword`)

- If a user has **no stored password**, login accepts the deterministic fallback `emp_id + first_name` (e.g. `EMP-001Duane`) — how newly created employees first log in.
- If the hash starts with `$2b$`/`$2a$`/`$2y$`, it's bcrypt-compared.
- Admin additionally has an `ADMIN_DEFAULT_PASSWORD` env escape hatch.
- Non-admin **plain-text stored passwords are deliberately rejected** — only the generated fallback or a bcrypt hash works.

`changeMyPassword` (`employeeController.js:5525+`) verifies the current bcrypt password, then hashes + stores the new one. `resetEmployeePassword` writes the plain auto-password so an admin can hand a user back their default credential.

---

## 4. The employee module (the core)

Most business logic lives in **one large controller**: `server/src/controllers/employeeController.js` (~5,600 lines), mounted at `/api/employees`.

### Create employee — `createEmployee` (line 1594)

1. Validates required fields; auto-generates `emp_id` if not given.
2. Auto-generates a password `emp_id + first_name` if none supplied.
3. **Salary lookup by position:** queries `position_salary_settings` for the role's salary; falls back to the most recent employee with the same position. This is why `updateBaseSalaryByPosition` (line 4776, Admin-only) exists — update the position salary once and all future hires with that position inherit it.
4. Inserts the row with **government numbers** (SSS/TIN/PhilHealth/Pag-IBIG/GSIS), DOB, hired date, etc. (`ensureEmployeeGovernmentColumns` adds those columns if missing).
5. Seeds `leave_balances` via `recalculateLeaveBalanceForEmployee` — **27 days for Regular/Probationary, 12 for Job Order/PGT**.

### Update / delete

`updateEmployee`, `deleteEmployee` (cascades everything FKs reference), `resetEmployeePassword`.

---

## 5. Attendance

- `saveBulkAttendance` (line 3279): Admin/HR post a day's roster. It **deletes that day's rows** then re-inserts them (idempotent). It also writes a second `status2` column (half-shift status) that is **not in `schema.sql`**.
- `getAttendanceCalendarSummary` / `getDailyAttendance`: aggregate present/absent/late/undertime/half-day/on-leave counts, counting `status` **or** `status2`.
- `getConvertedAbsenceSummary`: uses the active **`workweek_configs`** to convert raw absences into salary-impacting units — configs (`5-day`/`4-day` with `hours_per_day` and `absence_unit` of 1 or 1.25) selected by `effective_from`. That's how a 4-day-workweek employee's absence is worth more than a 5-day worker's. Configs are versioned by `effective_from` (Admin CRUD via `/workweek-config`).

---

## 6. Leave module (routed separately at `/api/leaves`)

### Filing — `functions/leave/fileLeave.ts`

1. Requires `leave_type`, `date_from` (reason comes through `supervisor_remarks`).
2. **Rules check:** rejects "Job Order" employees filing "PGT Leave".
3. Uploads the **OCP document** to S3 under `OCP/<emp_id>/<timestamp>-<filename>` via `PutObjectCommand`, storing the key in `leave_requests.ocp`.
4. Inserts the request (status `Pending`) in a **transaction**, then calls `notifyApproversForRequest` (line 1382) to insert notification rows for approvers.
5. Commits; returns 201.

### Listing — `functions/leave/getAllLeaves.ts`

Object-level data scoping: Admins/HR see everything; Supervisors see their own **plus everyone in the same `designation`/department**; RankAndFile see only their own. For every row it builds a **1-hour pre-signed S3 URL** for the OCP file on the fly.

### Approval — `updateLeaveStatus` (line 3378)

Supervisor/HR approve, deny, or **partially approve** (`approved_days`, `approved_dates` JSON, `supervisor_remarks`). Then `recalculateLeaveBalanceForEmployee` runs again so the **leave balance is always derived: allocation − approved/partially-approved days**, never stored manually. HR can override a balance via `adjustLeaveBalance` (`PUT /leave-balance/:id`).

### Cancellations & HR notes

`cancelMyLeave` + `requestMyLeaveCancellation` implement a two-step cancellation: employee requests cancellation, supervisor/HR decides. HR can append a note on any pending request via `addHrNoteToPendingRequest` (line 1954) → creates a `Offset_HR_NOTE`/`Leave_HR_NOTE` notification.

---

## 7. Offsets module

- **`fileOffsetApplication`** (line 4099): like leave, employees file offset applications (`offset_applications` table).
- **`getOffsetBalance`** (line 4079): reads `offset_ledger` — a per-employee, per-month ledger with `offset_earned`, `offset_used`, `carried_over`, `final_balance`, and a Draft/Pending/Approved/Rejected status reviewed by the supervisor.
- **`updateOffsetApplicationStatus`**: Supervisor/HR approves/denies, with a matching cancellation-request flow.

Effectively a **flexi-leave credits** system for employees who work extra days.

---

## 8. Resignation module

- `fileResignation` (line 2702): the client submits through a **5-step funnel** (saved incrementally into `resignation_drafts` as a `payload_json` with `current_step`/`interview_part` — `saveMyResignationDraft` line 2663).
- The server enforces the **16 exit-interview answers**, stores `leaving_reasons_json`, the resignation letter, recipient, dates, `effective_date`, and file keys (`endorsement_file_key`, `clearance_file_key`).
- `updateResignationStatus` → Pending Approval / Approved / Rejected, tracked with `reviewed_by`, `reviewed_at`.
- `uploadResignationClearance` lets the employee upload their clearance document; `replaceResignationFile` swaps files.
- Same request/approve/deny + cancellation-request pattern as leave.

---

## 9. Payroll engine (`generatePayroll`, line 4690) — the heart of the app

Per selected **month period**:

1. `parsePeriodRange(period)` → period-start date (`YYYY-MM-01`).
2. **Idempotence:** `DELETE FROM payroll WHERE period_start = ?` first, then regenerate.
3. For every non-Admin employee:
   - `basic_pay` from the employee record.
   - **Incentives** = sum of `salary_history` rows with `type IN ('Bonus','Increase')` in that month (ABS).
   - **Deductions** = sum of `type = 'Decrease'` (ABS).
   - `gross_pay = basic_pay + incentives`; `net_pay = gross − deductions`.
   - Upsert the snapshot (`ON DUPLICATE KEY UPDATE`) so re-running is safe.
4. All inside a transaction. Route: `POST /api/employees/generate-payroll` (Admin).

`getAllPayroll` (line 3680) **recomputes the same numbers live** by LEFT JOINing a subquery over `salary_history` for the month, so the UI always reflects current adjustments even if the stored snapshot ages.

**Salary history** is Admin-managed:

- `applySalaryAdjustment` (line 426) — `POST /salary-adjustment`, normalizes types to `Increase`/`Decrease`/`Bonus`.
- `updateSalaryHistoryEntry` / `deleteSalaryHistoryEntry` — `PUT/DELETE /salary-history/:id`.
- `resetPayrollData` (line 5324) — Admin wipes all payroll + salary_history (a "start over" tool).

### Payslips — `server/src/controllers/payrollController.js`

`sendPayslip` / `sendBulkPayslips` render an HTML payslip via **Puppeteer → PDF**, then email through **Nodemailer (Gmail)**. S3/R2 credentials live in `config/s3.ts`.

---

## 10. Reports

- **`GET /api/employees/dashboard-summary`** (line 2101): role-scoped KPIs — headcount, attendance by status, pending approvals, leave balances, etc.
- **`GET /api/hr-reports`** (`HrReportsController.js`): three report types via `?type=`:
  - `leave` — all leave requests joined with employees.
  - `attendance` — last 30 days, pivoted to present/absent/on-leave/late counts per day.
  - `balance` — every employee's leave/offset credits.
  - Notably hides `role != 'Admin'`.

---

## 11. File management & notifications

- **File templates** (`file_templates`, created at runtime — not in `schema.sql`): Admin/HR upload reusable templates with `multer.memoryStorage`; content stored in DB as `LONGBLOB` (`stored_files`), served via `uploadFileTemplate`/`downloadFileTemplate`/`replaceFileTemplate`/`deleteFileTemplate`. Admins track who has uploads via `getFileManagementInventory`.
- **Missing docs** (`updateMissingDocs`, line 2505): Admin/HR marks `employee_missing_docs` (comma-separated doc names; clearing it deletes the row).
- **Notifications** (`createNotification`, line 1353): generic `{emp_id, type, title, message, reference_type, reference_id, status Unread/Read}` fired on request filing, status changes, HR notes, and cancellations. Mark-read / mark-all-read / delete endpoints.
- **Profile photos:** `multer.diskStorage` → `uploads/profiles/avatar-<emp_id>-<ts>.png`, statically served by Express (`app.use("/uploads", …)`).

---

## 12. Data layer & schema strategy

- **No ORM.** Every query is parameterized SQL through a pool — safe from injection, but lots of raw text.
- **Self-healing schema:** controller entry points run idempotent `ensure…` functions — `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN` guarded by an `information_schema` check (`ensureEmployeeGovernmentColumns`, `ensureLeaveApprovalColumns`, `ensureOffsetTables`, `ensureFileTemplatesTable`, etc.). The canonical `schema.sql` is DDL-only.
- This creates **drift**: `attendance.status2`, `leave_requests.ocp`, `supervisor_remarks`, `hr_note`, and the whole `file_templates` table exist only at runtime and aren't in `schema.sql`. (The seed script adds them when it runs.)
- **Transactions** (`pool.getConnection()` + begin/commit/rollback) are used for multi-step writes: leave filing, payroll generation, resignations.

### Seeding fake data

`server/scripts/seed.js` (run with `npm run seed` in `server/`) uses `@faker-js/faker` to populate:

- 1 Admin, 2 HR, 4 Supervisors, 30 RankAndFile + `position_salary_settings` + workweek config
- ~2,200 attendance rows (last 3 months, weekdays, weighted statuses + `status2`)
- 60 leave requests, 37 leave balances, 15 offset applications, 60 offset ledger rows
- 50 salary_history adjustments and 108 payroll rows across 3 periods (formula mirrors `generatePayroll`)
- 3 resignations (with 16-question exit-interview JSON), 6 missing-doc records, 85 notifications

Logins: **username = first name (lowercase)**, **password = `emp_id + first_name`**, e.g. `admin` / `ADMIN-001Admin`.

---

## 13. Things I'd point out in an interview (weaknesses / what I'd improve)

- **`employeeController.js` is a 5,600-line god-file** — routing + logic + schema migration mixed. I'd split by domain (HR, payroll, attendance, leave) like the newer TypeScript `/lease` functions already hint at.
- **First-name login** makes duplicate names ambiguous and is fragile long-term; a unique username/employee-ID login is safer.
- **Duplicate `PUT /resignations/:id` route** (`employeeRoutes.js:134` vs `:200`): the first matching handler (Admin/Supervisor, no HR) wins — the HR version is dead code.
- **Plain-text fallback passwords** and a shared `"super_secret_wah_key"` default should be forced in production.
- **CORS is hardcoded** to one Vercel origin (`index.js:18`) — fine for one deploy, painful for local dev or multi-tenant.
- `dashboardRoutes.js` is a dead stub; the real endpoint is `/api/employees/dashboard-summary`.
- Two genuine schema bugs surfaced while seeding: the attendance `status` ENUM defaulted to a non-member `'Pending'`, and `attendance.status2` was missing — concrete proof of schema/code drift.

**Bottom line:** a classic "startup-velocity" CRUD application — role-scoped features wired end-to-end, business logic in SQL, pragmatic conventions (runtime table creation) that trade long-term cleanliness for shipping speed — with a well-defined four-role permission model and a genuinely interesting payroll/absences/offset computation layer.