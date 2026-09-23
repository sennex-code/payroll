import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import pool from "../src/config/db.js";

faker.seed(42);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema.sql");

const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (d, n) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

const pick = (arr) => faker.helpers.arrayElement(arr);
const weighted = (entries) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = faker.number.int({ min: 1, max: total });
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
};

const weekdaysBetween = (fromStr, toStr) => {
  const dates = [];
  let cur = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T00:00:00`);
  while (cur <= end) {
    if (!isWeekend(cur)) dates.push(fmt(cur));
    cur = addDays(cur, 1);
  }
  return dates;
};

const daysBetween = (fromStr, toStr) => {
  const from = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T00:00:00`);
  return Math.round((end - from) / 86400000) + 1;
};

const uniqueUsername = (used) => {
  let first = "";
  for (let i = 0; i < 50; i++) {
    first = faker.person.firstName();
    const key = first.replace(/\s+/g, "").toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      return first;
    }
  }
  first = `${first}${faker.number.int({ min: 2, max: 99 })}`;
  used.add(first.replace(/\s+/g, "").toLowerCase());
  return first;
};

const runSchema = async () => {
  const raw = readFileSync(schemaPath, "utf8");
  const noComments = raw
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  for (const stmt of noComments.split(";")) {
    const trimmed = stmt.trim();
    if (trimmed) await pool.query(trimmed);
  }
};

const columnExists = async (table, column) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0].c) > 0;
};

const ensureColumn = async (table, column, definition) => {
  if (!(await columnExists(table, column))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
};

const ensureRuntimeColumns = async () => {
  await ensureColumn("attendance", "status2", "VARCHAR(50) NULL");
  await ensureColumn("leave_requests", "supervisor_remarks", "TEXT NULL");
  await ensureColumn("leave_requests", "hr_note", "TEXT NULL");
  await ensureColumn("leave_requests", "ocp", "VARCHAR(512) NULL");
};

const wipe = async () => {
  const tables = [
    "notifications",
    "employee_missing_docs",
    "file_templates",
    "stored_files",
    "resignation_drafts",
    "resignations",
    "offset_applications",
    "offset_ledger",
    "salary_history",
    "payroll",
    "leave_requests",
    "leave_balances",
    "attendance",
    "workweek_configs",
    "position_salary_settings",
    "employees",
  ];
  const [existing] = await pool.query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const existingNames = new Set(existing.map((r) => r.name));
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of tables) {
    if (existingNames.has(t)) await pool.query(`TRUNCATE TABLE \`${t}\``);
  }
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
};

const POSITION_CATALOG = [
  { position: "admin & human resources partner", designation: "operations", base: 48000 },
  { position: "supervisor (operations)", designation: "operations", base: 38000 },
  { position: "supervisor (finance)", designation: "operations", base: 37000 },
  { position: "supervisor (field services)", designation: "operations", base: 36000 },
  { position: "supervisor (it)", designation: "operations", base: 39000 },
  { position: "senior developer", designation: "technology", base: 36000 },
  { position: "junior developer", designation: "technology", base: 22000 },
  { position: "it support specialist", designation: "technology", base: 23000 },
  { position: "accountant", designation: "finance", base: 30000 },
  { position: "payroll clerk", designation: "finance", base: 19000 },
  { position: "hr assistant", designation: "operations", base: 20000 },
  { position: "field coordinator", designation: "operations", base: 21000 },
  { position: "administrative assistant", designation: "operations", base: 17000 },
  { position: "operations associate", designation: "operations", base: 18500 },
  { position: "driver", designation: "operations", base: 16000 },
  { position: "security guard", designation: "operations", base: 15000 },
];

const EMPLOYEE_STATUSES = [
  ["Regular", 55],
  ["Probationary", 15],
  ["Job Order", 18],
  ["PGT Employee", 12],
];

const UNITS = ["operations", "finance", "field services", "it"];

const GOV_PREFIX = () => ({
  sss_no: `${faker.number.int({ min: 10, max: 34 })}-${faker.string.numeric(7)}-${faker.number.int({ min: 0, max: 9 })}`,
  philhealth_no: `${faker.string.numeric(2)}-${faker.string.numeric(9)}-${faker.number.int({ min: 0, max: 9 })}`,
  tin: `${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(3)}`,
  pag_ibig_mid_no: faker.string.numeric(12),
  pag_ibig_rtn: faker.string.numeric(4),
  gsis_no: faker.string.numeric(11),
});

const makeEmployees = (usedNames, usedEmails) => {
  const employees = [];
  const usedIds = new Set();

  const add = (empId, overrides = {}) => {
    if (usedIds.has(empId)) return;
    usedIds.add(empId);
    const first = overrides.first_name ?? uniqueUsername(usedNames);
    const last = overrides.last_name ?? faker.person.lastName();
    let email = overrides.email ?? `${first}.${last}@example.com`.toLowerCase().replace(/[^a-z0-9.@]/g, "");
    let n = 2;
    while (usedEmails.has(email)) {
      email = `${first}.${last}${n}@example.com`.toLowerCase().replace(/[^a-z0-9.@]/g, "");
      n += 1;
    }
    usedEmails.add(email);

    const hired = overrides.hired_date ?? fmt(faker.date.between({ from: "2018-01-01", to: "2026-05-01" }));
    const dob = fmt(faker.date.birthdate({ min: 22, max: 58 }));

    employees.push({
      emp_id: empId,
      first_name: first,
      last_name: last,
      middle_initial: faker.string.alpha().toUpperCase().slice(0, 1),
      designation: "operations",
      position: "operations associate",
      status: "Regular",
      email,
      dob,
      hired_date: hired,
      basic_pay: 18000,
      role: "RankAndFile",
      ...GOV_PREFIX(),
      ...overrides,
    });
  };

  add("ADMIN-001", {
    first_name: "Admin",
    last_name: "User",
    email: "admin@wah.local",
    designation: "operations",
    position: "admin & human resources partner",
    status: "Regular",
    role: "Admin",
    basic_pay: 60000,
    hired_date: "2018-01-08",
    dob: "1985-04-12",
    sss_no: "34-1234567-8",
    philhealth_no: "12-345678901-2",
    tin: "123-456-789-000",
    pag_ibig_mid_no: "123456789012",
    pag_ibig_rtn: "0000",
    gsis_no: "12345678901",
  });

  for (let i = 1; i <= 2; i++) {
    const empId = `HR-${String(i).padStart(3, "0")}`;
    const cat = POSITION_CATALOG[0];
    add(empId, {
      designation: cat.designation,
      position: cat.position,
      status: "Regular",
      role: "HR",
      basic_pay: cat.base + faker.number.int({ min: -2000, max: 4000 }),
    });
  }

  for (let i = 1; i <= 4; i++) {
    const empId = `SUP-${String(i).padStart(3, "0")}`;
    const unit = UNITS[(i - 1) % UNITS.length];
    const cat = POSITION_CATALOG.find((p) => p.position === `supervisor (${unit})`) || POSITION_CATALOG[1];
    add(empId, {
      designation: cat.designation,
      position: cat.position,
      status: "Regular",
      role: "Supervisor",
      basic_pay: cat.base + faker.number.int({ min: -1500, max: 3000 }),
    });
  }

  const rankPositions = POSITION_CATALOG.slice(5);
  for (let i = 1; i <= 30; i++) {
    const empId = `EMP-${String(i).padStart(3, "0")}`;
    const cat = pick(rankPositions);
    const status = weighted(EMPLOYEE_STATUSES);
    add(empId, {
      designation: cat.designation,
      position: cat.position,
      status,
      role: "RankAndFile",
      basic_pay: cat.base + faker.number.int({ min: -1500, max: 2500 }),
    });
  }

  return employees.map((e) => ({
    ...e,
    basic_pay: Math.round(e.basic_pay / 50) * 50,
  }));
};

const seedPositionSettings = async (employees) => {
  const seen = new Map();
  for (const e of employees) {
    if (!seen.has(e.position)) seen.set(e.position, e.basic_pay);
  }
  for (const [position, amount] of seen) {
    await pool.query(
      `INSERT INTO position_salary_settings (position, amount) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [position, amount],
    );
  }
  return seen.size;
};

const seedWorkweek = async () => {
  await pool.query(
    `INSERT INTO workweek_configs (workweek_type, effective_from, effective_to, hours_per_day, absence_unit)
     VALUES ('5-day', '2026-01-01', NULL, 8, 1)
     ON DUPLICATE KEY UPDATE workweek_type = '5-day'`,
  );
};

const seedEmployees = async (employees) => {
  for (const e of employees) {
    const password = await bcrypt.hash(`${e.emp_id}${e.first_name.replace(/\s+/g, "")}`, 10);
    await pool.query(
      `INSERT INTO employees
        (emp_id, first_name, last_name, middle_initial, designation, position, status, email,
         philhealth_no, tin, sss_no, pag_ibig_mid_no, pag_ibig_rtn, gsis_no, dob, hired_date,
         password, basic_pay, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.emp_id, e.first_name, e.last_name, e.middle_initial, e.designation, e.position,
        e.status, e.email, e.philhealth_no, e.tin, e.sss_no, e.pag_ibig_mid_no,
        e.pag_ibig_rtn, e.gsis_no, e.dob, e.hired_date, password, e.basic_pay, e.role,
      ],
    );
  }
};

const LEAVE_TYPES = [
  "Birthday Leave",
  "Vacation Leave",
  "Sick Leave",
  "PGT Leave",
  "Offset",
];

const LEAVE_REASONS = [
  "Family commitment out of town.",
  "Medical check-up and recovery.",
  "Rest and recharging after a heavy project week.",
  "Attending a relative's wedding.",
  "Home repair requires presence.",
  "Annual vacation with family.",
  "Child's school activity.",
  "Dental appointment previously scheduled.",
  "Personal errands that cannot be done on weekends.",
  "Flu symptoms, resting at home.",
];

const seedLeaveRequests = async (employees, supervisors) => {
  const requests = [];
  const today = new Date();
  const startWindow = addDays(today, -90);

  for (let i = 0; i < 60; i++) {
    const emp = pick(employees.filter((e) => e.role !== "Admin"));
    const leaveType = pick(LEAVE_TYPES);
    const from = faker.date.between({ from: startWindow, to: addDays(today, -2) });
    const maxSpan = leaveType === "Birthday Leave" ? 1 : leaveType === "Offset" ? 4 : 7;
    const span = faker.number.int({ min: 1, max: maxSpan });
    const dateFrom = fmt(from);
    const dateTo = fmt(addDays(from, span - 1));
    const rawDays = daysBetween(dateFrom, dateTo);
    const weekdays = weekdaysBetween(dateFrom, dateTo).length || rawDays;

    const status = weighted([
      ["Approved", 45],
      ["Pending", 20],
      ["Partially Approved", 20],
      ["Denied", 15],
    ]);

    const approvedDates = weekdaysBetween(dateFrom, dateTo);
    let approvedDays = null;
    let approvedDatesJson = null;
    if (status === "Approved") {
      approvedDays = weekdays;
      approvedDatesJson = JSON.stringify(approvedDates);
    } else if (status === "Partially Approved") {
      approvedDays = faker.number.float({ min: 1, max: Math.max(weekdays - 1, 1), precision: 0.5 });
      approvedDatesJson = JSON.stringify(approvedDates.slice(0, Math.ceil(approvedDays)));
    }

    const supervisor = pick(supervisors);
    const remarks =
      status === "Denied"
        ? "Denied due to coverage requirements during that period."
        : status === "Pending"
          ? null
          : "Approved. Please coordinate handover before leaving.";

    const [result] = await pool.query(
      `INSERT INTO leave_requests
        (emp_id, leave_type, date_from, date_to, priority, status, approved_days, approved_dates,
         reason, supervisor_remarks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emp.emp_id, leaveType, dateFrom, dateTo,
        pick(["Low", "Normal", "High"]),
        status, approvedDays, approvedDatesJson,
        pick(LEAVE_REASONS), remarks,
        new Date(from.getTime() - faker.number.int({ min: 1, max: 10 }) * 86400000),
      ],
    );
    requests.push({
      id: result.insertId,
      emp_id: emp.emp_id,
      leave_type: leaveType,
      date_from: dateFrom,
      date_to: dateTo,
      status,
      approved_days: Number(approvedDays || 0),
      supervisor: supervisor.emp_id,
    });
  }
  return requests;
};

const seedLeaveBalances = async (employees, requests) => {
  for (const e of employees) {
    const allocation = ["job order", "pgt employee", "pgt"].includes(
      String(e.status || "").trim().toLowerCase(),
    )
      ? 12
      : 27;
    const used = requests
      .filter(
        (r) =>
          r.emp_id === e.emp_id &&
          (r.status === "Approved" || r.status === "Partially Approved"),
      )
      .reduce((sum, r) => sum + r.approved_days, 0);
    const balance = Math.max(allocation - used, 0);
    await pool.query(
      `INSERT INTO leave_balances (emp_id, leave_balance, offset_credits)
       VALUES (?, ?, ?)`,
      [e.emp_id, balance.toFixed(2), faker.number.float({ min: 0, max: 5, precision: 0.5 })],
    );
  }
};

const seedAttendance = async (employees) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const end = addDays(today, -1);
  const statuses = [
    ["Present", 72],
    ["Late", 10],
    ["Absent", 6],
    ["Undertime", 4],
    ["Half-Day", 3],
    ["Field", 3],
    ["On Leave", 2],
  ];

  let count = 0;
  for (const e of employees) {
    const hired = new Date(`${e.hired_date}T00:00:00`);
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      if (isWeekend(d)) continue;
      if (d < hired) continue;
      const status = weighted(statuses);
      const status2 =
        faker.helpers.maybe(
          () => pick(["Present", "Field", "Undertime"]),
          { probability: 0.08 },
        ) ?? null;
      await pool.query(
        `INSERT IGNORE INTO attendance (emp_id, date, status, status2)
         VALUES (?, ?, ?, ?)`,
        [e.emp_id, fmt(d), status, status2],
      );
      count += 1;
    }
  }
  return count;
};

const OFFSET_REASONS = [
  "Worked Saturdays during the mid-year push.",
  "Covered a holiday shift for the team.",
  "Overtime weekends during the system migration.",
  "Extended field deployment last month.",
];

const seedOffsets = async (employees, supervisors) => {
  const today = new Date();
  let applications = 0;
  let ledgerRows = 0;

  for (let i = 0; i < 15; i++) {
    const emp = pick(employees.filter((e) => e.role !== "Admin"));
    const from = faker.date.between({ from: addDays(today, -75), to: addDays(today, -3) });
    const daysApplied = faker.number.float({ min: 1, max: 3, precision: 0.5 });
    const dateFrom = fmt(from);
    const dateTo = fmt(addDays(from, Math.ceil(daysApplied) - 1));
    const status = weighted([
      ["Approved", 50],
      ["Pending", 25],
      ["Partially Approved", 15],
      ["Denied", 10],
    ]);
    const supervisor = pick(supervisors);
    await pool.query(
      `INSERT INTO offset_applications
        (emp_id, date_from, date_to, days_applied, reason, status, approved_days,
         supervisor_emp_id, supervisor_remarks, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emp.emp_id, dateFrom, dateTo, daysApplied, pick(OFFSET_REASONS), status,
        status === "Approved" ? daysApplied : status === "Partially Approved" ? Math.max(daysApplied - 1, 0.5) : null,
        supervisor.emp_id,
        status === "Pending" ? null : status === "Denied" ? "Insufficient offset credits." : "Approved.",
        status === "Approved" || status === "Partially Approved" ? new Date() : null,
      ],
    );
    applications += 1;
  }

  const periods = [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
  ];
  for (const e of employees.filter((em) => em.role !== "Admin")) {
    for (const p of periods) {
      const workingDays = 22;
      const earned = faker.number.float({ min: 0, max: 3, precision: 0.5 });
      const used = faker.number.float({ min: 0, max: 2, precision: 0.5 });
      const carried = faker.number.float({ min: 0, max: 2, precision: 0.5 });
      const finalBalance = Math.max(carried + earned - used, 0);
      const status = weighted([
        ["Approved", 70],
        ["Pending", 15],
        ["Draft", 10],
        ["Rejected", 5],
      ]);
      await pool.query(
        `INSERT INTO offset_ledger
          (emp_id, period_year, period_month, working_days_completed, baseline_days,
           offset_earned, offset_used, carried_over, final_balance, status, supervisor_emp_id,
           supervisor_remarks, approved_at)
         VALUES (?, ?, ?, ?, 22, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.emp_id, p.year, p.month, workingDays, earned, used, carried, finalBalance,
          status, pick(supervisors).emp_id,
          status === "Approved" ? "Reviewed and approved." : status === "Rejected" ? "Baselines not met." : null,
          status === "Approved" ? new Date() : null,
        ],
      );
      ledgerRows += 1;
    }
  }
  return { applications, ledgerRows };
};

const INCREASE_DESC = [
  "Annual merit increase",
  "Promotion adjustment",
  "Step increment",
];
const BONUS_DESC = [
  "Performance bonus",
  "Attendance incentive",
  "Project completion bonus",
  "13th month advance",
];
const DECREASE_DESC = [
  "Cash advance repayment",
  "Late penalties",
  "Uniform deduction",
  "SSS loan repayment",
  "Pag-IBIG loan repayment",
];

const seedSalaryHistory = async (employees) => {
  const entries = [];
  const months = ["2026-07", "2026-08", "2026-09"];
  const pool_ = employees.filter((e) => e.role !== "Admin");

  for (let i = 0; i < 50; i++) {
    const emp = pick(pool_);
    const month = pick(months);
    const day = faker.number.int({ min: 1, max: 25 });
    const effective = `${month}-${String(day).padStart(2, "0")}`;
    const type = weighted([
      ["Bonus", 40],
      ["Increase", 30],
      ["Decrease", 30],
    ]);
    const amount =
      type === "Increase"
        ? faker.number.int({ min: 1000, max: 5000 })
        : type === "Bonus"
          ? faker.number.int({ min: 500, max: 10000 })
          : faker.number.int({ min: 200, max: 2500 });

    const description =
      type === "Increase" ? pick(INCREASE_DESC) : type === "Bonus" ? pick(BONUS_DESC) : pick(DECREASE_DESC);

    const [result] = await pool.query(
      `INSERT INTO salary_history (emp_id, effective_date, type, amount, description, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        emp.emp_id, effective, type, amount, description,
        faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
      ],
    );
    entries.push({ id: result.insertId, emp_id: emp.emp_id, effective, type, amount });
  }
  return entries;
};

const seedPayroll = async (employees, salaryEntries) => {
  const today = new Date();
  const periods = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  let count = 0;
  for (const period of periods) {
    const periodStart = `${period}-01`;
    for (const e of employees) {
      if (e.role === "Admin") continue;
      const basicPay = Number(e.basic_pay || 0);
      const monthEntries = salaryEntries.filter(
        (s) => s.emp_id === e.emp_id && s.effective.startsWith(period),
      );
      const incentives = monthEntries
        .filter((s) => s.type === "Bonus" || s.type === "Increase")
        .reduce((sum, s) => sum + Math.abs(s.amount), 0);
      const deductions = monthEntries
        .filter((s) => s.type === "Decrease")
        .reduce((sum, s) => sum + Math.abs(s.amount), 0);
      const grossPay = Number((basicPay + incentives).toFixed(2));
      const netPay = Number((grossPay - deductions).toFixed(2));

      await pool.query(
        `INSERT INTO payroll
          (emp_id, period_start, basic_pay, absences_count, absence_deductions, incentives, gross_pay, net_pay)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           basic_pay = VALUES(basic_pay),
           absence_deductions = VALUES(absence_deductions),
           incentives = VALUES(incentives),
           gross_pay = VALUES(gross_pay),
           net_pay = VALUES(net_pay)`,
        [e.emp_id, periodStart, basicPay, deductions.toFixed(2), incentives.toFixed(2), grossPay, netPay],
      );
      count += 1;
    }
  }
  return count;
};

const RESIGNATION_TYPES = [
  "Voluntary Resignation",
  "Health Reasons",
  "Relocation",
  "Career Change",
  "Further Education",
  "Other",
];

const EXIT_QUESTIONS = [
  "What prompted your decision to resign?",
  "How would you describe your relationship with your supervisor?",
  "How would you describe teamwork in your department?",
  "What did you enjoy most about your role?",
  "What did you enjoy least about your role?",
  "How was your workload managed?",
  "Was feedback constructive and timely?",
  "How was communication within the team?",
  "Did you have the tools needed to succeed?",
  "How was the onboarding experience?",
  "What could the company improve?",
  "Would you recommend this company to others?",
  "Would you consider returning in the future?",
  "How was compensation relative to expectations?",
  "What skills did you develop here?",
  "Any final comments?",
];

const seedResignations = async (employees, supervisors) => {
  const today = new Date();
  const candidates = faker.helpers.arrayElements(
    employees.filter((e) => e.role === "RankAndFile"),
    3,
  );
  let count = 0;

  for (const emp of candidates) {
    const effective = fmt(faker.date.between({ from: addDays(today, -30), to: addDays(today, 45) }));
    const status = weighted([
      ["Pending Approval", 40],
      ["Approved", 40],
      ["Rejected", 20],
    ]);
    const supervisor = pick(supervisors);
    const answers = EXIT_QUESTIONS.map((q) => ({
      question: q,
      answer: faker.lorem.sentence(),
    }));
    const reasons = faker.helpers.arrayElements(
      ["Better compensation", "Career growth", "Relocation", "Work-life balance", "Health", "Further studies"],
      faker.number.int({ min: 1, max: 3 }),
    );

    await pool.query(
      `INSERT INTO resignations
        (emp_id, resignation_type, effective_date, reason, resignation_letter, recipient_name,
         recipient_emp_id, resignation_date, last_working_day, leaving_reasons_json,
         leaving_reason_other, exit_interview_answers_json, current_step, status,
         reviewed_by, review_remarks, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?, ?, ?)`,
      [
        emp.emp_id,
        pick(RESIGNATION_TYPES),
        effective,
        faker.lorem.paragraph(2),
        faker.lorem.paragraphs(2, "\n\n"),
        `${supervisor.first_name} ${supervisor.last_name}`,
        supervisor.emp_id,
        fmt(addDays(new Date(`${effective}T00:00:00`), -14)),
        effective,
        JSON.stringify(reasons),
        "",
        JSON.stringify(answers),
        status,
        status === "Pending Approval" ? null : supervisor.emp_id,
        status === "Rejected" ? "Position can be discussed further before leaving." : "Approved with regret.",
        status === "Pending Approval" ? null : new Date(),
      ],
    );
    count += 1;
  }
  return count;
};

const seedMissingDocs = async (employees) => {
  const docPool = [
    "Police Clearance",
    "NBI Clearance",
    "Barangay Clearance",
    "PSA Birth Certificate",
    "Medical Certificate",
    "SSS E1 Form",
    "Diploma Copy",
  ];
  const targets = faker.helpers.arrayElements(
    employees.filter((e) => e.role === "RankAndFile"),
    6,
  );
  for (const e of targets) {
    const docs = faker.helpers.arrayElements(docPool, faker.number.int({ min: 1, max: 3 }));
    await pool.query(
      `INSERT INTO employee_missing_docs (emp_id, missing_docs) VALUES (?, ?)`,
      [e.emp_id, docs.join(", ")],
    );
  }
  return targets.length;
};

const seedNotifications = async (employees, leaveRequests) => {
  const templates = [
    (r, e) => ({
      type: "Leave_REQUEST",
      title: "New Leave Request",
      message: `${e.first_name} ${e.last_name} filed a ${r.leave_type} from ${r.date_from} to ${r.date_to}.`,
      refType: "leave",
    }),
    (r) => ({
      type: "Leave_STATUS",
      title: `Leave Request ${r.status}`,
      message: `Your ${r.leave_type} from ${r.date_from} to ${r.date_to} was ${r.status.toLowerCase()}.`,
      refType: "leave",
    }),
  ];

  let count = 0;
  for (const r of leaveRequests) {
    const e = employees.find((x) => x.emp_id === r.emp_id);
    if (!e) continue;
    const template = pick(templates);
    const body = template(r, e);
    const isRead = faker.helpers.maybe(() => true, { probability: 0.45 });
    await pool.query(
      `INSERT INTO notifications
        (emp_id, notification_type, title, message, reference_type, reference_id, status, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.emp_id, body.type, body.title, body.message, body.refType, r.id,
        isRead ? "Read" : "Unread",
        faker.date.recent({ days: 60 }),
        isRead ? faker.date.recent({ days: 30 }) : null,
      ],
    );
    count += 1;
  }

  const supervisors = employees.filter((e) => e.role === "Supervisor" || e.role === "HR");
  for (let i = 0; i < 25; i++) {
    const target = pick(supervisors);
    await pool.query(
      `INSERT INTO notifications
        (emp_id, notification_type, title, message, reference_type, status, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        target.emp_id,
        pick(["Offset_REQUEST", "Resignation_STATUS", "Offset_HR_NOTE", "Attendance_ALERT"]),
        pick([
          "Offset application needs review",
          "Resignation filed for processing",
          "HR note added to your request",
          "Attendance anomaly detected",
        ]),
        faker.lorem.sentence(),
        pick(["offset", "resignation", "attendance"]),
        faker.helpers.maybe(() => "Read", { probability: 0.4 }),
        faker.date.recent({ days: 45 }),
        faker.helpers.maybe(() => faker.date.recent({ days: 20 }), { probability: 0.4 }),
      ],
    );
    count += 1;
  }
  return count;
};

const main = async () => {
  const keep = process.argv.includes("--keep");
  console.log("Seeding WAH Payroll database...");

  await runSchema();
  await ensureRuntimeColumns();
  if (!keep) await wipe();

  const usedNames = new Set();
  const usedEmails = new Set();
  const employees = makeEmployees(usedNames, usedEmails);
  const supervisors = employees.filter((e) => e.role === "Supervisor" || e.role === "HR");
  const rankAndFile = employees.filter((e) => e.role === "RankAndFile");

  await seedWorkweek();
  const positions = await seedPositionSettings(employees);
  await seedEmployees(employees);
  const leaveRequests = await seedLeaveRequests(rankAndFile, supervisors);
  await seedLeaveBalances(employees, leaveRequests);
  const attendanceRows = await seedAttendance(employees);
  const offsets = await seedOffsets(rankAndFile, supervisors);
  const salaryEntries = await seedSalaryHistory(rankAndFile);
  const payrollRows = await seedPayroll(employees, salaryEntries);
  const resignations = await seedResignations(employees, supervisors);
  const missingDocs = await seedMissingDocs(employees);
  const notifications = await seedNotifications(employees, leaveRequests);

  console.log("\nSeed complete:");
  console.log(`  employees                ${employees.length}`);
  console.log(`  position_salary_settings ${positions}`);
  console.log(`  attendance               ${attendanceRows}`);
  console.log(`  leave_requests           ${leaveRequests.length}`);
  console.log(`  leave_balances           ${employees.length}`);
  console.log(`  offset_applications      ${offsets.applications}`);
  console.log(`  offset_ledger            ${offsets.ledgerRows}`);
  console.log(`  salary_history           ${salaryEntries.length}`);
  console.log(`  payroll                  ${payrollRows}`);
  console.log(`  resignations             ${resignations}`);
  console.log(`  employee_missing_docs    ${missingDocs}`);
  console.log(`  notifications            ${notifications}`);

  console.log("\nSample logins (username / password):");
  const samples = ["ADMIN-001", "HR-001", "SUP-001", "EMP-001", "EMP-005"];
  for (const id of samples) {
    const e = employees.find((x) => x.emp_id === id);
    if (!e) continue;
    const username = e.first_name.replace(/\s+/g, "").toLowerCase();
    const password = `${e.emp_id}${e.first_name.replace(/\s+/g, "")}`;
    console.log(`  ${e.role.padEnd(13)} ${username.padEnd(12)} ${password}`);
  }

  await pool.end();
};

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
  pool.end();
});
