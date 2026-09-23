# WAH Payroll — User Onboarding Guide

> Everything you need to install, log in, and use the WAH Payroll application — written for end users, Admins, HR, and Supervisors.

---

## Table of Contents

1. [What you can do with this app](#1-what-you-can-do-with-this-app)
2. [Roles at a glance](#2-roles-at-a-glance)
3. [Installation & running locally](#3-installation--running-locally)
4. [Logging in](#4-logging-in)
5. [The workspace (sidebar & layout)](#5-the-workspace-sidebar--layout)
6. [For Rank-and-File employees](#6-for-rank-and-file-employees)
7. [For Supervisors](#7-for-supervisors)
8. [For HR](#8-for-hr)
9. [For Admins](#9-for-admins)
10. [Module how-to guides](#10-module-how-to-guides)
11. [Common workflows](#11-common-workflows)
12. [Settings & profile](#12-settings--profile)
13. [Troubleshooting & FAQ](#13-troubleshooting--faq)
14. [Glossary](#14-glossary)

---

## 1. What you can do with this app

WAH Payroll is the central HR portal for **Wireless Access for Health**. In one place you can:

- View your personal dashboard with KPIs (headcount, attendance, pending requests, leave balances).
- **File and track leave**, **offset applications**, and **resignations**.
- See your **attendance**, **pay slips**, and **salary history**.
- (HR/Admin/Supervisor) Manage **employees**, record **attendance**, **approve requests**, generate **payroll**, and run **reports**.

It is a web app — open it in any modern browser (Chrome/Edge/Firefox). It runs inside your network/intranet (or the deployed Vercel URL) and requires a valid login.

---

## 2. Roles at a glance

| Role            | What they can do                                                                                                    | Main pages                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Admin**       | Everything: employees, attendance, payroll generation & adjustments, reports, reset payroll, file templates         | Dashboard, Employees, Attendance, Applications, Payroll, Reports, Settings, File Management    |
| **HR**          | Manage employees, record attendance, approve requests + add HR notes, view payroll, run HR reports, send payslips   | HR Dashboard, Employees, Attendance, Applications, Payroll, Reports, Payslips, File Management |
| **Supervisor**  | View employees/attendance in their department, approve/reject requests from their team, view payslips               | Dashboard, Employees, Attendance, Applications, Payslips, File Management                      |
| **RankAndFile** | Self-service only: own dashboard, own leave/offset/resignation applications, own payslips & reports, file downloads | Dashboard, Applications, My Payslips, Reports (My), File Management                            |

> **Reminder:** NaI he sidebar may differ slightly per role — what you don't see, you can't access. Backend role checks also guard every API call.

---

## 3. Installation & running locally

### Prerequisites

- **Node.js 18+** and npm on your machine.
- **MySQL 8** running locally (or reachable), e.g. XAMPP/WAMP or a standalone server.
- (Optional, for file uploads & payslip emails) Cloudflare R2 / S3 credentials and a Gmail app-password.

### Step 1 — Install dependencies

At the **repository root** and in each app folder:

```bash
# from G:\Downloads\wah-payroll-main
npm install
cd client && npm install
cd ../server && npm install
```

### Step 2 — Configure the server environment

Copy `server/.env.example` to `server/.env` and fill it in:

```env
BACKEND_PORT=8000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=wahpayroll

# REQUIRED - the app will not start without these
JWT_SECRET=<a-long-random-string>
JWT_REFRESH=<another-long-random-string>

ADMIN_DEFAULT_PASSWORD=

EMAIL_USER=
EMAIL_PASS=
S3_BUCKET_NAME=payroll
S3_REGION=us-east-1
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

### Step 3 — Create the database (once)

```bash
# If the `wahpayroll` database doesn't exist yet:
mysql -u root -e "CREATE DATABASE IF NOT EXISTS wahpayroll CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

The app (and the seed script) will **create all tables automatically** on first run — no manual import needed.

### Step 4 — (Optional) Load sample data

To fill the app with realistic fake data for testing/demos:

```bash
cd server
npm run seed
```

This creates 37 employees (Admin / HR / Supervisors / Rank & File), attendance history, leave requests, offsets, salary adjustments, payroll across the last 3 months, resignations, and notifications. Re-running it **wipes and regenerates** everything. Add `--keep` to skip the wipe.

### Step 5 — Configure the client

`client/.env` already points at `http://localhost:8000`:

```env
VITE_API_URL=http://localhost:8000
```

> **Note:** the server's CORS currently allows only one origin (`https://payroll-silk-nu.vercel.app`). For local dev, temporarily relax `origin` in `server/src/index.js` (e.g. `origin: true`) or you'll see blocked requests from `localhost:5173`.

### Step 6 — Run it

```bash
# Terminal 1 — backend
cd server
npm run dev        # starts API on http://localhost:8000

# Terminal 2 — frontend
cd client
npm run dev        # starts UI on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## 4. Logging in

The **username is your first name** (spaces removed, case-insensitive). The password is given to you by HR/Admin.

| Field    | What to type                                                                     |
| -------- | -------------------------------------------------------------------------------- |
| Username | Your first name only, e.g. `Kiara` → type `kira` (auto-strips spaces/lowercases) |
| Password | Your assigned password (see below)                                               |

### Default / first-time passwords

- If you log in for the very first time and have no password set, use the **auto-generated password**:
  `empID + firstname` with no spaces — e.g. employee `EMP-001` named `Duane` logs in with username `duane` and password `EMP-001Duane`.
- **Admin** may also use the `ADMIN_DEFAULT_PASSWORD` set in the server `.env` as a fallback.
- After first login, change your password from **Settings**.

### Sample accounts (after `npm run seed`)

| Role        | Username   | Password          |
| ----------- | ---------- | ----------------- |
| Admin       | `admin`    | `ADMIN-001Admin`  |
| HR          | `kira`     | `HR-001Kira`      |
| Supervisor  | `adelbert` | `SUP-001Adelbert` |
| Rank & File | `duane`    | `EMP-001Duane`    |

> You're redirected to `/hr-dashboard` if you log in as HR, otherwise `/dashboard`.

---

## 5. The workspace (sidebar & layout)

After logging in you land in a purple-themed workspace:

- **Sidebar (left):** role-based navigation (see the table in section 2). The active page is highlighted.
- **Header/top bar:** page title and quick actions.
- **Bottom of sidebar:** your avatar, name, role, and the **Log out** button.
- Most pages show cards/tables with search bars and filter dropdowns.

Your session token lasts **8 days** and refreshes automatically in the background. If it expires, you'll be returned to the login screen.

---

## 6. For Rank-and-File employees

### Dashboard

- Summary cards for your **leave balance**, **offset credits**, **attendance**, and any **pending requests**.
- Your **notifications** (request approvals/rejections, HR notes) appear here — use the bell/notification list to check status.

### Applications (Leave, Offset & Resignation)

- **Leave:** file Vacation, Sick, Birthday, PGT Leave, or Offset. Upload the required **OCP file** with your request.
- **Offset applications:** file for flexi-leave credits you earned from working extra days.
- **Resignation:** a guided flow (multi-step wizard) to file your resignation, with a 16-question exit interview form.
- Track each request's status: **Pending → Approved / Denied / Partially Approved**.
- You can **request cancellation** of a request while it's still pending, and HR can add notes to your requests.

### My Payslips

- View/download your monthly payslip PDFs generated by Admin/HR.

### Reports (My Reports)

- Your personal attendance and leave summaries.

### File Management

- Browse and download company **file templates** (forms, guidelines) published by Admin/HR.
- See which of your **required documents** are on file or missing.

### Settings

- Edit your profile info, upload/change your **profile photo**, and **change your password**.

---

## 7. For Supervisors

Everything in the supervisor's sidebar, plus:

### Employees

- View the roster (read-only). Focus is your own team.

### Attendance

- View the attendance **calendar/summary** for your department and daily attendance listings. You cannot write records — this is Admin/HR's job.

### Applications

- See leave & offset requests filed **by you OR by people in your department (`designation`)**.
- **Approve / Deny / Partially approve** leave and offset applications from the list.
- Review and approve **resignations**; add resolution remarks.
- Decide on **cancellation requests** from employees.

### Payslips

- View your own payslips.

---

## 8. For HR

### HR Dashboard

- Headcount, open requests needing your attention, attendance overview, trends.

### Employees

- **Create** employees (fills in gov't numbers: SSS, TIN, PhilHealth, Pag-IBIG, GSIS, plus DOB, hired date).
- **Edit** employees, view salary by position, mark **missing documents**, adjust a **leave balance** (`Leave Balance` action).

### Attendance

- Use the **bulk attendance** entry to record a full day's roster per employee (Present / Late / Absent / Undertime / Half-Day / On Leave / Field). Saves as one batch.

### Applications

- Approve/reject requests.
- **Add an HR note** to any pending request (leave, offset, resignation) — the employee gets a notification.
- Handle employee **clearance uploads** for resignations.

### Payroll & Payslips

- **View payroll** data (read-only; only Admin generates it).
- **Send payslips** to employees (individually or in bulk) as PDF email attachments.

### Reports

- HR Reports: **Leave**, **Attendance**, and **Leave/Balance** views, exported for record-keeping.

### File Management

- **Upload** reusable file templates, **replace** or **delete** them, and see the inventory of who has/hasn't submitted documents.

---

## 9. For Admins

Admins can do everything HR does **plus** the money and configuration controls:

### Payroll

- **Generate payroll** for a selected month. This snapshots every non-Admin employee's pay:
  - `gross = basic_pay + incentives (Bonus/Increase)`
  - `net = gross − deductions (Decrease)`
  - Re-running for the same month **replaces** the snapshot safely.
- **Send payslips** individually or **in bulk**.
- **Reset payroll** — wipes all payroll + salary-history records (use carefully; "start over").

### Salary & adjustments

- **Apply salary adjustment** (`Increase` / `Decrease` / `Bonus`) to any employee for a given month.
- **Edit / delete** salary-history entries.
- **Update base salary by position** — sets the default monthly salary that _future_ employees in that position inherit.

### Configuration

- **Workweek configs:** create/update/delete `5-day` or `4-day` workweek settings (hours/day and absence unit). These change how absences convert to deductions. Versioned by `effective_from`.

### Reports

- **Payroll Reports** (`/payroll-reports`): executive payroll summaries.
- HR Reports and dashboards as with HR.

### File templates & missing docs

- Upload/update/delete templates and manage each employee's missing-document list.

---

## 10. Module how-to guides

### 10.1 Employees

**Create an employee (HR/Admin)**

1. Go to **Employees** → **Add employee**.
2. Fill in first/last name, position, designation, employment status, salary (auto-suggests by position), contact details, and government numbers.
3. Save. The system auto-generates an initial password (`empID + firstname`).

**Edit** — open an employee, change fields, save.
**Delete (Admin)** — removes the employee and cascades their attendance, leaves, payroll, etc.

### 10.2 Attendance (Admin/HR)

1. Go to **Attendance**, pick a **date**.
2. Use **bulk save**: choose each employee's status for that day, then save (re-saves replace that day's records).
3. Use the **calendar/summary** and **daily** views to review.
   > Statuses: Present, Late, Absent, Undertime, Half-Day, On Leave, Field.

### 10.3 Leave (all employees)

1. **Applications** → **File Leave**.
2. Choose **leave type** (Vacation, Sick, Birthday, PGT, or Offset), **from/to dates**, priority, reason, and upload the **OCP** document.
3. Submit → status **Pending**.
4. Wait for Supervisor/HR approval. Watch your **notifications** and **dashboard** for status changes.
5. Your **leave balance** updates automatically when approved (27 days/yr; 12 for Job Order/PGT).

### 10.4 Offsets (all employees)

1. **Applications** → File an **offset application** with dates and days applied.
2. Approved offsets credit your **offset balance** (see `offset_ledger` on the dashboard).
3. Watch for approvals or denial with supervisor remarks.

### 10.5 Resignation flow (all employees)

1. **Applications** → Resignation → complete the **multi-step wizard** (details, letter, reasons, and the **16 exit-interview questions**).
2. The draft auto-saves so you can resume later.
3. Submit → status **Pending Approval**. Supervisor/Admin reviews.
4. Upload your **clearance** document when requested.

### 10.6 Payroll (Admin)

1. Go to **Payroll** → top-right **Generate Payroll**.
2. Select the **month** (e.g. `2026-09`) → Generate.
3. Verify: basic pay, incentives, deductions, gross, net per employee.
4. **Payroll Reports** give you the month's totals.

### 10.7 Payslips (HR/Admin)

- From Payroll, pick an employee → **Send Payslip**, or use **Send All** for bulk.
- The server renders each payslip as a **PDF (Puppeteer)** and **emails it via Gmail/Nodemailer**.

### 10.8 Reports

- **HR Reports** (`/reports`): Leave / Attendance / Balance tabs; each shows a table you can print or export.
- **My Reports** (RankAndFile): your personal summary.
- **Payroll Reports** (Admin only).

### 10.9 File Management

- Employees: browse/download templates.
- HR/Admin: **Upload** (pick a title/category + file), **Replace**, **Delete**. Files are stored in the database and served back for download.
- Admins see the **inventory** of who uploaded which documents.

### 10.10 Notifications

- The bell/list in your dashboard collects system events: new/failed leave, approvals, HR notes on your requests, attendance alerts.
- Mark as **read**, mark **all read**, or **delete** individual notifications.

---

## 11. Common workflows

### "I want to take a vacation next month"

1. **Applications → Leave** → Vacation Leave → pick dates → reason → upload OCP → submit.
2. Wait for approval (check notifications).
3. After approval, your leave balance drops automatically.

### "I'm a supervisor and approve my team's requests"

1. **Applications** → open the Pending request.
2. Choose **Approve** (or **Deny / Partially approve** with remarks).
3. Employee gets a notification.

### "I need to run payroll at month-end" (Admin)

1. **Payroll** → apply any **salary adjustments** first (bonuses, deductions — Admin → Salary).
2. **Generate Payroll** → select month → generate.
3. Review the totals, then **Send Bulk Payslips**.

### "A new hire starts Monday" (HR/Admin)

1. **Employees → Add** → fill position (salary auto-fills from position settings) → save.
2. Give them their first-name username and initial password `empID + firstname`.
3. Tell them to change their password in **Settings** after logging in.

### "An employee forgot their password" (Admin)

1. **Employees** → the employee → **Reset Password**.
2. The password returns to the standard auto password (`empID + firstname`).

---

## 12. Settings & profile

- **Profile:** edit name/contact info; upload a **profile photo** (`avatar-<emp_id>-<timestamp>.png` stored on the server).
- **Password:** verify current password → set new one (bcrypt-hashed going forward).

---

## 13. Troubleshooting & FAQ

| Problem                                        | Fix                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Invalid username or password"**             | Username is your **first name only**. Password is `empID + firstname` initially (e.g. `EMP-001Duane`) or your changed password. Case-sensitive password. |
| **Login works but app is blank / CORS errors** | Dev only: server CORS is locked to the Vercel origin. Relax `origin` in `server/src/index.js`.                                                           |
| **"App will not start" / JWT secrets missing** | Set `JWT_SECRET` and `JWT_REFRESH` in `server/.env`.                                                                                                     |
| **Log in as HR goes to the wrong page**        | HR is routed to `/hr-dashboard` automatically; you can still navigate normally.                                                                          |
| **No payslip received by email**               | Payslips require `EMAIL_USER`/`EMAIL_PASS` (Gmail app password) and puppeteer to work; also check the employee's email on file.                          |
| **File upload fails**                          | S3/R2 access keys must be configured (`S3_*` env vars) or files are stored in DB/local `uploads/`.                                                       |
| **Payroll numbers look off**                   | Check `salary_history` for that month (increases/bonuses/decreases) — payroll is recomputed from it.                                                     |
| **Leave documents won't preview**              | `getAllLeaves` returns a 1-hour **pre-signed S3 URL**; if expired, just reload the list.                                                                 |
| **Duplicate first names**                      | Two employees with the same first name conflict at login (only the first match is used). Ask HR/Admin to differentiate names.                            |

---

## 14. Glossary

| Term                        | Meaning                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| **OCP**                     | A supporting document upload required when filing leave (stored in S3 under `OCP/<emp_id>/…`).    |
| **Offset**                  | Flexi-leave credits earned for working extra days; can be "used" to cover absences.               |
| **PGT**                     | A special employee program; PGT employees get 12 leave days and can't be Job Order + PGT at once. |
| **Job Order**               | Contractual employment status; leave allocation = 12 days.                                        |
| **Workweek config**         | `5-day` (8h/day) or `4-day` (10h/day) schedule used to convert absences into deductions.          |
| **Partially Approved**      | A request approved for fewer days than originally filed.                                          |
| **Pre-signed URL**          | A time-limited URL the server generates so the browser can securely download an S3 object.        |
| **basic_pay / gross / net** | Base monthly salary / base + incentives / gross − deductions.                                     |

---

_Need help? Contact your HR or system administrator. Internal use only._
