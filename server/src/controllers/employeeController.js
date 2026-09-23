import fs from "fs";
import path from "path";
import pool from "../config/db.js";
import { hashPassword } from "../helper/hashPass.js";
import bcrypt from "bcryptjs";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3BucketName, s3Client } from "../config/s3";
import {
  deleteDbStoredFileByKey,
  getDbStoredFileByKey,
  saveDbStoredFile,
} from "../functions/dbFileStorage.ts";

// payrollModel.js
export const getPayrollByEmployee = async (connection, emp_id, period) => {
  const [rows] = await connection.query(
    `
    SELECT 
      e.first_name, 
      e.last_name, 
      e.email, 
      p.*
    FROM payroll p
    JOIN employees e ON p.emp_id = e.emp_id
    WHERE p.emp_id = ? 
      AND p.period_start LIKE ? 
    LIMIT 1
    `,
    [emp_id, `${period}%`],
  );

  if (rows.length === 0) return null;
  return rows[0];
};

export const getPayrollForBulk = async (connection, period) => {
  const [rows] = await connection.query(
    `
    SELECT 
      e.first_name, 
      e.last_name, 
      e.email, 
      p.*
    FROM payroll p
    JOIN employees e ON p.emp_id = e.emp_id
    WHERE p.period_start LIKE ?
    `,
    [`${period}%`],
  );

  return rows; // Returns an array of all payroll objects for that month/period
};

const resolveRoleFromProfile = ({ designation, position }) => {
  const normalizedDesignation = String(designation || "")
    .trim()
    .toLowerCase();
  const normalizedPosition = String(position || "")
    .trim()
    .toLowerCase();

  if (
    normalizedDesignation === "operations" &&
    normalizedPosition === "admin & human resources partner"
  ) {
    return "HR";
  }

  if (normalizedPosition.startsWith("supervisor(")) {
    return "Supervisor";
  }

  return "RankAndFile";
};

const WORKWEEK_DEFAULTS = {
  "5-day": { hoursPerDay: 8, absenceUnit: 1 },
  "4-day": { hoursPerDay: 10, absenceUnit: 1.25 },
};

const normalizeWorkweekType = (type) => {
  const normalized = String(type || "")
    .trim()
    .toLowerCase();

  if (normalized === "5-day" || normalized === "5day") return "5-day";
  if (normalized === "4-day" || normalized === "4day") return "4-day";
  return null;
};

const ensureWorkweekConfigsTable = async (connection = pool) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS workweek_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workweek_type ENUM('5-day', '4-day') NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE NULL,
      hours_per_day DECIMAL(4,2) NOT NULL,
      absence_unit DECIMAL(4,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_effective_from (effective_from)
    )
  `);
};

const ensurePositionSalarySettingsTable = async (connection = pool) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS position_salary_settings (
      position VARCHAR(100) PRIMARY KEY,
      amount DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_position_salary_updated_at (updated_at)
    )
  `);
};

const getEmpIdColumnDefinition = async (connection = pool) => {
  const [empIdMetaRows] = await connection.query(
    `
      SELECT
        COLUMN_TYPE,
        CHARACTER_SET_NAME,
        COLLATION_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'employees'
        AND COLUMN_NAME = 'emp_id'
      LIMIT 1
    `,
  );

  const empIdMeta = empIdMetaRows[0];
  return empIdMeta
    ? `${empIdMeta.COLUMN_TYPE}${empIdMeta.CHARACTER_SET_NAME ? ` CHARACTER SET ${empIdMeta.CHARACTER_SET_NAME}` : ""}${empIdMeta.COLLATION_NAME ? ` COLLATE ${empIdMeta.COLLATION_NAME}` : ""}`
    : "VARCHAR(50)";
};

const ensureOffsetTables = async (connection = pool) => {
  const empIdColumn = await getEmpIdColumnDefinition(connection);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS offset_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_id ${empIdColumn} NOT NULL,
      period_year INT NOT NULL,
      period_month INT NOT NULL,
      working_days_completed INT,
      baseline_days INT DEFAULT 22,
      offset_earned DECIMAL(5,2) DEFAULT 0,
      offset_used DECIMAL(5,2) DEFAULT 0,
      carried_over DECIMAL(5,2) DEFAULT 0,
      final_balance DECIMAL(5,2) DEFAULT 0,
      status ENUM('Draft', 'Pending', 'Approved', 'Rejected') DEFAULT 'Draft',
      supervisor_emp_id ${empIdColumn},
      supervisor_remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      approved_at TIMESTAMP NULL,
      INDEX idx_emp_period (emp_id, period_year, period_month),
      INDEX idx_status (status),
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_emp_id) REFERENCES employees(emp_id) ON DELETE SET NULL
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS offset_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_id ${empIdColumn} NOT NULL,
      date_from DATE NOT NULL,
      date_to DATE NOT NULL,
      days_applied DECIMAL(5,2) NOT NULL,
      reason TEXT,
      status ENUM('Pending', 'Approved', 'Denied', 'Partially Approved') DEFAULT 'Pending',
      approved_days DECIMAL(5,2),
      supervisor_emp_id ${empIdColumn},
      supervisor_remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      approved_at TIMESTAMP NULL,
      cancellation_requested_at TIMESTAMP NULL,
      cancellation_reason TEXT,
      INDEX idx_emp_status (emp_id, status),
      INDEX idx_date_range (date_from, date_to),
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_emp_id) REFERENCES employees(emp_id) ON DELETE SET NULL
    )
  `);

  const [offsetCancelRequestedColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'offset_applications'
        AND COLUMN_NAME = 'cancellation_requested_at'
      LIMIT 1
    `,
  );

  if (offsetCancelRequestedColumn.length === 0) {
    await connection.query(
      "ALTER TABLE offset_applications ADD COLUMN cancellation_requested_at TIMESTAMP NULL AFTER approved_at",
    );
  }

  const [offsetCancellationReasonColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'offset_applications'
        AND COLUMN_NAME = 'cancellation_reason'
      LIMIT 1
    `,
  );

  if (offsetCancellationReasonColumn.length === 0) {
    await connection.query(
      "ALTER TABLE offset_applications ADD COLUMN cancellation_reason TEXT NULL AFTER cancellation_requested_at",
    );
  }

  const [offsetHrNoteColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'offset_applications'
        AND COLUMN_NAME = 'hr_note'
      LIMIT 1
    `,
  );

  if (offsetHrNoteColumn.length === 0) {
    await connection.query(
      "ALTER TABLE offset_applications ADD COLUMN hr_note TEXT NULL AFTER supervisor_remarks",
    );
  }

  const [offsetReasonColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'offset_applications'
        AND COLUMN_NAME = 'reason'
      LIMIT 1
    `,
  );

  if (offsetReasonColumn.length === 0) {
    await connection.query(
      "ALTER TABLE offset_applications ADD COLUMN reason TEXT NULL AFTER days_applied",
    );
  }
};

export const ensureLeaveApprovalColumns = async (connection = pool) => {
  // Align status options for existing databases.
  await connection.query(`
    ALTER TABLE leave_requests
    MODIFY COLUMN status ENUM('Pending', 'Approved', 'Denied', 'Partially Approved') DEFAULT 'Pending'
  `);

  const [approvedDaysColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leave_requests'
        AND COLUMN_NAME = 'approved_days'
      LIMIT 1
    `,
  );

  if (approvedDaysColumn.length === 0) {
    await connection.query(
      "ALTER TABLE leave_requests ADD COLUMN approved_days DECIMAL(5,2) NULL AFTER status",
    );
  }

  const [approvedDatesColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leave_requests'
        AND COLUMN_NAME = 'approved_dates'
      LIMIT 1
    `,
  );

  if (approvedDatesColumn.length === 0) {
    await connection.query(
      "ALTER TABLE leave_requests ADD COLUMN approved_dates JSON NULL AFTER approved_days",
    );
  }

  const [leaveCancelRequestedColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leave_requests'
        AND COLUMN_NAME = 'cancellation_requested_at'
      LIMIT 1
    `,
  );

  if (leaveCancelRequestedColumn.length === 0) {
    await connection.query(
      "ALTER TABLE leave_requests ADD COLUMN cancellation_requested_at TIMESTAMP NULL AFTER approved_dates",
    );
  }

  const [leaveCancellationReasonColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leave_requests'
        AND COLUMN_NAME = 'cancellation_reason'
      LIMIT 1
    `,
  );

  if (leaveCancellationReasonColumn.length === 0) {
    await connection.query(
      "ALTER TABLE leave_requests ADD COLUMN cancellation_reason TEXT NULL AFTER cancellation_requested_at",
    );
  }

  const [leaveHrNoteColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leave_requests'
        AND COLUMN_NAME = 'hr_note'
      LIMIT 1
    `,
  );

  if (leaveHrNoteColumn.length === 0) {
    await connection.query(
      "ALTER TABLE leave_requests ADD COLUMN hr_note TEXT NULL AFTER supervisor_remarks",
    );
  }
};

const ensureResignationsTable = async (connection = pool) => {
  const empIdColumn = await getEmpIdColumnDefinition(connection);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS resignations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_id ${empIdColumn} NOT NULL,
      resignation_type VARCHAR(100) NOT NULL,
      effective_date DATE NOT NULL,
      reason TEXT,
      resignation_letter TEXT,
      recipient_name VARCHAR(255),
      recipient_emp_id ${empIdColumn} NULL,
      resignation_date DATE NULL,
      last_working_day DATE NULL,
      leaving_reasons_json JSON NULL,
      leaving_reason_other TEXT NULL,
      exit_interview_answers_json JSON NULL,
      endorsement_file_key VARCHAR(512) NULL,
      clearance_file_key VARCHAR(512) NULL,
      current_step TINYINT DEFAULT 1,
      status ENUM('Pending Approval', 'Approved', 'Rejected') DEFAULT 'Pending Approval',
      reviewed_by ${empIdColumn} NULL,
      review_remarks TEXT,
      reviewed_at TIMESTAMP NULL,
      cancellation_requested_at TIMESTAMP NULL,
      cancellation_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_resignation_emp_status (emp_id, status),
      INDEX idx_resignation_effective_date (effective_date),
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES employees(emp_id) ON DELETE SET NULL
    )
  `);

  const [resignationCancelRequestedColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'resignations'
        AND COLUMN_NAME = 'cancellation_requested_at'
      LIMIT 1
    `,
  );

  if (resignationCancelRequestedColumn.length === 0) {
    await connection.query(
      "ALTER TABLE resignations ADD COLUMN cancellation_requested_at TIMESTAMP NULL AFTER reviewed_at",
    );
  }

  const [resignationCancellationReasonColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'resignations'
        AND COLUMN_NAME = 'cancellation_reason'
      LIMIT 1
    `,
  );

  if (resignationCancellationReasonColumn.length === 0) {
    await connection.query(
      "ALTER TABLE resignations ADD COLUMN cancellation_reason TEXT NULL AFTER cancellation_requested_at",
    );
  }

  const [resignationHrNoteColumn] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'resignations'
        AND COLUMN_NAME = 'hr_note'
      LIMIT 1
    `,
  );

  if (resignationHrNoteColumn.length === 0) {
    await connection.query(
      "ALTER TABLE resignations ADD COLUMN hr_note TEXT NULL AFTER review_remarks",
    );
  }

  const optionalColumns = [
    {
      name: "resignation_letter",
      alter:
        "ALTER TABLE resignations ADD COLUMN resignation_letter TEXT NULL AFTER reason",
    },
    {
      name: "recipient_name",
      alter:
        "ALTER TABLE resignations ADD COLUMN recipient_name VARCHAR(255) NULL AFTER resignation_letter",
    },
    {
      name: "recipient_emp_id",
      alter:
        "ALTER TABLE resignations ADD COLUMN recipient_emp_id VARCHAR(50) NULL AFTER recipient_name",
    },
    {
      name: "resignation_date",
      alter:
        "ALTER TABLE resignations ADD COLUMN resignation_date DATE NULL AFTER recipient_emp_id",
    },
    {
      name: "last_working_day",
      alter:
        "ALTER TABLE resignations ADD COLUMN last_working_day DATE NULL AFTER resignation_date",
    },
    {
      name: "leaving_reasons_json",
      alter:
        "ALTER TABLE resignations ADD COLUMN leaving_reasons_json JSON NULL AFTER last_working_day",
    },
    {
      name: "leaving_reason_other",
      alter:
        "ALTER TABLE resignations ADD COLUMN leaving_reason_other TEXT NULL AFTER leaving_reasons_json",
    },
    {
      name: "exit_interview_answers_json",
      alter:
        "ALTER TABLE resignations ADD COLUMN exit_interview_answers_json JSON NULL AFTER leaving_reason_other",
    },
    {
      name: "endorsement_file_key",
      alter:
        "ALTER TABLE resignations ADD COLUMN endorsement_file_key VARCHAR(512) NULL AFTER exit_interview_answers_json",
    },
    {
      name: "clearance_file_key",
      alter:
        "ALTER TABLE resignations ADD COLUMN clearance_file_key VARCHAR(512) NULL AFTER endorsement_file_key",
    },
    {
      name: "current_step",
      alter:
        "ALTER TABLE resignations ADD COLUMN current_step TINYINT DEFAULT 1 AFTER clearance_file_key",
    },
  ];

  for (const column of optionalColumns) {
    const [columnRows] = await connection.query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'resignations'
          AND COLUMN_NAME = ?
        LIMIT 1
      `,
      [column.name],
    );

    if (columnRows.length === 0) {
      await connection.query(column.alter);
    }
  }
};

const ensureResignationDraftsTable = async (connection = pool) => {
  const empIdColumn = await getEmpIdColumnDefinition(connection);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS resignation_drafts (
      emp_id ${empIdColumn} PRIMARY KEY,
      payload_json JSON NOT NULL,
      current_step TINYINT DEFAULT 1,
      interview_part TINYINT DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
    )
  `);
};

const ensureNotificationsTable = async (connection = pool) => {
  const empIdColumn = await getEmpIdColumnDefinition(connection);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_id ${empIdColumn} NOT NULL,
      notification_type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      reference_type VARCHAR(50),
      reference_id INT,
      status ENUM('Unread', 'Read') DEFAULT 'Unread',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      INDEX idx_notification_emp_status (emp_id, status),
      INDEX idx_notification_created (created_at),
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
    )
  `);
};

const ensureEmployeeMissingDocsTable = async (connection = pool) => {
  const empIdColumn = await getEmpIdColumnDefinition(connection);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS employee_missing_docs (
      emp_id ${empIdColumn} PRIMARY KEY,
      missing_docs TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
    )
  `);
};

const ensureFileTemplatesTable = async (connection = pool) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS file_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(120) NULL,
      storage_key VARCHAR(120) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      size_bytes INT NOT NULL,
      uploaded_by VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_file_templates_created (created_at),
      INDEX idx_file_templates_storage_key (storage_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

export const ensureEmployeeGovernmentColumns = async (connection = pool) => {
  const governmentColumns = [
    { name: "philhealth_no", type: "VARCHAR(50)", after: "email" },
    { name: "tin", type: "VARCHAR(50)", after: "philhealth_no" },
    { name: "sss_no", type: "VARCHAR(50)", after: "tin" },
    { name: "pag_ibig_mid_no", type: "VARCHAR(50)", after: "sss_no" },
    { name: "pag_ibig_rtn", type: "VARCHAR(50)", after: "pag_ibig_mid_no" },
    { name: "gsis_no", type: "VARCHAR(50)", after: "pag_ibig_rtn" },
    { name: "profile_photo", type: "VARCHAR(255)", after: "gsis_no" },
  ];

  for (const column of governmentColumns) {
    const [rows] = await connection.query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'employees'
          AND COLUMN_NAME = ?
        LIMIT 1
      `,
      [column.name],
    );

    if (rows.length === 0) {
      try {
        await connection.query(
          `ALTER TABLE employees ADD COLUMN ${column.name} ${column.type} NULL AFTER ${column.after}`,
        );
      } catch (error) {
        // Ignore race-condition duplicates when concurrent requests add the same column.
        if (error?.code !== "ER_DUP_FIELDNAME") {
          throw error;
        }
      }
    }
  }
};

const normalizeDateInput = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeRole = (role) => {
  const value = String(role || "")
    .trim()
    .toLowerCase();
  if (value === "admin") return "Admin";
  if (value === "supervisor") return "Supervisor";
  if (value === "hr") return "HR";
  return "RankAndFile";
};

const getDefaultLeaveAllocation = (status) => {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  return ["job order", "pgt employee", "pgt"].includes(normalizedStatus)
    ? 12
    : 27;
};

const recalculateLeaveBalanceForEmployee = async (connection, empId) => {
  const [employeeRows] = await connection.query(
    `SELECT status
     FROM employees
     WHERE emp_id = ?
     LIMIT 1`,
    [empId],
  );

  if (employeeRows.length === 0) return null;

  const defaultLeave = getDefaultLeaveAllocation(employeeRows[0].status);

  const [usedRows] = await connection.query(
    `SELECT
       COALESCE(
         SUM(
           CASE
             WHEN status = 'Approved' THEN COALESCE(approved_days, DATEDIFF(date_to, date_from) + 1, 0)
             WHEN status = 'Partially Approved' THEN COALESCE(approved_days, 0)
             ELSE 0
           END
         ),
         0
       ) AS used_days
     FROM leave_requests
     WHERE emp_id = ?
       AND status IN ('Approved', 'Partially Approved')`,
    [empId],
  );

  const usedDays = Number(usedRows[0]?.used_days || 0);
  const computedBalance = Number(
    Math.max(defaultLeave - usedDays, 0).toFixed(2),
  );

  await connection.query(
    `INSERT INTO leave_balances (emp_id, leave_balance, offset_credits)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE leave_balance = VALUES(leave_balance)`,
    [empId, computedBalance],
  );

  return computedBalance;
};

export const getEmployeeProfile = async (connection, empId) => {
  const [rows] = await connection.query(
    `
      SELECT emp_id, first_name, last_name, designation, status, COALESCE(role, 'RankAndFile') as role
      FROM employees
      WHERE emp_id = ?
      LIMIT 1
    `,
    [empId],
  );

  if (rows.length === 0) return null;

  return {
    ...rows[0],
    role: normalizeRole(rows[0].role),
    status: rows[0].status || null,
    designation: rows[0].designation || null,
  };
};

const safeEmployeeDisplayName = (employee) => {
  const firstName = String(employee?.first_name || "").trim();
  const lastName = String(employee?.last_name || "").trim();
  return `${firstName} ${lastName}`.trim() || employee?.emp_id || "Employee";
};

const safeFileName = (fileKey) => {
  const normalized = String(fileKey || "").trim();
  if (!normalized) return "";
  return path.basename(normalized);
};

const parseJsonArraySafe = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const deleteS3ObjectQuietly = async (fileKey) => {
  const normalized = String(fileKey || "").trim();
  if (!normalized) return;

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: normalized,
      }),
    );
  } catch (error) {
    if (error?.name === "NoSuchKey") return;
    throw error;
  }
};

const getAccessibleEmployeesForFileManagement = async (connection, viewer) => {
  const [timestampColumns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'employees'
       AND COLUMN_NAME IN ('created_at', 'updated_at')`,
  );

  const hasCreatedAt = timestampColumns.some(
    (column) => column.COLUMN_NAME === "created_at",
  );
  const hasUpdatedAt = timestampColumns.some(
    (column) => column.COLUMN_NAME === "updated_at",
  );

  const createdAtSelect = hasCreatedAt
    ? "created_at"
    : "NULL AS created_at";
  const updatedAtSelect = hasUpdatedAt
    ? "updated_at"
    : "NULL AS updated_at";

  let whereClause = `
    WHERE LOWER(COALESCE(role, '')) <> 'admin'
      AND LOWER(TRIM(COALESCE(designation, ''))) <> 'admin system'
  `;
  const params = [];

  if (viewer.role === "RankAndFile") {
    whereClause += " AND emp_id = ?";
    params.push(viewer.emp_id);
  } else if (viewer.role === "Supervisor") {
    whereClause = `
      WHERE (
        (
          emp_id = ?
          AND LOWER(COALESCE(role, '')) <> 'admin'
          AND LOWER(TRIM(COALESCE(designation, ''))) <> 'admin system'
        )
        OR (
          COALESCE(role, '') IN ('RankAndFile', 'HR')
          AND LOWER(TRIM(COALESCE(designation, ''))) = LOWER(TRIM(?))
          AND LOWER(TRIM(COALESCE(designation, ''))) <> 'admin system'
          AND emp_id <> ?
        )
      )
    `;
    params.push(viewer.emp_id, viewer.designation || "", viewer.emp_id);
  }

  const [rows] = await connection.query(
    `SELECT
       emp_id,
       first_name,
       last_name,
       designation,
       position,
       COALESCE(role, 'RankAndFile') AS role,
       profile_photo,
       ${createdAtSelect},
       ${updatedAtSelect}
     FROM employees
     ${whereClause}
     ORDER BY
       CAST(COALESCE(NULLIF(REGEXP_SUBSTR(emp_id, '[0-9]+$'), ''), '0') AS UNSIGNED) ASC,
       emp_id ASC`,
    params,
  );

  return rows.map((row) => ({
    ...row,
    role: normalizeRole(row.role),
  }));
};

export const getFileManagementInventory = async (req, res) => {
  try {
    await ensureResignationsTable();

    const viewer = await getEmployeeProfile(pool, req.user?.emp_id);
    if (!viewer) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const employees = await getAccessibleEmployeesForFileManagement(
      pool,
      viewer,
    );
    const accessibleEmpIds = employees.map((employee) => employee.emp_id);

    let resignationRows = [];
    if (accessibleEmpIds.length > 0) {
      const placeholders = accessibleEmpIds.map(() => "?").join(",");
      const [rows] = await pool.query(
        `SELECT
           r.id,
           r.emp_id,
           r.resignation_type,
           r.status,
           r.effective_date,
           r.resignation_letter,
           r.recipient_name,
           r.recipient_emp_id,
           r.resignation_date,
           r.last_working_day,
           r.leaving_reasons_json,
           r.leaving_reason_other,
           r.exit_interview_answers_json,
           r.created_at,
           r.updated_at,
           r.endorsement_file_key,
           r.clearance_file_key,
           e.first_name,
           e.last_name,
           e.designation,
           e.position,
           e.hired_date,
           COALESCE(e.role, 'RankAndFile') AS role
         FROM resignations r
         JOIN employees e ON e.emp_id = r.emp_id
         WHERE r.emp_id IN (${placeholders})
           AND (r.endorsement_file_key IS NOT NULL OR r.clearance_file_key IS NOT NULL)
         ORDER BY r.updated_at DESC, r.created_at DESC, r.id DESC`,
        accessibleEmpIds,
      );
      resignationRows = rows;
    }

    const files = [];

    employees.forEach((employee) => {
      if (!String(employee.profile_photo || "").trim()) return;

      files.push({
        id: `profile-${employee.emp_id}`,
        emp_id: employee.emp_id,
        employee_name: safeEmployeeDisplayName(employee),
        position: employee.position || "-",
        designation: employee.designation || "-",
        role: employee.role || "RankAndFile",
        source: "profile",
        record_id: employee.emp_id,
        file_field: "profile_photo",
        file_type: "Profile Photo",
        file_key: employee.profile_photo,
        file_name: safeFileName(employee.profile_photo) || "Profile Photo",
        uploaded_at: employee.updated_at || employee.created_at || null,
        download_url: `/${String(employee.profile_photo).replace(/^\/+/, "")}`,
        replaceable: true,
      });
    });

    resignationRows.forEach((row) => {
      const employeeName = safeEmployeeDisplayName(row);
      const uploadedAt = row.updated_at || row.created_at || null;
      const normalizedStatus = String(row.status || "").trim().toLowerCase();
      const isApproved =
        normalizedStatus === "approved" ||
        normalizedStatus === "approved resignation";
      const leavingReasons = parseJsonArraySafe(row.leaving_reasons_json);
      const interviewAnswers = parseJsonArraySafe(row.exit_interview_answers_json);

      const baseDocumentData = {
        resignation_id: row.id,
        emp_id: row.emp_id,
        employee_name: employeeName,
        first_name: row.first_name || "",
        last_name: row.last_name || "",
        position: row.position || "",
        designation: row.designation || "",
        hired_date: row.hired_date || null,
        role: normalizeRole(row.role),
        resignation_type: row.resignation_type || "Resignation",
        resignation_status: row.status || "Pending Approval",
        effective_date: row.effective_date || null,
        resignation_date: row.resignation_date || null,
        last_working_day: row.last_working_day || null,
        resignation_letter: row.resignation_letter || "",
        recipient_name: row.recipient_name || "",
        recipient_emp_id: row.recipient_emp_id || "",
        leaving_reasons: leavingReasons,
        leaving_reason_other: row.leaving_reason_other || "",
        exit_interview_answers: interviewAnswers,
        generated_at: uploadedAt,
      };

      const addGeneratedDocument = (templateType, fileType) => {
        files.push({
          id: `resignation-${row.id}-${templateType}-generated`,
          emp_id: row.emp_id,
          employee_name: employeeName,
          position: row.position || "-",
          designation: row.designation || "-",
          role: normalizeRole(row.role),
          source: "generated",
          file_status: "generated",
          record_id: row.id,
          application_id: row.id,
          file_group: `resignation-${row.id}`,
          file_field: null,
          template_type: templateType,
          file_type: fileType,
          file_key: null,
          file_name: `${templateType}.pdf`,
          uploaded_at: uploadedAt,
          download_url: null,
          replaceable: false,
          request_status: row.status || null,
          request_type: row.resignation_type || "Resignation",
          document_data: baseDocumentData,
        });
      };

      addGeneratedDocument("resignation_letter", "Resignation Letter");
      addGeneratedDocument("resignation_form", "Employee Resignation Form");
      addGeneratedDocument("exit_interview", "Exit Interview Form");

      if (isApproved) {
        addGeneratedDocument("exit_clearance", "Exit Clearance Form");
        addGeneratedDocument("nda", "NDA Form");
      }

      if (String(row.endorsement_file_key || "").trim()) {
        files.push({
          id: `resignation-${row.id}-endorsement`,
          emp_id: row.emp_id,
          employee_name: employeeName,
          position: row.position || "-",
          designation: row.designation || "-",
          role: normalizeRole(row.role),
          source: "resignation",
          file_status: "uploaded",
          record_id: row.id,
          application_id: row.id,
          file_group: `resignation-${row.id}`,
          file_field: "endorsement_file_key",
          file_type: "Endorsement Form",
          file_key: row.endorsement_file_key,
          file_name: safeFileName(row.endorsement_file_key),
          uploaded_at: uploadedAt,
          download_url: `/api/file/get?filename=${encodeURIComponent(row.endorsement_file_key)}`,
          replaceable: true,
          request_status: row.status || null,
          request_type: row.resignation_type || "Resignation",
        });
      }

      if (String(row.clearance_file_key || "").trim()) {
        files.push({
          id: `resignation-${row.id}-clearance`,
          emp_id: row.emp_id,
          employee_name: employeeName,
          position: row.position || "-",
          designation: row.designation || "-",
          role: normalizeRole(row.role),
          source: "resignation",
          file_status: "uploaded",
          record_id: row.id,
          application_id: row.id,
          file_group: `resignation-${row.id}`,
          file_field: "clearance_file_key",
          file_type: "Clearance Form",
          file_key: row.clearance_file_key,
          file_name: safeFileName(row.clearance_file_key),
          uploaded_at: uploadedAt,
          download_url: `/api/file/get?filename=${encodeURIComponent(row.clearance_file_key)}`,
          replaceable: true,
          request_status: row.status || null,
          request_type: row.resignation_type || "Resignation",
        });
      }
    });

    files.sort(
      (a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime(),
    );

    const filesByEmployee = employees.map((employee) => ({
      ...employee,
      display_name: safeEmployeeDisplayName(employee),
      files: files.filter((file) => file.emp_id === employee.emp_id),
    }));

    return res.json({
      viewerRole: viewer.role,
      employees: filesByEmployee,
      files,
    });
  } catch (error) {
    console.error("DB Error in getFileManagementInventory:", error);
    return res.status(500).json({ message: "Error fetching file inventory" });
  }
};

export const getFileTemplates = async (req, res) => {
  try {
    await ensureFileTemplatesTable();

    const [rows] = await pool.query(
      `SELECT
         id,
         title,
         category,
         original_name,
         mime_type,
         size_bytes,
         uploaded_by,
         created_at
       FROM file_templates
       ORDER BY created_at DESC, id DESC`,
    );

    return res.json(rows);
  } catch (error) {
    console.error("DB Error in getFileTemplates:", error);
    return res.status(500).json({ message: "Error fetching templates" });
  }
};

export const uploadFileTemplate = async (req, res) => {
  try {
    await ensureFileTemplatesTable();

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const title = String(req.body?.title || "").trim();
    const category = String(req.body?.category || "").trim();
    const originalName = String(req.file.originalname || "template").trim();
    const finalTitle = title || originalName;

    const storageKey = await saveDbStoredFile({
      originalName,
      mimeType: String(req.file.mimetype || "application/octet-stream"),
      sizeBytes: Number(req.file.size || 0),
      content: req.file.buffer,
      createdBy: req.user?.emp_id || null,
    });

    const [result] = await pool.query(
      `INSERT INTO file_templates (
         title,
         category,
         storage_key,
         original_name,
         mime_type,
         size_bytes,
         uploaded_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        finalTitle,
        category || null,
        storageKey,
        originalName,
        req.file.mimetype || "application/octet-stream",
        Number(req.file.size || 0),
        req.user?.emp_id || null,
      ],
    );

    return res.status(201).json({
      id: result.insertId,
      title: finalTitle,
      category: category || null,
      original_name: originalName,
      mime_type: req.file.mimetype || "application/octet-stream",
      size_bytes: Number(req.file.size || 0),
      uploaded_by: req.user?.emp_id || null,
      created_at: new Date().toISOString(),
      message: "Template uploaded successfully",
    });
  } catch (error) {
    console.error("DB Error in uploadFileTemplate:", error);
    return res.status(500).json({ message: "Error uploading template" });
  }
};

export const replaceFileTemplate = async (req, res) => {
  try {
    await ensureFileTemplatesTable();

    const templateId = Number(req.params?.id || 0);
    if (!Number.isFinite(templateId) || templateId <= 0) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const [rows] = await pool.query(
      `SELECT id, title, category, storage_key, original_name
       FROM file_templates
       WHERE id = ?
       LIMIT 1`,
      [templateId],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Template not found" });
    }

    const existing = rows[0];
    const nextOriginalName = String(req.file.originalname || existing.original_name || "template").trim();
    const nextStorageKey = await saveDbStoredFile({
      originalName: nextOriginalName,
      mimeType: String(req.file.mimetype || "application/octet-stream"),
      sizeBytes: Number(req.file.size || 0),
      content: req.file.buffer,
      createdBy: req.user?.emp_id || null,
    });

    await pool.query(
      `UPDATE file_templates
       SET storage_key = ?, original_name = ?, mime_type = ?, size_bytes = ?
       WHERE id = ?`,
      [
        nextStorageKey,
        nextOriginalName,
        req.file.mimetype || "application/octet-stream",
        Number(req.file.size || 0),
        templateId,
      ],
    );

    await deleteDbStoredFileByKey(existing.storage_key);

    return res.json({
      id: templateId,
      title: existing.title,
      category: existing.category,
      original_name: nextOriginalName,
      mime_type: req.file.mimetype || "application/octet-stream",
      size_bytes: Number(req.file.size || 0),
      message: "Template replaced successfully",
    });
  } catch (error) {
    console.error("DB Error in replaceFileTemplate:", error);
    return res.status(500).json({ message: "Error replacing template" });
  }
};

export const downloadFileTemplate = async (req, res) => {
  try {
    await ensureFileTemplatesTable();

    const templateId = Number(req.params?.id || 0);
    if (!Number.isFinite(templateId) || templateId <= 0) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const [rows] = await pool.query(
      `SELECT id, storage_key, original_name, mime_type
       FROM file_templates
       WHERE id = ?
       LIMIT 1`,
      [templateId],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Template not found" });
    }

    const template = rows[0];
    const storedFile = await getDbStoredFileByKey(template.storage_key);
    if (!storedFile) {
      return res.status(404).json({ message: "Template file not found" });
    }

    res.setHeader("Content-Type", template.mime_type || storedFile.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${template.original_name || storedFile.originalName}"`,
    );
    res.setHeader("Content-Length", String(storedFile.sizeBytes || 0));
    return res.send(storedFile.content);
  } catch (error) {
    console.error("DB Error in downloadFileTemplate:", error);
    return res.status(500).json({ message: "Error downloading template" });
  }
};

export const deleteFileTemplate = async (req, res) => {
  try {
    await ensureFileTemplatesTable();

    const templateId = Number(req.params?.id || 0);
    if (!Number.isFinite(templateId) || templateId <= 0) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const [rows] = await pool.query(
      `SELECT id, storage_key FROM file_templates WHERE id = ? LIMIT 1`,
      [templateId],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Template not found" });
    }

    const template = rows[0];
    await pool.query(`DELETE FROM file_templates WHERE id = ?`, [templateId]);
    await deleteDbStoredFileByKey(template.storage_key);

    return res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("DB Error in deleteFileTemplate:", error);
    return res.status(500).json({ message: "Error deleting template" });
  }
};

const getSupervisorApproversForRequester = async (connection, requester) => {
  if (!requester) return [];

  if (requester.role === "Supervisor") {
    const [rows] = await connection.query(
      `
        SELECT emp_id, first_name, last_name, designation
        FROM employees
        WHERE LOWER(COALESCE(role, '')) = 'hr'
          AND emp_id <> ?
        ORDER BY first_name ASC, last_name ASC
      `,
      [requester.emp_id],
    );
    return rows;
  }

  if (
    requester.role !== "RankAndFile" &&
    requester.role !== "HR" &&
    requester.role !== "Admin"
  ) {
    return [];
  }

  if (!requester.designation) return [];

  const [rows] = await connection.query(
    `
      SELECT emp_id, first_name, last_name, designation
      FROM employees
      WHERE (
          LOWER(COALESCE(role, '')) = 'supervisor'
          OR LOWER(COALESCE(position, '')) LIKE 'supervisor(%'
        )
        AND LOWER(TRIM(COALESCE(designation, ''))) = LOWER(TRIM(?))
        AND emp_id <> ?
      ORDER BY first_name ASC, last_name ASC
    `,
    [requester.designation, requester.emp_id],
  );

  return rows;
};

const canApproverReviewRequester = (approver, requester) => {
  if (!approver || !requester) return false;
  if (approver.emp_id === requester.emp_id) return false;

  // Policy: supervisor requests are reviewed by HR only.
  if (requester.role === "Supervisor") {
    return approver.role === "HR";
  }

  // Policy: rank-and-file and HR/Admin requests are reviewed by supervisor of same designation.
  if (
    requester.role === "RankAndFile" ||
    requester.role === "HR" ||
    requester.role === "Admin"
  ) {
    if (approver.role !== "Supervisor") return false;
    return (
      !!requester.designation && approver.designation === requester.designation
    );
  }

  return false;
};

const createNotification = async (
  connection,
  {
    empId,
    notificationType,
    title,
    message,
    referenceType = null,
    referenceId = null,
  },
) => {
  await ensureNotificationsTable(connection);

  await connection.query(
    `
      INSERT INTO notifications (
        emp_id,
        notification_type,
        title,
        message,
        reference_type,
        reference_id,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, 'Unread')
    `,
    [empId, notificationType, title, message, referenceType, referenceId],
  );
};

export const notifyApproversForRequest = async (
  connection,
  { requester, moduleType, requestId },
) => {
  const approvers = await getSupervisorApproversForRequester(
    connection,
    requester,
  );

  if (approvers.length === 0) return;

  const requesterName = `${requester.first_name} ${requester.last_name}`.trim();

  for (const approver of approvers) {
    await createNotification(connection, {
      empId: approver.emp_id,
      notificationType: `${moduleType}_REQUEST`,
      title: `${moduleType} Request Pending`,
      message: `${requesterName} submitted a ${moduleType.toLowerCase()} request awaiting your review.`,
      referenceType: moduleType,
      referenceId: requestId,
    });
  }
};

const notifySupervisorsForHrRoutingNote = async (
  connection,
  { requester, moduleType, requestId, hrName, note },
) => {
  const supervisors = await getSupervisorApproversForRequester(
    connection,
    requester,
  );

  if (supervisors.length === 0) return;

  const requesterName = `${requester.first_name} ${requester.last_name}`.trim();

  for (const supervisor of supervisors) {
    await createNotification(connection, {
      empId: supervisor.emp_id,
      notificationType: `${moduleType}_HR_NOTE`,
      title: `HR Note Added: ${moduleType}`,
      message: `${hrName} added a note for ${requesterName}'s ${moduleType.toLowerCase()} request: ${note}`,
      referenceType: moduleType,
      referenceId: requestId,
    });
  }
};

const notifyRequesterForDecision = async (
  connection,
  { requesterEmpId, moduleType, status, approverName },
) => {
  await createNotification(connection, {
    empId: requesterEmpId,
    notificationType: `${moduleType}_STATUS`,
    title: `${moduleType} Request ${status}`,
    message: `Your ${moduleType.toLowerCase()} request was marked ${status.toLowerCase()} by ${approverName}.`,
    referenceType: moduleType,
  });
};

const formatDateForNotification = (value) => {
  const normalized = normalizeDateInput(value);
  return normalized || String(value || "").trim() || "N/A";
};

const getRequestWindowText = ({ fromDate = null, toDate = null }) => {
  const from = formatDateForNotification(fromDate);
  const to = formatDateForNotification(toDate || fromDate);
  return `From: ${from} To: ${to}`;
};

const notifyApproversForCancellationRequest = async (
  connection,
  {
    requester,
    moduleType,
    requestId,
    fromDate = null,
    toDate = null,
    descriptor = "request",
  },
) => {
  const approvers = await getSupervisorApproversForRequester(
    connection,
    requester,
  );

  if (approvers.length === 0) return;

  const requesterName = `${requester.first_name} ${requester.last_name}`.trim();
  const windowText = getRequestWindowText({ fromDate, toDate });

  for (const approver of approvers) {
    await createNotification(connection, {
      empId: approver.emp_id,
      notificationType: `${moduleType}_CANCELLATION_REQUEST`,
      title: `${moduleType} Cancellation Pending`,
      message: `${requesterName} requested cancellation for ${descriptor}. ${windowText}.`,
      referenceType: moduleType,
      referenceId: requestId,
    });
  }
};

const notifyRequesterForCancellationDecision = async (
  connection,
  {
    requesterEmpId,
    moduleType,
    status,
    approverName,
    fromDate = null,
    toDate = null,
    descriptor = "request",
  },
) => {
  const normalizedStatus = String(status || "").toLowerCase();
  const decisionWord =
    normalizedStatus === "approved"
      ? "approved"
      : normalizedStatus === "rejected"
        ? "rejected"
        : normalizedStatus;
  const windowText = getRequestWindowText({ fromDate, toDate });

  await createNotification(connection, {
    empId: requesterEmpId,
    notificationType: `${moduleType}_CANCELLATION_STATUS`,
    title: `${moduleType} Cancellation ${status}`,
    message: `Your cancellation request for ${descriptor} was ${decisionWord} by ${approverName}. ${windowText}.`,
    referenceType: moduleType,
  });
};

const parsePeriodRange = (period) => {
  const isValidPeriod = /^\d{4}-\d{2}$/.test(String(period || ""));
  const base = isValidPeriod
    ? new Date(`${period}-01T00:00:00`)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const year = base.getFullYear();
  const month = base.getMonth();

  const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return {
    periodStart,
    periodEnd,
  };
};

const getConvertedAbsenceSummary = async (periodStart, periodEnd) => {
  await ensureWorkweekConfigsTable();

  const [rows] = await pool.query(
    `
      SELECT
        a.emp_id,
        COUNT(*) AS raw_absences,
        SUM(
          COALESCE(
            (
              SELECT wc.absence_unit
              FROM workweek_configs wc
              WHERE wc.effective_from <= a.date
                AND (wc.effective_to IS NULL OR wc.effective_to >= a.date)
              ORDER BY wc.effective_from DESC
              LIMIT 1
            ),
            1
          )
        ) AS converted_absences
      FROM attendance a
      WHERE a.status = 'Absent'
        AND a.date BETWEEN ? AND ?
      GROUP BY a.emp_id
    `,
    [periodStart, periodEnd],
  );

  return rows.reduce((acc, row) => {
    acc[row.emp_id] = {
      rawAbsences: Number(row.raw_absences || 0),
      convertedAbsences: Number(row.converted_absences || 0),
    };
    return acc;
  }, {});
};

// --- EMPLOYEES ---
export const getAllEmployees = async (req, res) => {
  try {
    await ensureEmployeeGovernmentColumns();
    const [rows] = await pool.query(
      `SELECT *
       FROM employees
       ORDER BY
         CAST(COALESCE(NULLIF(REGEXP_SUBSTR(emp_id, '[0-9]+$'), ''), '0') AS UNSIGNED) ASC,
         emp_id ASC`,
    );
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getAllEmployees:", error);
    res.status(500).json({ message: "Error fetching employees" });
  }
};

export const createEmployee = async (req, res) => {
  // 1. Add middle_initial to the destructured body
  const {
    emp_id,
    first_name,
    last_name,
    middle_initial,
    designation,
    position,
    status,
    email,
    philhealth_no,
    tin,
    sss_no,
    pag_ibig_mid_no,
    pag_ibig_rtn,
    gsis_no,
    dob,
    hired_date,
    password,
  } = req.body;

  const generatedAutoPassword = `${emp_id || ""}${(first_name || "").replace(/\s+/g, "")}`;
  const employeePassword = password || generatedAutoPassword;

  const hashPass = await hashPassword(employeePassword);

  const employeeRole = resolveRoleFromProfile({ designation, position });
  const normalizedDob = normalizeDateInput(dob);
  const normalizedHiredDate = normalizeDateInput(hired_date);

  try {
    await ensureEmployeeGovernmentColumns();
    await ensurePositionSalarySettingsTable();

    let baseSalary = null;

    if (position) {
      const [positionSalaryRows] = await pool.query(
        `SELECT amount
         FROM position_salary_settings
         WHERE position = ?
         LIMIT 1`,
        [position],
      );

      if (positionSalaryRows.length > 0) {
        baseSalary = Number(positionSalaryRows[0].amount);
      } else {
        // Support older employee schemas that may not have timestamp columns.
        let employeeOrderColumn = "emp_id";

        const [updatedAtColumnRows] = await pool.query(
          `SELECT 1
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'employees'
             AND COLUMN_NAME = 'updated_at'
           LIMIT 1`,
        );

        if (updatedAtColumnRows.length > 0) {
          employeeOrderColumn = "updated_at";
        } else {
          const [createdAtColumnRows] = await pool.query(
            `SELECT 1
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'employees'
               AND COLUMN_NAME = 'created_at'
             LIMIT 1`,
          );

          if (createdAtColumnRows.length > 0) {
            employeeOrderColumn = "created_at";
          }
        }

        const [existingPositionRows] = await pool.query(
          `SELECT basic_pay
           FROM employees
           WHERE position = ?
             AND basic_pay IS NOT NULL
           ORDER BY ${employeeOrderColumn} DESC
           LIMIT 1`,
          [position],
        );

        if (existingPositionRows.length > 0) {
          baseSalary = Number(existingPositionRows[0].basic_pay);
        }
      }
    }

    await pool.query(
      // 2. Add middle_initial to the INSERT statement and add an extra '?'
      `INSERT INTO employees (emp_id, first_name, last_name, middle_initial, designation, position, status, email, philhealth_no, tin, sss_no, pag_ibig_mid_no, pag_ibig_rtn, gsis_no, dob, hired_date, password, basic_pay, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      // 3. Add middle_initial to the array of values being saved
      [
        emp_id,
        first_name,
        last_name,
        middle_initial || null,
        designation,
        position,
        status,
        email,
        philhealth_no || null,
        tin || null,
        sss_no || null,
        pag_ibig_mid_no || null,
        pag_ibig_rtn || null,
        gsis_no || null,
        normalizedDob,
        normalizedHiredDate,
        hashPass,
        baseSalary,
        employeeRole,
      ],
    );

    await recalculateLeaveBalanceForEmployee(pool, emp_id);

    res.status(201).json({ message: "Employee added successfully" });
  } catch (error) {
    console.error("DB Error in createEmployee:", error);
    res.status(500).json({ message: "Error adding employee" });
  }
};

export const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    middle_initial,
    designation,
    position,
    status,
    email,
    philhealth_no,
    tin,
    sss_no,
    pag_ibig_mid_no,
    pag_ibig_rtn,
    gsis_no,
    dob,
    hired_date,
  } = req.body;

  const employeeRole = resolveRoleFromProfile({ designation, position });
  const normalizedDob = normalizeDateInput(dob);
  const normalizedHiredDate = normalizeDateInput(hired_date);

  try {
    await ensureEmployeeGovernmentColumns();
    const [result] = await pool.query(
      `UPDATE employees
       SET first_name = ?,
           last_name = ?,
           middle_initial = ?,
           designation = ?,
           position = ?,
           status = ?,
           email = ?,
           philhealth_no = ?,
           tin = ?,
           sss_no = ?,
           pag_ibig_mid_no = ?,
           pag_ibig_rtn = ?,
           gsis_no = ?,
           dob = ?,
             hired_date = ?,
           role = ?
       WHERE emp_id = ?`,
      [
        first_name,
        last_name,
        middle_initial || null,
        designation,
        position,
        status,
        email,
        philhealth_no || null,
        tin || null,
        sss_no || null,
        pag_ibig_mid_no || null,
        pag_ibig_rtn || null,
        gsis_no || null,
        normalizedDob,
        normalizedHiredDate,
        employeeRole,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    await recalculateLeaveBalanceForEmployee(pool, id);

    res.json({ message: "Employee updated successfully" });
  } catch (error) {
    console.error("DB Error in updateEmployee:", error);
    res.status(500).json({ message: "Error updating employee" });
  }
};

export const resetEmployeePassword = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT emp_id, first_name FROM employees WHERE emp_id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employee = rows[0];
    const autoPassword = `${employee.emp_id}${(employee.first_name || "").replace(/\s+/g, "")}`;

    await pool.query("UPDATE employees SET password = ? WHERE emp_id = ?", [
      autoPassword,
      id,
    ]);

    res.json({
      message: "Password reset successfully",
      autoPassword,
    });
  } catch (error) {
    console.error("DB Error in resetEmployeePassword:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
};

export const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    // Because of 'ON DELETE CASCADE' in schema.sql, this safely removes their leaves, attendance, and payroll too
    await pool.query("DELETE FROM employees WHERE emp_id = ?", [id]);
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("DB Error in deleteEmployee:", error);
    res.status(500).json({ message: "Error deleting employee" });
  }
};

export const updateResignationStatus = async (req, res) => {
  const { id } = req.params;
  const { status, decision_mode, review_remarks } = req.body;
  const trimmedReviewRemarks = String(review_remarks || "").trim();
  try {
    await ensureResignationsTable();

    if (decision_mode === "cancellation") {
      if (!["Approved", "Rejected"].includes(status)) {
        return res.status(400).json({
          message: "Invalid cancellation decision status",
        });
      }

      if (status === "Rejected" && !trimmedReviewRemarks) {
        return res.status(400).json({
          message: "Reason is required for rejection",
        });
      }

      const [rows] = await pool.query(
        "SELECT id, emp_id, effective_date, cancellation_requested_at, resignation_type FROM resignations WHERE id = ? LIMIT 1",
        [id],
      );

      if (!rows.length) {
        return res
          .status(404)
          .json({ message: "Resignation request not found" });
      }

      const request = rows[0];
      if (!request.cancellation_requested_at) {
        return res.status(400).json({
          message: "No cancellation request is pending approval",
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveDate = new Date(request.effective_date);
      effectiveDate.setHours(0, 0, 0, 0);
      if (effectiveDate <= today) {
        return res.status(400).json({
          message: "Cannot process cancellation on or after effective date",
        });
      }

      const approver = await getEmployeeProfile(pool, req.user?.emp_id);
      const approverName = approver
        ? `${approver.first_name} ${approver.last_name}`.trim()
        : "the approver";

      if (status === "Approved") {
        await pool.query("DELETE FROM resignations WHERE id = ?", [id]);
      } else {
        await pool.query(
          `UPDATE resignations
           SET cancellation_requested_at = NULL,
               review_remarks = ?
           WHERE id = ?`,
          [trimmedReviewRemarks, id],
        );
      }

      await notifyRequesterForCancellationDecision(pool, {
        requesterEmpId: request.emp_id,
        moduleType: "Resignation",
        status,
        approverName,
        fromDate: request.effective_date,
        toDate: request.effective_date,
        descriptor: "resignation",
      });

      return res.json({
        message: `Resignation cancellation ${status.toLowerCase()} successfully`,
      });
    }

    if (!["Approved", "Rejected"].includes(String(status || ""))) {
      return res.status(400).json({ message: "Invalid resignation status" });
    }

    if (status === "Rejected" && !trimmedReviewRemarks) {
      return res.status(400).json({
        message: "Reason is required for rejection",
      });
    }

    const reviewRemarksValue =
      status === "Rejected" ? trimmedReviewRemarks : null;

    await pool.query(
      `UPDATE resignations
       SET status = ?,
           review_remarks = ?
       WHERE id = ?`,
      [status, reviewRemarksValue, id],
    );
    res.json({ message: "Resignation updated successfully" });
  } catch (error) {
    console.error("DB Error in updateResignationStatus:", error);
    res.status(500).json({ message: "Error updating resignation" });
  }
};

export const addHrNoteToPendingRequest = async (req, res) => {
  const { module, id } = req.params;
  const { hr_note } = req.body;
  const note = String(hr_note || "").trim();

  if (String(req.user?.role || "") !== "HR") {
    return res.status(403).json({ message: "Only HR can add routing notes" });
  }

  if (!note) {
    return res.status(400).json({ message: "HR note is required" });
  }

  const moduleMap = {
    leave: {
      ensure: ensureLeaveApprovalColumns,
      table: "leave_requests",
      statusColumn: "status",
      pendingStatus: ["Pending"],
      idColumn: "id",
      referenceType: "Leave",
    },
    offset: {
      ensure: ensureOffsetTables,
      table: "offset_applications",
      statusColumn: "status",
      pendingStatus: ["Pending", "Pending Approval"],
      idColumn: "id",
      referenceType: "Offset",
    },
    resignation: {
      ensure: ensureResignationsTable,
      table: "resignations",
      statusColumn: "status",
      pendingStatus: ["Pending Approval"],
      idColumn: "id",
      referenceType: "Resignation",
    },
  };

  const config = moduleMap[String(module || "").toLowerCase()];
  if (!config) {
    return res.status(400).json({ message: "Invalid module" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await config.ensure(connection);

    const [rows] = await connection.query(
      `
        SELECT t.${config.idColumn} as id,
               t.emp_id,
               t.${config.statusColumn} as status,
               t.cancellation_requested_at,
               e.first_name,
               e.last_name,
               e.designation,
               COALESCE(e.role, 'RankAndFile') as role
        FROM ${config.table} t
        JOIN employees e ON t.emp_id = e.emp_id
        WHERE t.${config.idColumn} = ?
        LIMIT 1
      `,
      [id],
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    const requestRow = rows[0];
    const isPending = config.pendingStatus.includes(
      String(requestRow.status || ""),
    );
    const isCancellationPending = Boolean(requestRow.cancellation_requested_at);

    if (!isPending && !isCancellationPending) {
      await connection.rollback();
      return res.status(400).json({ message: "Request is not pending review" });
    }

    if (String(requestRow.role || "") === "Supervisor") {
      await connection.rollback();
      return res.status(400).json({
        message: "HR can approve or reject supervisor requests directly",
      });
    }

    await connection.query(
      `UPDATE ${config.table} SET hr_note = ? WHERE ${config.idColumn} = ?`,
      [note, id],
    );

    const hrProfile = await getEmployeeProfile(connection, req.user?.emp_id);
    const hrName = hrProfile
      ? `${hrProfile.first_name} ${hrProfile.last_name}`.trim()
      : "HR";

    await notifySupervisorsForHrRoutingNote(connection, {
      requester: requestRow,
      moduleType: config.referenceType,
      requestId: Number(id),
      hrName,
      note,
    });

    await connection.commit();
    return res.json({ message: "HR note saved and supervisors notified" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in addHrNoteToPendingRequest:", error);
    return res.status(500).json({ message: "Error saving HR note" });
  } finally {
    connection.release();
  }
};

export const getAllResignations = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        r.id AS res_id, 
        r.emp_id, 
        r.resignation_type, 
        r.effective_date, 
        r.reason, 
        r.status, 
        r.created_at,
        e.first_name, 
        e.last_name
      FROM resignations r 
      JOIN employees e ON r.emp_id = e.emp_id 
      ORDER BY r.created_at DESC
    `);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("DETAILED SQL ERROR:", error.message);
    // This will send the EXACT error to your browser console
    return res.status(500).json({ message: error.message });
  }
};

// --- DASHBOARD ---
export const getDashboardSummary = async (req, res) => {
  try {
    await ensureResignationsTable();
    await ensureEmployeeMissingDocsTable();

    const currentUser = await getEmployeeProfile(pool, req.user?.emp_id);
    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await recalculateLeaveBalanceForEmployee(pool, currentUser.emp_id);

    const isAdmin = currentUser.role === "Admin";
    const isHR = currentUser.role === "HR";
    const isSupervisor = currentUser.role === "Supervisor";
    const isRankAndFile = currentUser.role === "RankAndFile";

    let pending = [];
    if (isSupervisor) {
      const [rows] = await pool.query(
        `
          SELECT l.*, e.first_name, e.last_name
          FROM leave_requests l
          JOIN employees e ON l.emp_id = e.emp_id
          WHERE l.status = 'Pending'
            AND COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
            AND e.designation = ?
            AND e.emp_id <> ?
        `,
        [currentUser.designation || "", currentUser.emp_id],
      );
      pending = rows;
    } else if (isHR) {
      const [rows] = await pool.query(
        `
          SELECT l.*, e.first_name, e.last_name
          FROM leave_requests l
          JOIN employees e ON l.emp_id = e.emp_id
          WHERE l.status = 'Pending'
            AND COALESCE(e.role, '') = 'Supervisor'
            AND e.emp_id <> ?
        `,
        [currentUser.emp_id],
      );
      pending = rows;
    }

    let onLeave = [];
    if (isAdmin || isHR) {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation, l.leave_type
         FROM employees e
         JOIN leave_requests l ON e.emp_id = l.emp_id
         WHERE CURDATE() BETWEEN l.date_from AND l.date_to
           AND l.status = 'Approved'`,
      );
      onLeave = rows;
    } else if (isSupervisor) {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation, l.leave_type
         FROM employees e
         JOIN leave_requests l ON e.emp_id = l.emp_id
         WHERE CURDATE() BETWEEN l.date_from AND l.date_to
           AND l.status = 'Approved'
           AND COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
           AND e.designation = ?
           AND e.emp_id <> ?`,
        [currentUser.designation || "", currentUser.emp_id],
      );
      onLeave = rows;
    } else {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation, l.leave_type
         FROM employees e
         JOIN leave_requests l ON e.emp_id = l.emp_id
         WHERE e.emp_id = ?
           AND CURDATE() BETWEEN l.date_from AND l.date_to
           AND l.status = 'Approved'`,
        [currentUser.emp_id],
      );
      onLeave = rows;
    }

    let absents = [];
    if (isAdmin || isHR) {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation
         FROM employees e
         WHERE e.status != 'Inactive'
           AND COALESCE(e.role, '') <> 'Admin'
           AND e.emp_id NOT IN (SELECT a.emp_id FROM attendance a WHERE a.date = CURDATE())`,
      );
      absents = rows;
    } else if (isSupervisor) {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation
         FROM employees e
         WHERE e.status != 'Inactive'
           AND COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
           AND e.designation = ?
           AND e.emp_id <> ?
           AND e.emp_id NOT IN (SELECT a.emp_id FROM attendance a WHERE a.date = CURDATE())`,
        [currentUser.designation || "", currentUser.emp_id],
      );
      absents = rows;
    } else {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation
         FROM employees e
         WHERE e.emp_id = ?
           AND e.emp_id NOT IN (SELECT a.emp_id FROM attendance a WHERE a.date = CURDATE())`,
        [currentUser.emp_id],
      );
      absents = rows;
    }

    let balances = [];
    if (isAdmin || isHR) {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation, lb.leave_balance, lb.offset_credits
         FROM employees e
         JOIN leave_balances lb ON e.emp_id = lb.emp_id`,
      );
      balances = rows;
    } else {
      const [rows] = await pool.query(
        `SELECT e.emp_id, e.first_name, e.last_name, e.designation, lb.leave_balance, lb.offset_credits
         FROM employees e
         JOIN leave_balances lb ON e.emp_id = lb.emp_id
         WHERE e.emp_id = ?`,
        [currentUser.emp_id],
      );
      balances = rows;
    }

    let resignations = [];
    if (isSupervisor) {
      const [rows] = await pool.query(
        `
          SELECT r.*, e.first_name, e.last_name
          FROM resignations r
          JOIN employees e ON r.emp_id = e.emp_id
          WHERE r.status = 'Pending Approval'
            AND COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
            AND e.designation = ?
            AND e.emp_id <> ?
        `,
        [currentUser.designation || "", currentUser.emp_id],
      );
      resignations = rows;
    } else if (isHR) {
      const [rows] = await pool.query(
        `
          SELECT r.*, e.first_name, e.last_name
          FROM resignations r
          JOIN employees e ON r.emp_id = e.emp_id
          WHERE r.status = 'Pending Approval'
            AND COALESCE(e.role, '') = 'Supervisor'
            AND e.emp_id <> ?
        `,
        [currentUser.emp_id],
      );
      resignations = rows;
    }

    let missingDocs = [];
    if (isAdmin || isHR) {
      const [rows] = await pool.query(
        `SELECT m.*, e.first_name, e.last_name, e.designation, e.hired_date
         FROM employee_missing_docs m
         JOIN employees e ON m.emp_id = e.emp_id`,
      );
      missingDocs = rows;
    } else if (isSupervisor) {
      const [rows] = await pool.query(
        `SELECT m.*, e.first_name, e.last_name, e.designation, e.hired_date
         FROM employee_missing_docs m
         JOIN employees e ON m.emp_id = e.emp_id
         WHERE COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
           AND e.designation = ?
           AND e.emp_id <> ?`,
        [currentUser.designation || "", currentUser.emp_id],
      );
      missingDocs = rows;
    } else {
      const [rows] = await pool.query(
        `SELECT m.*, e.first_name, e.last_name, e.designation, e.hired_date
         FROM employee_missing_docs m
         JOIN employees e ON m.emp_id = e.emp_id
         WHERE m.emp_id = ?`,
        [currentUser.emp_id],
      );
      missingDocs = rows;
    }

    const [todayAttendanceRows] = await pool.query(
      `SELECT status
       FROM attendance
       WHERE emp_id = ?
         AND date = CURDATE()
       LIMIT 1`,
      [currentUser.emp_id],
    );

    const [myPendingLeaves] = await pool.query(
      `SELECT COUNT(*) as total
       FROM leave_requests
       WHERE emp_id = ?
         AND status = 'Pending'`,
      [currentUser.emp_id],
    );

    const [myPendingOffsets] = await pool.query(
      `SELECT COUNT(*) as total
       FROM offset_applications
       WHERE emp_id = ?
         AND status IN ('Pending', 'Pending Approval')`,
      [currentUser.emp_id],
    );

    const [myPendingResignations] = await pool.query(
      `SELECT COUNT(*) as total
       FROM resignations
       WHERE emp_id = ?
         AND status = 'Pending Approval'`,
      [currentUser.emp_id],
    );

    const personalSummary = {
      employeeStatus: currentUser.status || "N/A",
      todayAttendanceStatus:
        todayAttendanceRows.length > 0
          ? String(todayAttendanceRows[0].status || "Pending")
          : "Absent",
      pendingRequestCount:
        Number(myPendingLeaves[0]?.total || 0) +
        Number(myPendingOffsets[0]?.total || 0) +
        Number(myPendingResignations[0]?.total || 0),
      leaveBalance: Number(balances[0]?.leave_balance || 0),
      offsetCredits: Number(balances[0]?.offset_credits || 0),
      hasMissingDocs: missingDocs.length > 0,
    };

    let teamSummary = null;
    let teamAttendanceStatus = [];
    let teamPendingRequests = [];

    if (isSupervisor) {
      const [teamMembers] = await pool.query(
        `SELECT emp_id, first_name, last_name
         FROM employees
         WHERE COALESCE(role, '') IN ('RankAndFile', 'HR', 'Admin')
           AND designation = ?
           AND emp_id <> ?
           AND status != 'Inactive'`,
        [currentUser.designation || "", currentUser.emp_id],
      );

      const [teamAttendanceRows] = await pool.query(
        `SELECT a.emp_id, a.status
         FROM attendance a
         JOIN employees e ON e.emp_id = a.emp_id
         WHERE a.date = CURDATE()
           AND COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
           AND e.designation = ?
           AND e.emp_id <> ?`,
        [currentUser.designation || "", currentUser.emp_id],
      );

      const attendanceByEmp = teamAttendanceRows.reduce((acc, row) => {
        acc[row.emp_id] = String(row.status || "Present");
        return acc;
      }, {});

      teamAttendanceStatus = teamMembers.map((member) => {
        const onLeaveMatch = onLeave.find(
          (item) => String(item.emp_id) === String(member.emp_id),
        );

        if (onLeaveMatch) {
          return {
            ...member,
            status: "On Leave",
          };
        }

        return {
          ...member,
          status: attendanceByEmp[member.emp_id] || "Absent",
        };
      });

      const presentCount = teamAttendanceStatus.filter((row) =>
        String(row.status || "")
          .toLowerCase()
          .includes("present"),
      ).length;
      const lateCount = teamAttendanceStatus.filter((row) =>
        String(row.status || "")
          .toLowerCase()
          .includes("late"),
      ).length;
      const onLeaveCount = teamAttendanceStatus.filter(
        (row) => String(row.status || "").toLowerCase() === "on leave",
      ).length;
      const absentCount = teamAttendanceStatus.filter(
        (row) => String(row.status || "").toLowerCase() === "absent",
      ).length;

      const [pendingOffsetRows] = await pool.query(
        `SELECT oa.id, oa.emp_id, oa.days_applied, oa.created_at, e.first_name, e.last_name
         FROM offset_applications oa
         JOIN employees e ON e.emp_id = oa.emp_id
         WHERE oa.status IN ('Pending', 'Pending Approval')
           AND COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
           AND e.designation = ?
           AND e.emp_id <> ?
         ORDER BY oa.created_at DESC
         LIMIT 20`,
        [currentUser.designation || "", currentUser.emp_id],
      );

      const [pendingResignationRows] = await pool.query(
        `SELECT r.id, r.emp_id, r.resignation_type, r.created_at, e.first_name, e.last_name
         FROM resignations r
         JOIN employees e ON e.emp_id = r.emp_id
         WHERE r.status = 'Pending Approval'
           AND COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
           AND e.designation = ?
           AND e.emp_id <> ?
         ORDER BY r.created_at DESC
         LIMIT 20`,
        [currentUser.designation || "", currentUser.emp_id],
      );

      teamPendingRequests = [
        ...pending.map((row) => ({
          id: `leave-${row.id}`,
          type: "Leave",
          emp_id: row.emp_id,
          first_name: row.first_name,
          last_name: row.last_name,
          detail: row.leave_type,
          created_at: row.created_at || row.date_from,
        })),
        ...pendingOffsetRows.map((row) => ({
          id: `offset-${row.id}`,
          type: "Offset",
          emp_id: row.emp_id,
          first_name: row.first_name,
          last_name: row.last_name,
          detail: `${Number(row.days_applied || 0)} day(s)`,
          created_at: row.created_at,
        })),
        ...pendingResignationRows.map((row) => ({
          id: `resignation-${row.id}`,
          type: "Resignation",
          emp_id: row.emp_id,
          first_name: row.first_name,
          last_name: row.last_name,
          detail: row.resignation_type,
          created_at: row.created_at,
        })),
      ]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);

      teamSummary = {
        teamSize: teamMembers.length,
        presentCount,
        lateCount,
        absentCount,
        onLeaveCount,
        pendingApprovals: teamPendingRequests.length,
      };
    }

    if (isRankAndFile) {
      pending = [];
      resignations = [];
      teamAttendanceStatus = [];
      teamPendingRequests = [];
    }

    res.json({
      pendingLeaves: pending,
      onLeave,
      absents,
      balances,
      resignations,
      missingDocs,
      personalSummary,
      teamSummary,
      teamAttendanceStatus,
      teamPendingRequests,
      recentActivities: [],
    });
  } catch (error) {
    console.error("DB Error in getDashboardSummary:", error);
    res.status(500).json({ message: "Error loading dashboard" });
  }
};

// --- UPDATE MISSING DOCUMENTS ---
export const updateMissingDocs = async (req, res) => {
  const { emp_id, missing_docs } = req.body;

  if (!emp_id)
    return res.status(400).json({ message: "Employee ID is required" });

  try {
    await ensureEmployeeMissingDocsTable();

    if (!missing_docs || missing_docs.trim() === "") {
      // If the HR clears the text box, it means all docs are submitted! Delete the record.
      await pool.query("DELETE FROM employee_missing_docs WHERE emp_id = ?", [
        emp_id,
      ]);
    } else {
      // Insert or Update the missing documents
      await pool.query(
        "INSERT INTO employee_missing_docs (emp_id, missing_docs) VALUES (?, ?) ON DUPLICATE KEY UPDATE missing_docs = VALUES(missing_docs)",
        [emp_id, missing_docs],
      );
    }
    res.json({ message: "Employee documents updated successfully" });
  } catch (error) {
    console.error("DB Error in updateMissingDocs:", error);
    res.status(500).json({ message: "Error updating missing documents" });
  }
};

// --- RESIGNATIONS ---
export const getMyResignations = async (req, res) => {
  try {
    await ensureResignationsTable();

    const empId = req.user?.emp_id;
    if (!empId) return res.status(400).json({ message: "Employee ID missing" });

    const [rows] = await pool.query(
      "SELECT * FROM resignations WHERE emp_id = ? ORDER BY created_at DESC",
      [empId],
    );
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getMyResignations:", error);
    res.status(500).json({ message: "Error fetching resignations" });
  }
};

export const getResignations = async (req, res) => {
  try {
    await ensureResignationsTable();

    const viewer = await getEmployeeProfile(pool, req.user?.emp_id);
    if (!viewer) return res.status(401).json({ message: "Unauthorized" });

    let query = `
      SELECT
        r.*,
        e.first_name,
        e.last_name,
        e.designation,
        COALESCE(e.role, 'RankAndFile') as requester_role,
        rv.first_name as reviewer_first_name,
        rv.last_name as reviewer_last_name
      FROM resignations r
      JOIN employees e ON r.emp_id = e.emp_id
      LEFT JOIN employees rv ON r.reviewed_by = rv.emp_id
    `;

    const params = [];

    if (viewer.role === "RankAndFile") {
      query += " WHERE r.emp_id = ?";
      params.push(viewer.emp_id);
    } else if (viewer.role === "Supervisor") {
      query += `
        WHERE r.emp_id = ?
           OR (
             e.designation = ?
             AND e.emp_id <> ?
           )
      `;
      params.push(viewer.emp_id, viewer.designation || "", viewer.emp_id);
    }

    query += " ORDER BY r.created_at DESC";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getResignations:", error);
    res.status(500).json({ message: "Error fetching resignations" });
  }
};

export const getResignationRecipient = async (req, res) => {
  try {
    const requester = await getEmployeeProfile(pool, req.user?.emp_id);
    if (!requester) {
      return res.status(404).json({ message: "Requester not found" });
    }

    const supervisors = await getSupervisorApproversForRequester(pool, requester);
    const primaryRecipient = supervisors[0] || null;
    const firstName = String(primaryRecipient?.first_name || "").trim();
    const lastName = String(primaryRecipient?.last_name || "").trim();
    const candidateName = `${firstName} ${lastName}`.trim();
    const recipientName =
      candidateName && !["undefined", "null", "undefined undefined", "null null"].includes(candidateName.toLowerCase())
        ? candidateName
        : "Supervisor";

    return res.json({
      recipient_name: recipientName,
      recipient_emp_id: primaryRecipient?.emp_id || null,
      recipient_designation: primaryRecipient?.designation || null,
      request_date: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error("DB Error in getResignationRecipient:", error);
    return res.status(500).json({ message: "Error loading resignation recipient" });
  }
};

export const getMyResignationDraft = async (req, res) => {
  const requesterEmpId = req.user?.emp_id;
  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await ensureResignationDraftsTable();

    const [rows] = await pool.query(
      `SELECT payload_json, current_step, interview_part, updated_at
       FROM resignation_drafts
       WHERE emp_id = ?
       LIMIT 1`,
      [requesterEmpId],
    );

    if (!rows.length) {
      return res.json({ draft: null });
    }

    return res.json({
      draft: {
        payload: rows[0].payload_json || {},
        step: Number(rows[0].current_step || 1),
        interviewPart: Number(rows[0].interview_part || 1),
        updated_at: rows[0].updated_at || null,
      },
    });
  } catch (error) {
    console.error("DB Error in getMyResignationDraft:", error);
    return res.status(500).json({ message: "Error fetching resignation draft" });
  }
};

export const saveMyResignationDraft = async (req, res) => {
  const requesterEmpId = req.user?.emp_id;
  const payload = req.body?.payload || {};
  const currentStep = Number(req.body?.step || 1);
  const interviewPart = Number(req.body?.interviewPart || 1);

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!Number.isFinite(currentStep) || currentStep < 1 || currentStep > 5) {
    return res.status(400).json({ message: "Invalid step" });
  }

  if (!Number.isFinite(interviewPart) || ![1, 2].includes(interviewPart)) {
    return res.status(400).json({ message: "Invalid interview part" });
  }

  try {
    await ensureResignationDraftsTable();

    await pool.query(
      `INSERT INTO resignation_drafts (emp_id, payload_json, current_step, interview_part)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         payload_json = VALUES(payload_json),
         current_step = VALUES(current_step),
         interview_part = VALUES(interview_part),
         updated_at = CURRENT_TIMESTAMP`,
      [requesterEmpId, JSON.stringify(payload || {}), currentStep, interviewPart],
    );

    return res.json({ message: "Draft saved" });
  } catch (error) {
    console.error("DB Error in saveMyResignationDraft:", error);
    return res.status(500).json({ message: "Error saving resignation draft" });
  }
};

export const fileResignation = async (req, res) => {
  const {
    emp_id,
    resignation_type,
    effective_date,
    reason,
    resignation_letter,
    recipient_name,
    recipient_emp_id,
    resignation_date,
    last_working_day,
    leaving_reasons,
    leaving_reason_other,
    exit_interview_answers,
    endorsement_file_key,
  } = req.body;
  try {
    const requesterEmpId =
      req.user?.role === "Admin" && emp_id
        ? emp_id
        : req.user?.emp_id || emp_id;

    if (!requesterEmpId || !resignation_type || !effective_date) {
      return res.status(400).json({
        message: "emp_id, resignation_type, and effective_date are required",
      });
    }

    const trimmedReason = String(reason || "").trim();
    const trimmedLetter = String(resignation_letter || "").trim();

    if (!trimmedLetter) {
      return res.status(400).json({
        message: "Resignation letter is required",
      });
    }

    if (!trimmedReason) {
      return res.status(400).json({
        message: "Reason is required",
      });
    }

    const parsedReasons = Array.isArray(leaving_reasons)
      ? leaving_reasons
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [];

    if (parsedReasons.length === 0) {
      return res.status(400).json({
        message: "At least one reason for leaving is required",
      });
    }

    const parsedInterviewAnswers = Array.isArray(exit_interview_answers)
      ? exit_interview_answers.map((item) => String(item || "").trim())
      : [];

    if (parsedInterviewAnswers.length !== 16 || parsedInterviewAnswers.some((item) => !item)) {
      return res.status(400).json({
        message: "All 16 exit interview answers are required",
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await ensureResignationsTable(connection);
      await ensureResignationDraftsTable(connection);

      const requester = await getEmployeeProfile(connection, requesterEmpId);
      if (!requester) {
        await connection.rollback();
        return res.status(404).json({ message: "Requester not found" });
      }

      const parsedResignationDate = new Date(resignation_date);
      const parsedLastWorkingDay = new Date(last_working_day);
      const parsedEffectiveDate = new Date(effective_date);

      if (
        Number.isNaN(parsedResignationDate.getTime()) ||
        Number.isNaN(parsedLastWorkingDay.getTime()) ||
        Number.isNaN(parsedEffectiveDate.getTime())
      ) {
        await connection.rollback();
        return res.status(400).json({
          message: "Resignation date and last working day must be valid dates",
        });
      }

      if (parsedResignationDate > parsedLastWorkingDay) {
        await connection.rollback();
        return res.status(400).json({
          message: "Last working day must be on or after resignation date",
        });
      }

      if (String(effective_date) !== String(last_working_day)) {
        await connection.rollback();
        return res.status(400).json({
          message: "Effective date must match last working day",
        });
      }

      if (requester?.hired_date) {
        const parsedHireDate = new Date(requester.hired_date);
        if (!Number.isNaN(parsedHireDate.getTime()) && parsedResignationDate < parsedHireDate) {
          await connection.rollback();
          return res.status(400).json({
            message: "Resignation date cannot be earlier than date of joining",
          });
        }
      }

      const [result] = await connection.query(
        `INSERT INTO resignations (
           emp_id,
           resignation_type,
           effective_date,
           reason,
           resignation_letter,
           recipient_name,
           recipient_emp_id,
           resignation_date,
           last_working_day,
           leaving_reasons_json,
           leaving_reason_other,
           exit_interview_answers_json,
           endorsement_file_key,
           current_step,
           status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 'Pending Approval')`,
        [
          requesterEmpId,
          resignation_type,
          effective_date,
          trimmedReason,
          trimmedLetter,
          recipient_name || null,
          recipient_emp_id || null,
          resignation_date || null,
          last_working_day || null,
          JSON.stringify(parsedReasons),
          String(leaving_reason_other || "").trim() || null,
          JSON.stringify(parsedInterviewAnswers),
          endorsement_file_key || null,
        ],
      );

      await notifyApproversForRequest(connection, {
        requester,
        moduleType: "Resignation",
        requestId: result.insertId,
      });

      await connection.query(
        "DELETE FROM resignation_drafts WHERE emp_id = ?",
        [requesterEmpId],
      );

      await connection.commit();
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }

    res.status(201).json({ message: "Resignation filed successfully" });
  } catch (error) {
    console.error("DB Error in fileResignation:", error);
    res.status(500).json({ message: "Error filing resignation" });
  }
};

export const uploadResignationClearance = async (req, res) => {
  const { id } = req.params;
  const requesterEmpId = req.user?.emp_id;
  const clearanceFileKey = String(req.body?.clearance_file_key || "").trim();

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!clearanceFileKey) {
    return res.status(400).json({ message: "clearance_file_key is required" });
  }

  try {
    await ensureResignationsTable();

    const [rows] = await pool.query(
      "SELECT id, emp_id, status FROM resignations WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Resignation request not found" });
    }

    const resignation = rows[0];
    if (String(resignation.emp_id) !== String(requesterEmpId)) {
      return res.status(403).json({
        message: "You can only upload clearance for your own resignation",
      });
    }

    if (String(resignation.status || "") !== "Approved") {
      return res.status(400).json({
        message: "Clearance upload is only allowed for approved resignations",
      });
    }

    await pool.query(
      "UPDATE resignations SET clearance_file_key = ? WHERE id = ?",
      [clearanceFileKey, id],
    );

    return res.json({ message: "Clearance file uploaded successfully" });
  } catch (error) {
    console.error("DB Error in uploadResignationClearance:", error);
    return res.status(500).json({ message: "Error uploading clearance file" });
  }
};

export const cancelMyResignation = async (req, res) => {
  const { id } = req.params;
  const requesterEmpId = req.user?.emp_id;

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await ensureResignationsTable();

    const [rows] = await pool.query(
      "SELECT id, emp_id, status FROM resignations WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Resignation request not found" });
    }

    const request = rows[0];
    if (String(request.emp_id) !== String(requesterEmpId)) {
      return res.status(403).json({
        message: "You can only cancel your own resignation request",
      });
    }

    const normalizedStatus = String(request.status || "")
      .trim()
      .toLowerCase();
    if (!["pending", "pending approval"].includes(normalizedStatus)) {
      return res.status(400).json({
        message: "Only pending resignation requests can be cancelled",
      });
    }

    await pool.query("DELETE FROM resignations WHERE id = ?", [id]);
    res.json({ message: "Resignation request cancelled successfully" });
  } catch (error) {
    console.error("DB Error in cancelMyResignation:", error);
    res.status(500).json({ message: "Error cancelling resignation request" });
  }
};

export const requestMyResignationCancellation = async (req, res) => {
  const { id } = req.params;
  const requesterEmpId = req.user?.emp_id;
  const cancellationReason = String(req.body?.cancellation_reason || "").trim();

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!cancellationReason) {
    return res.status(400).json({
      message: "Cancellation reason is required",
    });
  }

  try {
    await ensureResignationsTable();

    const [rows] = await pool.query(
      "SELECT id, emp_id, status, effective_date, cancellation_requested_at FROM resignations WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Resignation request not found" });
    }

    const request = rows[0];
    if (String(request.emp_id) !== String(requesterEmpId)) {
      return res.status(403).json({
        message: "You can only request cancellation for your own resignation",
      });
    }

    if (String(request.status || "") !== "Approved") {
      return res.status(400).json({
        message: "Only approved resignations can request cancellation",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effectiveDate = new Date(request.effective_date);
    effectiveDate.setHours(0, 0, 0, 0);
    if (effectiveDate <= today) {
      return res.status(400).json({
        message:
          "Cancellation request is only allowed before the effective resignation date",
      });
    }

    if (request.cancellation_requested_at) {
      return res.status(400).json({
        message: "Cancellation request is already pending approval",
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        "UPDATE resignations SET cancellation_requested_at = NOW(), cancellation_reason = ? WHERE id = ?",
        [cancellationReason, id],
      );

      const requester = await getEmployeeProfile(connection, requesterEmpId);
      if (requester) {
        await notifyApproversForCancellationRequest(connection, {
          requester,
          moduleType: "Resignation",
          requestId: Number(id),
          fromDate: request.effective_date,
          toDate: request.effective_date,
          descriptor: "resignation",
        });
      }

      await connection.commit();
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }

    res.json({ message: "Cancellation request submitted for approval" });
  } catch (error) {
    console.error("DB Error in requestMyResignationCancellation:", error);
    res
      .status(500)
      .json({ message: "Error requesting resignation cancellation" });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    await ensureNotificationsTable();

    const empId = req.user?.emp_id;
    if (!empId) return res.status(401).json({ message: "Unauthorized" });

    const [rows] = await pool.query(
      `
        SELECT
          id,
          notification_type,
          title,
          message,
          reference_type,
          reference_id,
          status,
          created_at,
          read_at
        FROM notifications
        WHERE emp_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [empId],
    );

    res.json(rows);
  } catch (error) {
    console.error("DB Error in getMyNotifications:", error);
    res.status(500).json({ message: "Error fetching notifications" });
  }
};

export const markNotificationRead = async (req, res) => {
  const { id } = req.params;

  try {
    await ensureNotificationsTable();

    const empId = req.user?.emp_id;
    if (!empId) return res.status(401).json({ message: "Unauthorized" });

    const [result] = await pool.query(
      `
        UPDATE notifications
        SET status = 'Read',
            read_at = COALESCE(read_at, NOW())
        WHERE id = ?
          AND emp_id = ?
      `,
      [id, empId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("DB Error in markNotificationRead:", error);
    res.status(500).json({ message: "Error updating notification" });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await ensureNotificationsTable();

    const empId = req.user?.emp_id;
    if (!empId) return res.status(401).json({ message: "Unauthorized" });

    await pool.query(
      `
        UPDATE notifications
        SET status = 'Read',
            read_at = COALESCE(read_at, NOW())
        WHERE emp_id = ?
          AND status = 'Unread'
      `,
      [empId],
    );

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("DB Error in markAllNotificationsRead:", error);
    res.status(500).json({ message: "Error updating notifications" });
  }
};

export const deleteNotification = async (req, res) => {
  const { id } = req.params;

  try {
    await ensureNotificationsTable();

    const empId = req.user?.emp_id;
    if (!empId) return res.status(401).json({ message: "Unauthorized" });

    const [result] = await pool.query(
      `
        DELETE FROM notifications
        WHERE id = ?
          AND emp_id = ?
      `,
      [id, empId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("DB Error in deleteNotification:", error);
    res.status(500).json({ message: "Error deleting notification" });
  }
};

export const deleteAllNotifications = async (req, res) => {
  try {
    await ensureNotificationsTable();

    const empId = req.user?.emp_id;
    if (!empId) return res.status(401).json({ message: "Unauthorized" });

    await pool.query(
      `
        DELETE FROM notifications
        WHERE emp_id = ?
      `,
      [empId],
    );

    res.json({ message: "All notifications deleted" });
  } catch (error) {
    console.error("DB Error in deleteAllNotifications:", error);
    res.status(500).json({ message: "Error deleting notifications" });
  }
};

// --- LEAVES & ATTENDANCE ---
export const getAttendance = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.emp_id, 
        e.first_name, 
        e.last_name, 
        e.status AS emp_status, 
        (SELECT COUNT(*) FROM attendance WHERE emp_id = e.emp_id AND status = 'Absent') as total_absences,
        a.status,
        a.status2,
        lb.leave_balance
      FROM employees e
      LEFT JOIN attendance a ON e.emp_id = a.emp_id AND a.date = CURDATE()
      LEFT JOIN leave_balances lb ON e.emp_id = lb.emp_id
      WHERE COALESCE(e.role, '') <> 'Admin'
    `);
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getAttendance:", error);
    res.status(500).json({ message: "Error fetching attendance" });
  }
};

export const getAttendanceCalendarSummary = async (req, res) => {
  const { month, year } = req.query;
  try {
    const [rows] = await pool.query(
      `
      SELECT DATE_FORMAT(date, '%Y-%m-%d') as date, 
             DATE_FORMAT(date, '%Y-%m-%d') as formatted_date,
             SUM(CASE WHEN status = 'Present' OR status2 = 'Present' THEN 1 ELSE 0 END) as present_count,
             SUM(CASE WHEN status = 'Absent' OR status2 = 'Absent' THEN 1 ELSE 0 END) as absent_count,
             SUM(CASE WHEN status = 'Late' OR status2 = 'Late' THEN 1 ELSE 0 END) as late_count,
             SUM(CASE WHEN status = 'Undertime' OR status2 = 'Undertime' THEN 1 ELSE 0 END) as undertime_count,
             SUM(CASE WHEN status = 'Half-Day' OR status2 = 'Half-Day' THEN 1 ELSE 0 END) as halfday_count,
             SUM(CASE WHEN status = 'On Leave' OR status2 = 'On Leave' THEN 1 ELSE 0 END) as leave_count
      FROM attendance 
      WHERE MONTH(date) = ? AND YEAR(date) = ?
      GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
    `,
      [month, year],
    );
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getAttendanceCalendarSummary:", error);
    res.status(500).json({ message: "Error fetching calendar summary" });
  }
};

export const getDailyAttendance = async (req, res) => {
  const { date } = req.query;
  try {
    const [rows] = await pool.query(
      `
      SELECT e.emp_id, e.first_name, e.last_name, e.status as emp_status, a.status as attendance_status, a.status2
      FROM employees e
      LEFT JOIN attendance a ON e.emp_id = a.emp_id AND DATE_FORMAT(a.date, '%Y-%m-%d') = ?
      WHERE COALESCE(e.role, '') <> 'Admin'
    `,
      [date],
    );
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getDailyAttendance:", error);
    res.status(500).json({ message: "Error fetching daily attendance" });
  }
};

export const saveBulkAttendance = async (req, res) => {
  const { date, records } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Wipe existing attendance matching the exact formatted date string
    await connection.query(
      `DELETE a FROM attendance a
       JOIN employees e ON a.emp_id = e.emp_id
       WHERE DATE_FORMAT(a.date, '%Y-%m-%d') = ? AND COALESCE(e.role, '') <> 'Admin'`,
      [date],
    );

    // 2. Insert the fresh records including status2
    if (records && records.length > 0) {
      for (const record of records) {
        await connection.query(
          `INSERT INTO attendance (emp_id, date, status, status2) VALUES (?, DATE(?), ?, ?)`,
          [record.emp_id, date, record.status, record.status2 || null],
        );
      }
    }

    await connection.commit();
    res.json({ message: "Attendance saved successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in saveBulkAttendance:", error);
    res.status(500).json({ message: "Error saving attendance" });
  } finally {
    connection.release();
  }
};

// New function for Admins to manually adjust leave balances
export const adjustLeaveBalance = async (req, res) => {
  const { id } = req.params;
  const { adjustment } = req.body;
  try {
    await pool.query(
      "UPDATE leave_balances SET leave_balance = leave_balance + ? WHERE emp_id = ?",
      [adjustment, id],
    );
    res.json({ message: "Leave balance adjusted successfully" });
  } catch (error) {
    console.error("DB Error in adjustLeaveBalance:", error);
    res.status(500).json({ message: "Error adjusting leave balance" });
  }
};

//TODO:
export const getAllLeaves = async (req, res) => {
  try {
    await ensureLeaveApprovalColumns();

    const viewer = await getEmployeeProfile(pool, req.user?.emp_id);
    if (!viewer) return res.status(401).json({ message: "Unauthorized" });

    let query = `
      SELECT 
        l.*, 
        DATE_FORMAT(l.date_from, '%Y-%m-%d') as date_from,
    DATE_FORMAT(l.date_to, '%Y-%m-%d') as date_to,
        e.first_name, 
        e.last_name, 
        e.email,          
        e.designation, 
        COALESCE(e.role, 'RankAndFile') as requester_role
      FROM leave_requests l
      JOIN employees e ON l.emp_id = e.emp_id
    `;
    const queryParams = [];

    if (viewer.role === "RankAndFile") {
      query += " WHERE l.emp_id = ?";
      queryParams.push(viewer.emp_id);
    } else if (viewer.role === "Supervisor") {
      query += `
        WHERE l.emp_id = ?
           OR (
             e.designation = ?
             AND e.emp_id <> ?
           )
      `;
      queryParams.push(viewer.emp_id, viewer.designation || "", viewer.emp_id);
    }

    query += " ORDER BY l.id DESC";

    const [rows] = await pool.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getAllLeaves:", error);
    res.status(500).json({ message: "Error fetching leaves" });
  }
};

export const updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const {
    status,
    supervisor_remarks,
    approved_days,
    approved_dates,
    decision_mode,
  } = req.body;
  const trimmedRemarks = String(supervisor_remarks || "").trim();

  if (
    !["Pending", "Approved", "Denied", "Partially Approved"].includes(status)
  ) {
    return res.status(400).json({ message: "Invalid leave status" });
  }

  const approverId = req.user?.emp_id;
  if (!approverId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureLeaveApprovalColumns(connection);

    const approver = await getEmployeeProfile(connection, approverId);
    if (!approver) {
      await connection.rollback();
      return res.status(401).json({ message: "Approver not found" });
    }

    const [rows] = await connection.query(
      "SELECT id, emp_id, date_from, date_to, status, approved_days, cancellation_requested_at FROM leave_requests WHERE id = ? LIMIT 1",
      [id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Leave request not found" });
    }

    const leaveRequest = rows[0];
    const requester = await getEmployeeProfile(connection, leaveRequest.emp_id);

    const totalRequestDays =
      Math.floor(
        (new Date(leaveRequest.date_to).getTime() -
          new Date(leaveRequest.date_from).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    const getEffectiveApprovedDays = (statusValue, approvedDaysValue) => {
      if (
        !["Approved", "Partially Approved"].includes(String(statusValue || ""))
      ) {
        return 0;
      }

      const parsedValue = Number(approvedDaysValue);
      if (!Number.isNaN(parsedValue) && parsedValue > 0) {
        return parsedValue;
      }

      return String(statusValue || "") === "Approved" ? totalRequestDays : 0;
    };

    const previousEffectiveApprovedDays = getEffectiveApprovedDays(
      leaveRequest.status,
      leaveRequest.approved_days,
    );

    if (!canApproverReviewRequester(approver, requester)) {
      await connection.rollback();
      return res.status(403).json({
        message: "You are not allowed to approve this leave request",
      });
    }

    if (decision_mode === "cancellation") {
      if (!["Approved", "Denied"].includes(status)) {
        await connection.rollback();
        return res.status(400).json({
          message: "Invalid cancellation decision status",
        });
      }

      if (!leaveRequest.cancellation_requested_at) {
        await connection.rollback();
        return res.status(400).json({
          message: "No cancellation request is pending approval",
        });
      }

      if (status === "Denied" && !trimmedRemarks) {
        await connection.rollback();
        return res.status(400).json({
          message: "Reason is required for denial",
        });
      }

      if (!["Approved", "Partially Approved"].includes(leaveRequest.status)) {
        await connection.rollback();
        return res.status(400).json({
          message: "Only approved leave requests can be cancelled",
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(leaveRequest.date_from);
      startDate.setHours(0, 0, 0, 0);
      if (startDate <= today) {
        await connection.rollback();
        return res.status(400).json({
          message: "Cannot process cancellation on or after the start date",
        });
      }

      if (status === "Approved") {
        await connection.query("DELETE FROM leave_requests WHERE id = ?", [id]);
      } else {
        await connection.query(
          `
            UPDATE leave_requests
            SET cancellation_requested_at = NULL,
                supervisor_remarks = ?
            WHERE id = ?
          `,
          [trimmedRemarks, id],
        );
      }

      await recalculateLeaveBalanceForEmployee(connection, leaveRequest.emp_id);

      await notifyRequesterForCancellationDecision(connection, {
        requesterEmpId: leaveRequest.emp_id,
        moduleType: "Leave",
        status,
        approverName: `${approver.first_name} ${approver.last_name}`.trim(),
        fromDate: leaveRequest.date_from,
        toDate: leaveRequest.date_to,
        descriptor: "leave request",
      });

      await connection.commit();
      return res.json({
        message: `Leave cancellation ${status.toLowerCase()} successfully`,
      });
    }

    const parsedApprovedDays =
      approved_days !== undefined && approved_days !== null
        ? Number(approved_days)
        : null;

    const parsedApprovedDates = Array.isArray(approved_dates)
      ? approved_dates
          .map((d) => String(d || "").trim())
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];

    if (status === "Partially Approved") {
      if (!parsedApprovedDays || parsedApprovedDays <= 0) {
        await connection.rollback();
        return res.status(400).json({
          message:
            "approved_days must be greater than zero for partial approval",
        });
      }

      if (parsedApprovedDays >= totalRequestDays) {
        await connection.rollback();
        return res.status(400).json({
          message: "approved_days must be less than the total requested days",
        });
      }
    }

    if (status === "Denied" && !trimmedRemarks) {
      await connection.rollback();
      return res.status(400).json({
        message: "Reason is required for denial",
      });
    }

    const remarksValue = status === "Denied" ? trimmedRemarks : null;

    if (status === "Approved" && parsedApprovedDays !== null) {
      if (parsedApprovedDays <= 0 || parsedApprovedDays > totalRequestDays) {
        await connection.rollback();
        return res.status(400).json({
          message: "approved_days is out of range for this request",
        });
      }
    }

    if (parsedApprovedDates.length > 0) {
      const fromDate = new Date(leaveRequest.date_from).setHours(0, 0, 0, 0);
      const toDate = new Date(leaveRequest.date_to).setHours(0, 0, 0, 0);

      const hasOutOfRangeDate = parsedApprovedDates.some((dateString) => {
        const value = new Date(dateString).setHours(0, 0, 0, 0);
        return value < fromDate || value > toDate;
      });

      if (hasOutOfRangeDate) {
        await connection.rollback();
        return res.status(400).json({
          message: "approved_dates contains date(s) outside the request range",
        });
      }
    }

    const finalApprovedDays =
      status === "Denied"
        ? null
        : parsedApprovedDays !== null
          ? parsedApprovedDays
          : status === "Approved"
            ? totalRequestDays
            : null;

    const finalApprovedDates =
      status === "Denied"
        ? null
        : parsedApprovedDates.length > 0
          ? JSON.stringify(parsedApprovedDates)
          : null;

    const nextEffectiveApprovedDays = getEffectiveApprovedDays(
      status,
      finalApprovedDays,
    );

    const leaveBalanceDelta =
      Number(nextEffectiveApprovedDays || 0) -
      Number(previousEffectiveApprovedDays || 0);

    await connection.query(
      `
        UPDATE leave_requests
        SET status = ?,
            approved_days = ?,
            approved_dates = ?,
            supervisor_remarks = ?
        WHERE id = ?
      `,
      [status, finalApprovedDays, finalApprovedDates, remarksValue, id],
    );

    if (leaveBalanceDelta !== 0) {
      await recalculateLeaveBalanceForEmployee(connection, leaveRequest.emp_id);
    }

    await notifyRequesterForDecision(connection, {
      requesterEmpId: leaveRequest.emp_id,
      moduleType: "Leave",
      status,
      approverName: `${approver.first_name} ${approver.last_name}`.trim(),
    });

    await connection.commit();
    res.json({ message: `Leave ${status}` });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in updateLeaveStatus:", error);
    res.status(500).json({ message: "Error updating leave" });
  } finally {
    connection.release();
  }
};

// --- PAYROLL ---
// --- PAYROLL ---
export const getAllPayroll = async (req, res) => {
  try {
    const { period } = req.query;
    const { periodStart } = parsePeriodRange(period);
    const viewer = await getEmployeeProfile(pool, req.user?.emp_id);

    if (!viewer) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let scopedWhereClause = "p.period_start = ?";
    const scopedParams = [periodStart];

    if (viewer.role === "RankAndFile") {
      scopedWhereClause += " AND p.emp_id = ?";
      scopedParams.push(viewer.emp_id);
    } else if (viewer.role === "Supervisor") {
      scopedWhereClause += `
        AND (
          p.emp_id = ?
          OR (
            COALESCE(e.role, '') IN ('RankAndFile', 'HR', 'Admin')
            AND e.designation = ?
            AND e.emp_id <> ?
          )
        )
      `;
      scopedParams.push(viewer.emp_id, viewer.designation || "", viewer.emp_id);
    }

    // FIX: Added the WHERE clause to only fetch payrolls for the selected month!
    const [rows] = await pool.query(
      `SELECT
         p.*,
         e.first_name,
         e.last_name,
         e.designation,
         e.profile_photo,
         e.position,
         COALESCE(adj.total_incentives, p.incentives, 0) AS recalculated_incentives,
         COALESCE(adj.total_deductions, p.absence_deductions, 0) AS recalculated_deductions,
         adj.adjustment_reasons,
         adj.incentive_reasons,
         adj.deduction_reasons
       FROM payroll p
       JOIN employees e ON p.emp_id = e.emp_id
       LEFT JOIN (
         SELECT
           emp_id,
           GROUP_CONCAT(
             CASE
               WHEN type IN ('Bonus', 'Increase') THEN CONCAT(
                 COALESCE(NULLIF(TRIM(description), ''), 'Unspecified incentive type'),
                 ' = ₱',
                 FORMAT(ABS(amount), 2)
               )
               ELSE NULL
             END
             ORDER BY effective_date DESC, id DESC
             SEPARATOR ' | '
           ) AS incentive_reasons,
           COALESCE(
             SUM(CASE WHEN type IN ('Bonus', 'Increase') THEN ABS(amount) ELSE 0 END),
             0
           ) AS total_incentives,
           GROUP_CONCAT(
             CASE
               WHEN type = 'Decrease' THEN CONCAT(
                 COALESCE(NULLIF(TRIM(description), ''), 'Unspecified deduction type'),
                 ' = ₱',
                 FORMAT(ABS(amount), 2)
               )
               ELSE NULL
             END
             ORDER BY effective_date DESC, id DESC
             SEPARATOR ' | '
           ) AS deduction_reasons,
           COALESCE(
             SUM(CASE WHEN type = 'Decrease' THEN ABS(amount) ELSE 0 END),
             0
           ) AS total_deductions,
           GROUP_CONCAT(
             CONCAT(
               type,
               ': ',
               COALESCE(NULLIF(TRIM(description), ''), 'Unspecified type'),
               ' = ₱',
               FORMAT(ABS(amount), 2)
             )
             ORDER BY effective_date DESC, id DESC
             SEPARATOR ' | '
           ) AS adjustment_reasons
         FROM salary_history
         WHERE DATE_FORMAT(effective_date, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')
         GROUP BY emp_id
       ) adj ON adj.emp_id = p.emp_id
       WHERE ${scopedWhereClause}
       ORDER BY
         CAST(COALESCE(NULLIF(REGEXP_SUBSTR(p.emp_id, '[0-9]+$'), ''), '0') AS UNSIGNED) ASC,
         p.emp_id ASC`,
      [periodStart, ...scopedParams],
    );

    const enrichedRows = rows.map((row) => {
      const basicPay = Number(row.basic_pay || 0);
      const incentives = Number(row.recalculated_incentives || 0);
      const totalDeductions = Number(row.recalculated_deductions || 0);
      const netPay = Number(
        (basicPay + incentives - totalDeductions).toFixed(2),
      );

      return {
        ...row,
        absences_count: 0,
        converted_absences: 0,
        incentives,
        absence_deductions: totalDeductions,
        baseline_absence_deductions: 0,
        adjustment_deductions: totalDeductions,
        net_pay: netPay,
      };
    });

    res.json(enrichedRows);
  } catch (error) {
    console.error("DB Error in getAllPayroll:", error);
    res.status(500).json({ message: "Error fetching payroll" });
  }
};

export const getWorkweekConfigs = async (req, res) => {
  try {
    await ensureWorkweekConfigsTable();

    const [rows] = await pool.query(
      `
        SELECT
          id,
          workweek_type,
          effective_from,
          effective_to,
          hours_per_day,
          absence_unit,
          created_at,
          updated_at
        FROM workweek_configs
        ORDER BY effective_from DESC
      `,
    );

    res.json(rows);
  } catch (error) {
    console.error("DB Error in getWorkweekConfigs:", error);
    res.status(500).json({ message: "Error fetching workweek configs" });
  }
};

export const upsertWorkweekConfig = async (req, res) => {
  const { workweek_type, effective_from, effective_to } = req.body;

  const normalizedType = normalizeWorkweekType(workweek_type);

  if (!normalizedType || !effective_from) {
    return res.status(400).json({
      message: "workweek_type and effective_from are required",
    });
  }

  const newFrom = new Date(effective_from);
  const newTo = effective_to ? new Date(effective_to) : null;

  if (Number.isNaN(newFrom.getTime())) {
    return res.status(400).json({ message: "Invalid effective_from date" });
  }

  if (newTo && Number.isNaN(newTo.getTime())) {
    return res.status(400).json({ message: "Invalid effective_to date" });
  }

  if (newTo && newTo < newFrom) {
    return res
      .status(400)
      .json({ message: "effective_to must be on or after effective_from" });
  }

  const { hoursPerDay, absenceUnit } = WORKWEEK_DEFAULTS[normalizedType];
  const normalizedTo = effective_to || null;
  const overlapEndDate = normalizedTo || "9999-12-31";

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureWorkweekConfigsTable(connection);

    const [overlaps] = await connection.query(
      `
        SELECT id
        FROM workweek_configs
        WHERE effective_from <> ?
          AND effective_from <= ?
          AND COALESCE(effective_to, '9999-12-31') >= ?
        LIMIT 1
      `,
      [effective_from, overlapEndDate, effective_from],
    );

    if (overlaps.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: "Workweek date range overlaps with an existing configuration",
      });
    }

    await connection.query(
      `
        INSERT INTO workweek_configs (
          workweek_type,
          effective_from,
          effective_to,
          hours_per_day,
          absence_unit
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          workweek_type = VALUES(workweek_type),
          effective_to = VALUES(effective_to),
          hours_per_day = VALUES(hours_per_day),
          absence_unit = VALUES(absence_unit)
      `,
      [normalizedType, effective_from, normalizedTo, hoursPerDay, absenceUnit],
    );

    await connection.commit();
    res.json({ message: "Workweek configuration saved successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in upsertWorkweekConfig:", error);
    res.status(500).json({ message: "Error saving workweek config" });
  } finally {
    connection.release();
  }
};

export const updateWorkweekConfigById = async (req, res) => {
  const { id } = req.params;
  const { workweek_type, effective_from, effective_to } = req.body;

  const normalizedType = normalizeWorkweekType(workweek_type);

  if (!normalizedType || !effective_from) {
    return res.status(400).json({
      message: "workweek_type and effective_from are required",
    });
  }

  const newFrom = new Date(effective_from);
  const newTo = effective_to ? new Date(effective_to) : null;

  if (Number.isNaN(newFrom.getTime())) {
    return res.status(400).json({ message: "Invalid effective_from date" });
  }

  if (newTo && Number.isNaN(newTo.getTime())) {
    return res.status(400).json({ message: "Invalid effective_to date" });
  }

  if (newTo && newTo < newFrom) {
    return res
      .status(400)
      .json({ message: "effective_to must be on or after effective_from" });
  }

  const { hoursPerDay, absenceUnit } = WORKWEEK_DEFAULTS[normalizedType];
  const normalizedTo = effective_to || null;
  const overlapEndDate = normalizedTo || "9999-12-31";

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureWorkweekConfigsTable(connection);

    const [existing] = await connection.query(
      "SELECT id FROM workweek_configs WHERE id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Workweek config not found" });
    }

    const [overlaps] = await connection.query(
      `
        SELECT id
        FROM workweek_configs
        WHERE id <> ?
          AND effective_from <= ?
          AND COALESCE(effective_to, '9999-12-31') >= ?
        LIMIT 1
      `,
      [id, overlapEndDate, effective_from],
    );

    if (overlaps.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: "Workweek date range overlaps with an existing configuration",
      });
    }

    await connection.query(
      `
        UPDATE workweek_configs
        SET workweek_type = ?,
            effective_from = ?,
            effective_to = ?,
            hours_per_day = ?,
            absence_unit = ?
        WHERE id = ?
      `,
      [
        normalizedType,
        effective_from,
        normalizedTo,
        hoursPerDay,
        absenceUnit,
        id,
      ],
    );

    await connection.commit();
    res.json({ message: "Workweek configuration updated successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in updateWorkweekConfigById:", error);
    res.status(500).json({ message: "Error updating workweek config" });
  } finally {
    connection.release();
  }
};

export const deleteWorkweekConfigById = async (req, res) => {
  const { id } = req.params;

  try {
    await ensureWorkweekConfigsTable();

    const [result] = await pool.query(
      "DELETE FROM workweek_configs WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Workweek config not found" });
    }

    res.json({ message: "Workweek configuration deleted successfully" });
  } catch (error) {
    console.error("DB Error in deleteWorkweekConfigById:", error);
    res.status(500).json({ message: "Error deleting workweek config" });
  }
};

// --- OFFSET ENGINE ---
const calculateMonthlyOffsetBalance = async (empId, year, month) => {
  await ensureOffsetTables();

  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [attendanceRows] = await pool.query(
    `
      SELECT COUNT(*) as working_days
      FROM attendance a
      WHERE a.emp_id = ?
        AND a.date BETWEEN ? AND ?
        AND a.status IN ('Present', 'Late', 'Undertime', 'Field', 'Half-Day')
    `,
    [empId, periodStart, periodEnd],
  );

  const workingDaysCompleted = Number(attendanceRows[0]?.working_days || 0);
  const baselineDays = 22;

  const [prevBalanceRows] = await pool.query(
    `
      SELECT final_balance
      FROM offset_ledger
      WHERE emp_id = ?
      ORDER BY period_year DESC, period_month DESC
      LIMIT 1
    `,
    [empId],
  );

  const carriedOver = Number(prevBalanceRows[0]?.final_balance || 0);

  let offsetEarned = 0;
  let offsetUsed = 0;
  let finalBalance = carriedOver;

  if (workingDaysCompleted >= baselineDays) {
    offsetEarned = workingDaysCompleted - baselineDays;
    finalBalance = carriedOver + offsetEarned;
  } else {
    const deficit = baselineDays - workingDaysCompleted;
    const availableOffsets = carriedOver;
    offsetUsed = Math.min(deficit, availableOffsets);
    finalBalance = carriedOver - offsetUsed;

    if (offsetUsed < deficit) {
      finalBalance = Math.max(0, finalBalance - (deficit - offsetUsed));
    }
  }

  return {
    workingDaysCompleted,
    baselineDays,
    offsetEarned: Number(offsetEarned.toFixed(2)),
    offsetUsed: Number(offsetUsed.toFixed(2)),
    carriedOver: Number(carriedOver.toFixed(2)),
    finalBalance: Number(finalBalance.toFixed(2)),
  };
};

export const getOffsetBalance = async (req, res) => {
  const { emp_id } = req.params;
  const { year, month } = req.query;

  const queryYear = year ? Number(year) : new Date().getFullYear();
  const queryMonth = month ? Number(month) : new Date().getMonth() + 1;

  try {
    const balance = await calculateMonthlyOffsetBalance(
      emp_id,
      queryYear,
      queryMonth,
    );
    res.json(balance);
  } catch (error) {
    console.error("DB Error in getOffsetBalance:", error);
    res.status(500).json({ message: "Error calculating offset balance" });
  }
};

export const fileOffsetApplication = async (req, res) => {
  const { emp_id, date_from, date_to, days_applied, reason } = req.body;
  const resolvedDateTo = date_to || date_from;
  const trimmedReason = String(reason || "").trim();

  const requesterEmpId =
    req.user?.role === "Admin" && emp_id ? emp_id : req.user?.emp_id || emp_id;

  if (
    !requesterEmpId ||
    !date_from ||
    !resolvedDateTo ||
    days_applied === undefined
  ) {
    return res.status(400).json({
      message: "emp_id, date_from, and days_applied are required",
    });
  }

  if (!trimmedReason) {
    return res.status(400).json({
      message: "Reason is required for offset applications",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureOffsetTables(connection);

    const requester = await getEmployeeProfile(connection, requesterEmpId);
    if (!requester) {
      await connection.rollback();
      return res.status(404).json({ message: "Requester not found" });
    }

    const [result] = await connection.query(
      `
        INSERT INTO offset_applications (
          emp_id,
          date_from,
          date_to,
          days_applied,
          reason,
          status
        ) VALUES (?, ?, ?, ?, ?, 'Pending')
      `,
      [requesterEmpId, date_from, resolvedDateTo, days_applied, trimmedReason],
    );

    await notifyApproversForRequest(connection, {
      requester,
      moduleType: "Offset",
      requestId: result.insertId,
    });

    await connection.commit();

    res
      .status(201)
      .json({ message: "Offset application submitted successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in fileOffsetApplication:", error);
    res.status(500).json({ message: "Error filing offset application" });
  } finally {
    connection.release();
  }
};

export const getOffsetApplications = async (req, res) => {
  try {
    await ensureOffsetTables();

    const viewer = await getEmployeeProfile(pool, req.user?.emp_id);
    if (!viewer) return res.status(401).json({ message: "Unauthorized" });

    let query = `
      SELECT
        oa.*,
        e.first_name,
        e.last_name,
        e.designation,
        COALESCE(e.role, 'RankAndFile') as requester_role,
        sup.first_name as supervisor_first_name,
        sup.last_name as supervisor_last_name
      FROM offset_applications oa
      JOIN employees e ON oa.emp_id = e.emp_id
      LEFT JOIN employees sup ON oa.supervisor_emp_id = sup.emp_id
    `;
    const queryParams = [];

    if (viewer.role === "RankAndFile") {
      query += " WHERE oa.emp_id = ?";
      queryParams.push(viewer.emp_id);
    } else if (viewer.role === "Supervisor") {
      query += `
        WHERE oa.emp_id = ?
           OR (
             e.designation = ?
             AND e.emp_id <> ?
           )
      `;
      queryParams.push(viewer.emp_id, viewer.designation || "", viewer.emp_id);
    }
    // FIX: If the role is HR or Admin, the query falls through here
    // and fetches EVERYTHING without a WHERE restriction!

    query += " ORDER BY oa.created_at DESC";

    const [rows] = await pool.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error("DB Error in getOffsetApplications:", error);
    res.status(500).json({ message: "Error fetching offset applications" });
  }
};

export const updateOffsetApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status, approved_days, supervisor_remarks, decision_mode } = req.body;
  const trimmedRemarks = String(supervisor_remarks || "").trim();
  const supervisorId = req.user?.emp_id;

  if (!supervisorId) {
    return res.status(401).json({ message: "Supervisor ID required" });
  }

  if (
    !["Pending", "Approved", "Denied", "Partially Approved"].includes(status)
  ) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureOffsetTables(connection);

    const [existing] = await connection.query(
      "SELECT * FROM offset_applications WHERE id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Offset application not found" });
    }

    const application = existing[0];

    const approver = await getEmployeeProfile(connection, supervisorId);
    const requester = await getEmployeeProfile(connection, application.emp_id);

    // FIX: Explicitly allow HR and Admin to bypass the strict supervisor-only check for Offsets
    const isHRorAdmin = approver.role === "HR" || approver.role === "Admin";

    if (!isHRorAdmin && !canApproverReviewRequester(approver, requester)) {
      await connection.rollback();
      return res.status(403).json({
        message: "You are not allowed to approve this offset request",
      });
    }

    if (decision_mode === "cancellation") {
      if (!["Approved", "Denied"].includes(status)) {
        await connection.rollback();
        return res.status(400).json({
          message: "Invalid cancellation decision status",
        });
      }

      if (!application.cancellation_requested_at) {
        await connection.rollback();
        return res.status(400).json({
          message: "No cancellation request is pending approval",
        });
      }

      if (status === "Denied" && !trimmedRemarks) {
        await connection.rollback();
        return res.status(400).json({
          message: "Reason is required for denial",
        });
      }

      if (!["Approved", "Partially Approved"].includes(application.status)) {
        await connection.rollback();
        return res.status(400).json({
          message: "Only approved offset requests can be cancelled",
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(application.date_from);
      startDate.setHours(0, 0, 0, 0);
      if (startDate <= today) {
        await connection.rollback();
        return res.status(400).json({
          message: "Cannot process cancellation on or after the start date",
        });
      }

      if (status === "Approved") {
        await connection.query("DELETE FROM offset_applications WHERE id = ?", [
          id,
        ]);
      } else {
        await connection.query(
          `
            UPDATE offset_applications
            SET cancellation_requested_at = NULL,
                supervisor_remarks = ?
            WHERE id = ?
          `,
          [trimmedRemarks, id],
        );
      }

      await notifyRequesterForCancellationDecision(connection, {
        requesterEmpId: application.emp_id,
        moduleType: "Offset",
        status,
        approverName: `${approver.first_name} ${approver.last_name}`.trim(),
        fromDate: application.date_from,
        toDate: application.date_to,
        descriptor: "offset request",
      });

      await connection.commit();
      return res.json({
        message: `Offset cancellation ${status.toLowerCase()} successfully`,
      });
    }

    if (status === "Partially Approved" && !approved_days) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "approved_days required for partial approval" });
    }

    if (status === "Denied" && !trimmedRemarks) {
      await connection.rollback();
      return res.status(400).json({
        message: "Reason is required for denial",
      });
    }

    const remarksValue = status === "Denied" ? trimmedRemarks : null;

    await connection.query(
      `
        UPDATE offset_applications
        SET status = ?,
            approved_days = ?,
            supervisor_emp_id = ?,
            supervisor_remarks = ?,
            approved_at = ?
        WHERE id = ?
      `,
      [
        status,
        status === "Partially Approved" ? approved_days : null,
        supervisorId,
        remarksValue,
        status === "Approved" || status === "Partially Approved"
          ? new Date()
          : null,
        id,
      ],
    );

    await notifyRequesterForDecision(connection, {
      requesterEmpId: application.emp_id,
      moduleType: "Offset",
      status,
      approverName: `${approver.first_name} ${approver.last_name}`.trim(),
    });

    await connection.commit();
    res.json({
      message: `Offset application ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in updateOffsetApplicationStatus:", error);
    res.status(500).json({ message: "Error updating offset application" });
  } finally {
    connection.release();
  }
};

export const cancelMyOffsetApplication = async (req, res) => {
  const { id } = req.params;
  const requesterEmpId = req.user?.emp_id;

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await ensureOffsetTables();

    const [rows] = await pool.query(
      "SELECT id, emp_id, status FROM offset_applications WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Offset request not found" });
    }

    const request = rows[0];
    if (String(request.emp_id) !== String(requesterEmpId)) {
      return res
        .status(403)
        .json({ message: "You can only cancel your own offset request" });
    }

    const normalizedStatus = String(request.status || "")
      .trim()
      .toLowerCase();
    if (!["pending", "pending approval"].includes(normalizedStatus)) {
      return res
        .status(400)
        .json({ message: "Only pending offset requests can be cancelled" });
    }

    await pool.query("DELETE FROM offset_applications WHERE id = ?", [id]);
    res.json({ message: "Offset request cancelled successfully" });
  } catch (error) {
    console.error("DB Error in cancelMyOffsetApplication:", error);
    res.status(500).json({ message: "Error cancelling offset request" });
  }
};

export const requestMyOffsetCancellation = async (req, res) => {
  const { id } = req.params;
  const requesterEmpId = req.user?.emp_id;
  const cancellationReason = String(req.body?.cancellation_reason || "").trim();

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!cancellationReason) {
    return res.status(400).json({
      message: "Cancellation reason is required",
    });
  }

  try {
    await ensureOffsetTables();

    const [rows] = await pool.query(
      "SELECT id, emp_id, status, date_from, cancellation_requested_at FROM offset_applications WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Offset request not found" });
    }

    const request = rows[0];
    if (String(request.emp_id) !== String(requesterEmpId)) {
      return res.status(403).json({
        message:
          "You can only request cancellation for your own offset request",
      });
    }

    if (
      !["Approved", "Partially Approved"].includes(String(request.status || ""))
    ) {
      return res.status(400).json({
        message: "Only approved offset requests can request cancellation",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(request.date_from);
    startDate.setHours(0, 0, 0, 0);
    if (startDate <= today) {
      return res.status(400).json({
        message: "Cancellation request is only allowed before the start date",
      });
    }

    if (request.cancellation_requested_at) {
      return res.status(400).json({
        message: "Cancellation request is already pending approval",
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        "UPDATE offset_applications SET cancellation_requested_at = NOW(), cancellation_reason = ? WHERE id = ?",
        [cancellationReason, id],
      );

      const requester = await getEmployeeProfile(connection, requesterEmpId);
      if (requester) {
        await notifyApproversForCancellationRequest(connection, {
          requester,
          moduleType: "Offset",
          requestId: Number(id),
          fromDate: request.date_from,
          toDate: request.date_to,
          descriptor: "offset request",
        });
      }

      await connection.commit();
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }

    res.json({ message: "Cancellation request submitted for approval" });
  } catch (error) {
    console.error("DB Error in requestMyOffsetCancellation:", error);
    res.status(500).json({ message: "Error requesting offset cancellation" });
  }
};

const normalizeAdjustmentType = (rawType) => {
  const normalized = String(rawType || "")
    .trim()
    .toLowerCase();

  if (["decrease", "deduction", "deductions"].includes(normalized)) {
    return "Decrease";
  }

  if (["increase", "incentive", "incentives", "raise"].includes(normalized)) {
    return "Increase";
  }

  if (["bonus"].includes(normalized)) {
    return "Bonus";
  }

  return null;
};

const recomputePayrollForEmployeesPeriod = async (
  connection,
  empIds,
  period,
) => {
  if (!Array.isArray(empIds) || empIds.length === 0) return;

  const uniqueEmpIds = Array.from(new Set(empIds));
  const placeholders = uniqueEmpIds.map(() => "?").join(", ");
  const { periodStart } = parsePeriodRange(period);

  const [adjustmentTotals] = await connection.query(
    `SELECT
       emp_id,
       COALESCE(
         SUM(CASE WHEN type IN ('Bonus', 'Increase') THEN ABS(amount) ELSE 0 END),
         0
       ) AS total_incentives,
       COALESCE(
         SUM(CASE WHEN type = 'Decrease' THEN ABS(amount) ELSE 0 END),
         0
       ) AS total_deductions
     FROM salary_history
     WHERE DATE_FORMAT(effective_date, '%Y-%m') = ?
       AND emp_id IN (${placeholders})
     GROUP BY emp_id`,
    [period, ...uniqueEmpIds],
  );

  const totalsByEmp = new Map(
    adjustmentTotals.map((row) => [
      row.emp_id,
      {
        incentives: Number(row.total_incentives || 0),
        deductions: Number(row.total_deductions || 0),
      },
    ]),
  );

  const [payrollRows] = await connection.query(
    `SELECT emp_id
     FROM payroll
     WHERE period_start = ?
       AND emp_id IN (${placeholders})`,
    [periodStart, ...uniqueEmpIds],
  );

  for (const row of payrollRows) {
    const totals = totalsByEmp.get(row.emp_id) || {
      incentives: 0,
      deductions: 0,
    };

    await connection.query(
      `UPDATE payroll
       SET incentives = ?,
           absence_deductions = ?,
           gross_pay = ROUND(basic_pay + ?, 2),
           net_pay = ROUND((basic_pay + ?) - ?, 2)
       WHERE period_start = ?
         AND emp_id = ?`,
      [
        totals.incentives,
        totals.deductions,
        totals.incentives,
        totals.incentives,
        totals.deductions,
        periodStart,
        row.emp_id,
      ],
    );
  }
};

export const applySalaryAdjustment = async (req, res) => {
  const { emp_ids, type, amount, description, date } = req.body;

  if (!Array.isArray(emp_ids) || emp_ids.length === 0) {
    return res
      .status(400)
      .json({ message: "At least one employee is required" });
  }

  if (!type || amount === undefined || amount === null || !date) {
    return res
      .status(400)
      .json({ message: "type, amount, and date are required" });
  }

  const normalizedType = normalizeAdjustmentType(type);
  if (!normalizedType) {
    return res.status(400).json({ message: "Invalid adjustment type" });
  }

  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0" });
  }

  const period = String(date).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ message: "Invalid adjustment date" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Loop through each selected employee ID and save the record
    for (const emp_id of emp_ids) {
      await connection.query(
        `INSERT INTO salary_history (emp_id, effective_date, type, amount, description, remarks) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          emp_id,
          date,
          normalizedType,
          numericAmount,
          description || null,
          "Added via Payroll Bulk Adjustment",
        ],
      );
    }

    await recomputePayrollForEmployeesPeriod(connection, emp_ids, period);

    await connection.commit();
    res.json({ message: "Adjustments applied successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in applySalaryAdjustment:", error);
    res.status(500).json({ message: "Error applying adjustment" });
  } finally {
    connection.release();
  }
};

export const generatePayroll = async (req, res) => {
  const { period } = req.body;
  if (!period) return res.status(400).json({ message: "Period is required" });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get the exact start and end dates for the selected month
    const { periodStart } = parsePeriodRange(period);

    // Keep payroll generation idempotent by replacing the selected period snapshot.
    await connection.query("DELETE FROM payroll WHERE period_start = ?", [
      periodStart,
    ]);

    // 2. Get all active rank-and-file, HR, and supervisor employees (Ignore Admin)
    const [employees] = await connection.query(
      "SELECT emp_id, basic_pay FROM employees WHERE COALESCE(role, '') != 'Admin'",
    );

    // 3. Calculate and save the snapshot for each employee
    for (const emp of employees) {
      const basicPay = Number(emp.basic_pay || 0);

      const [adjustmentRows] = await connection.query(
        `SELECT
           COALESCE(
             SUM(CASE WHEN type IN ('Bonus', 'Increase') THEN ABS(amount) ELSE 0 END),
             0
           ) as total_incentives,
           COALESCE(
             SUM(CASE WHEN type = 'Decrease' THEN ABS(amount) ELSE 0 END),
             0
           ) as total_adjustment_deductions
         FROM salary_history
         WHERE emp_id = ?
           AND DATE_FORMAT(effective_date, '%Y-%m') = ?`,
        [emp.emp_id, period],
      );
      const incentives = Number(adjustmentRows[0]?.total_incentives || 0);
      const adjustmentDeductions = Number(
        adjustmentRows[0]?.total_adjustment_deductions || 0,
      );
      const totalDeductions = Number(adjustmentDeductions.toFixed(2));

      // Calculate Gross and Net Pay
      const grossPay = Number((basicPay + incentives).toFixed(2));
      const netPay = Number((grossPay - totalDeductions).toFixed(2));

      // 4. Save the official snapshot to the payroll table
      // EXACTLY matching your database columns from the screenshot
      await connection.query(
        `INSERT INTO payroll (emp_id, period_start, basic_pay, absences_count, absence_deductions, incentives, gross_pay, net_pay)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           basic_pay = VALUES(basic_pay),
           absences_count = VALUES(absences_count),
           absence_deductions = VALUES(absence_deductions),
           incentives = VALUES(incentives),
           gross_pay = VALUES(gross_pay),
           net_pay = VALUES(net_pay)`,
        [
          emp.emp_id,
          periodStart,
          basicPay,
          0,
          totalDeductions,
          incentives,
          grossPay,
          netPay,
        ],
      );
    }

    await connection.commit();
    res.json({ message: "Payroll generated successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in generatePayroll:", error);
    res.status(500).json({ message: "Error generating payroll" });
  } finally {
    connection.release();
  }
};
export const updateBaseSalaryByPosition = async (req, res) => {
  const { position, amount } = req.body;

  if (!position || amount === undefined || amount === null) {
    return res
      .status(400)
      .json({ message: "Position and amount are required" });
  }

  try {
    await ensurePositionSalarySettingsTable();

    await pool.query(
      `INSERT INTO position_salary_settings (position, amount)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [position, amount],
    );

    // 1. Fixed: Changed 'base_salary' to 'basic_pay' for the employees table
    await pool.query("UPDATE employees SET basic_pay = ? WHERE position = ?", [
      amount,
      position,
    ]);

    // 2. Update the payroll table as well
    await pool.query(
      `UPDATE payroll p
       JOIN employees e ON p.emp_id = e.emp_id
       SET p.basic_pay = ?
       WHERE e.position = ?`,
      [amount, position],
    );

    res.json({ message: "Base salary updated successfully" });
  } catch (error) {
    console.error("DB Error in updateBaseSalaryByPosition:", error);
    res.status(500).json({ message: "Error updating base salary" });
  }
};

// --- SALARY HISTORY ---
export const getSalaryHistory = async (req, res) => {
  const { emp_id } = req.params;
  const { period } = req.query;
  try {
    let rows;

    if (period && /^\d{4}-\d{2}$/.test(String(period))) {
      [rows] = await pool.query(
        `SELECT *
         FROM salary_history
         WHERE emp_id = ?
           AND DATE_FORMAT(effective_date, '%Y-%m') = ?
         ORDER BY effective_date DESC, id DESC`,
        [emp_id, period],
      );
    } else {
      [rows] = await pool.query(
        `SELECT *
         FROM salary_history
         WHERE emp_id = ?
         ORDER BY effective_date DESC, id DESC`,
        [emp_id],
      );
    }

    res.json(rows);
  } catch (error) {
    console.error("DB Error in getSalaryHistory:", error);
    res.status(500).json({ message: "Error fetching salary history" });
  }
};

export const updateSalaryHistoryEntry = async (req, res) => {
  const { id } = req.params;
  const { type, amount, description } = req.body;

  const normalizedType = normalizeAdjustmentType(type);
  if (!normalizedType) {
    return res.status(400).json({ message: "Invalid adjustment type" });
  }

  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT
         id,
         emp_id,
         DATE_FORMAT(effective_date, '%Y-%m') AS period_key
       FROM salary_history
       WHERE id = ?
       LIMIT 1`,
      [id],
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Adjustment record not found" });
    }

    const existing = existingRows[0];
    const period = existing.period_key;

    if (!period) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid adjustment period" });
    }

    await connection.query(
      `UPDATE salary_history
       SET type = ?, amount = ?, description = ?
       WHERE id = ?`,
      [normalizedType, numericAmount, description || null, id],
    );

    await recomputePayrollForEmployeesPeriod(
      connection,
      [existing.emp_id],
      period,
    );

    await connection.commit();
    res.json({ message: "Adjustment updated successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in updateSalaryHistoryEntry:", error);
    res.status(500).json({ message: "Error updating adjustment" });
  } finally {
    connection.release();
  }
};

export const deleteSalaryHistoryEntry = async (req, res) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT
         id,
         emp_id,
         DATE_FORMAT(effective_date, '%Y-%m') AS period_key
       FROM salary_history
       WHERE id = ?
       LIMIT 1`,
      [id],
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Adjustment record not found" });
    }

    const existing = existingRows[0];
    const period = existing.period_key;

    if (!period) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid adjustment period" });
    }

    await connection.query("DELETE FROM salary_history WHERE id = ?", [id]);

    await recomputePayrollForEmployeesPeriod(
      connection,
      [existing.emp_id],
      period,
    );

    await connection.commit();
    res.json({ message: "Adjustment removed successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in deleteSalaryHistoryEntry:", error);
    res.status(500).json({ message: "Error removing adjustment" });
  } finally {
    connection.release();
  }
};

// export const fileLeave = async (req, res) => {
//   const {
//     emp_id,
//     leave_type,
//     date_from,
//     date_to,
//     priority,
//     supervisor_remarks,
//   } = req.body;
//   const resolvedDateTo = date_to || date_from;
//   const trimmedReason = String(supervisor_remarks || "").trim();

//   const requesterEmpId =
//     req.user?.role === "Admin" && emp_id ? emp_id : req.user?.emp_id || emp_id;

//   if (!requesterEmpId || !leave_type || !date_from || !resolvedDateTo) {
//     return res.status(400).json({
//       message: "emp_id, leave_type, and date_from are required",
//     });
//   }

//   if (!trimmedReason) {
//     return res.status(400).json({
//       message: "Reason is required for leave applications",
//     });
//   }

//   const connection = await pool.getConnection();
//   try {
//     await connection.beginTransaction();

//     const requester = await getEmployeeProfile(connection, requesterEmpId);
//     if (!requester) {
//       await connection.rollback();
//       return res.status(404).json({ message: "Requester not found" });
//     }

//     const normalizedStatus = String(requester.status || "")
//       .trim()
//       .toLowerCase();
//     const normalizedLeaveType = String(leave_type || "")
//       .trim()
//       .toLowerCase();

//     if (
//       normalizedStatus === "job order" &&
//       normalizedLeaveType === "pgt leave"
//     ) {
//       await connection.rollback();
//       return res.status(400).json({
//         message: "Job Order employees cannot file PGT Leave",
//       });
//     }

//     const [result] = await connection.query(
//       `
//         INSERT INTO leave_requests (
//           emp_id,
//           leave_type,
//           date_from,
//           date_to,
//           priority,
//           status,
//           reason
//         ) VALUES (?, ?, ?, ?, ?, 'Pending', ?)
//       `,
//       [
//         requesterEmpId,
//         leave_type,
//         date_from,
//         resolvedDateTo,
//         priority,
//         trimmedReason,
//       ],
//     );

//     await notifyApproversForRequest(connection, {
//       requester,
//       moduleType: "Leave",
//       requestId: result.insertId,
//     });

//     await connection.commit();

//     res
//       .status(201)
//       .json({ message: "Leave application submitted successfully" });
//   } catch (error) {
//     await connection.rollback();
//     console.error("DB Error in fileLeave:", error);
//     res.status(500).json({ message: "Error submitting leave application" });
//   } finally {
//     connection.release();
//   }
// };

export const cancelMyLeave = async (req, res) => {
  const { id } = req.params;
  const requesterEmpId = req.user?.emp_id;

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, emp_id, status FROM leave_requests WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const request = rows[0];
    if (String(request.emp_id) !== String(requesterEmpId)) {
      return res
        .status(403)
        .json({ message: "You can only cancel your own leave request" });
    }

    const normalizedStatus = String(request.status || "")
      .trim()
      .toLowerCase();
    if (!["pending", "pending approval"].includes(normalizedStatus)) {
      return res
        .status(400)
        .json({ message: "Only pending leave requests can be cancelled" });
    }

    await pool.query("DELETE FROM leave_requests WHERE id = ?", [id]);
    res.json({ message: "Leave request cancelled successfully" });
  } catch (error) {
    console.error("DB Error in cancelMyLeave:", error);
    res.status(500).json({ message: "Error cancelling leave request" });
  }
};

export const requestMyLeaveCancellation = async (req, res) => {
  const { id } = req.params;
  const requesterEmpId = req.user?.emp_id;
  const cancellationReason = String(req.body?.cancellation_reason || "").trim();

  if (!requesterEmpId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!cancellationReason) {
    return res.status(400).json({
      message: "Cancellation reason is required",
    });
  }

  try {
    await ensureLeaveApprovalColumns();

    const [rows] = await pool.query(
      "SELECT id, emp_id, status, date_from, cancellation_requested_at FROM leave_requests WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const request = rows[0];
    if (String(request.emp_id) !== String(requesterEmpId)) {
      return res.status(403).json({
        message: "You can only request cancellation for your own leave request",
      });
    }

    if (
      !["Approved", "Partially Approved"].includes(String(request.status || ""))
    ) {
      return res.status(400).json({
        message: "Only approved leave requests can request cancellation",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(request.date_from);
    startDate.setHours(0, 0, 0, 0);
    if (startDate <= today) {
      return res.status(400).json({
        message: "Cancellation request is only allowed before the start date",
      });
    }

    if (request.cancellation_requested_at) {
      return res.status(400).json({
        message: "Cancellation request is already pending approval",
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        "UPDATE leave_requests SET cancellation_requested_at = NOW(), cancellation_reason = ? WHERE id = ?",
        [cancellationReason, id],
      );

      const requester = await getEmployeeProfile(connection, requesterEmpId);
      if (requester) {
        await notifyApproversForCancellationRequest(connection, {
          requester,
          moduleType: "Leave",
          requestId: Number(id),
          fromDate: request.date_from,
          toDate: request.date_to,
          descriptor: "leave request",
        });
      }

      await connection.commit();
    } catch (txError) {
      await connection.rollback();
      throw txError;
    } finally {
      connection.release();
    }

    res.json({ message: "Cancellation request submitted for approval" });
  } catch (error) {
    console.error("DB Error in requestMyLeaveCancellation:", error);
    res.status(500).json({ message: "Error requesting leave cancellation" });
  }
};

// --- REPORTS ---
// --- REPORTS ---
export const getPayrollReports = async (req, res) => {
  try {
    // 1. Get total active employees (excluding Admin)
    const [activeEmpRows] = await pool.query(
      "SELECT COUNT(*) as active_count FROM employees WHERE status != 'Inactive' AND COALESCE(role, '') != 'Admin'",
    );
    const activeEmployees = activeEmpRows[0].active_count || 0;

    // 2. Get Monthly Payroll Data
    const [payrollRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(MIN(period_start), '%Y-%m') as sort_month,
        DATE_FORMAT(MIN(period_start), '%M %Y') as display_month,
        SUM(incentives) as total_incentives, 
        SUM(gross_pay) as total_gross,
        SUM(absence_deductions) as total_deductions,
        SUM(net_pay) as total_net
      FROM payroll
      GROUP BY YEAR(period_start), MONTH(period_start)
    `);

    // 3. Get Monthly Attendance Data
    const [attendanceRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(MIN(date), '%Y-%m') as sort_month,
        DATE_FORMAT(MIN(date), '%M %Y') as display_month,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as leave_count
      FROM attendance
      GROUP BY YEAR(date), MONTH(date)
    `);

    // 4. Merge Payroll and Attendance Data together by Month
    const summaryMap = {};

    payrollRows.forEach((row) => {
      summaryMap[row.sort_month] = {
        month: row.display_month,
        sortMonth: row.sort_month,
        totalIncentives: Number(row.total_incentives || 0),
        totalGross: Number(row.total_gross || 0),
        totalDeductions: Number(row.total_deductions || 0),
        totalNet: Number(row.total_net || 0),
        present: 0,
        absent: 0,
        late: 0,
        onLeave: 0, // Default attendance
      };
    });

    attendanceRows.forEach((row) => {
      if (!summaryMap[row.sort_month]) {
        summaryMap[row.sort_month] = {
          month: row.display_month,
          sortMonth: row.sort_month,
          totalIncentives: 0,
          totalGross: 0,
          totalDeductions: 0,
          totalNet: 0,
          present: 0,
          absent: 0,
          late: 0,
          onLeave: 0,
        };
      }
      summaryMap[row.sort_month].present = Number(row.present_count);
      summaryMap[row.sort_month].absent = Number(row.absent_count);
      summaryMap[row.sort_month].late = Number(row.late_count);
      summaryMap[row.sort_month].onLeave = Number(row.leave_count);
    });

    // Convert to Array and Sort Newest to Oldest
    const monthlySummary = Object.values(summaryMap)
      .sort((a, b) => b.sortMonth.localeCompare(a.sortMonth))
      .slice(0, 12); // Keep last 12 months

    // Get latest data for Top Cards
    const latestMonth = monthlySummary[0] || {
      totalNet: 0,
      totalDeductions: 0,
      absent: 0,
      month: "No Data",
    };

    res.json({
      activeEmployees,
      latestMonthName: latestMonth.month,
      latestNet: latestMonth.totalNet,
      latestDeductions: latestMonth.totalDeductions,
      latestAbsences: latestMonth.absent,
      monthlySummary,
    });
  } catch (error) {
    console.error("DB Error in getPayrollReports:", error);
    res.status(500).json({ message: "Error fetching payroll reports" });
  }
};

// --- MY ATTENDANCE (For Employee Calendar) ---
export const getMyAttendance = async (req, res) => {
  try {
    const empId = req.user?.emp_id;

    if (!empId) {
      return res
        .status(400)
        .json({ message: "Employee ID missing from token" });
    }

    const [rows] = await pool.query(
      "SELECT date, status FROM attendance WHERE emp_id = ? ORDER BY date DESC",
      [empId],
    );

    res.json(rows);
  } catch (error) {
    console.error("DB Error in getMyAttendance:", error);
    res.status(500).json({ message: "Error fetching personal attendance" });
  }
};

// --- RESET PAYROLL ---
export const resetPayrollData = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete all payroll records
    await connection.query("DELETE FROM payroll");

    // Delete all salary history records (adjustments)
    await connection.query("DELETE FROM salary_history");

    await connection.commit();

    res.json({
      message: "All payroll data has been reset successfully",
      timestamp: new Date(),
    });
  } catch (error) {
    await connection.rollback();
    console.error("DB Error in resetPayrollData:", error);
    res
      .status(500)
      .json({ message: "Error resetting payroll data", error: error.message });
  } finally {
    connection.release();
  }
};

const ensureProfileColumn = async (connection) => {
  try {
    await connection.query(
      "ALTER TABLE employees ADD COLUMN profile_photo VARCHAR(255) NULL",
    );
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
};

// 1. Upload Profile Photo
export const uploadProfilePhoto = async (req, res) => {
  try {
    const viewer = await getEmployeeProfile(pool, req.user?.emp_id);
    const targetEmpId = String(req.params?.emp_id || req.user?.emp_id || "").trim();

    if (!viewer) {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!targetEmpId) {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const targetEmployee = await getEmployeeProfile(pool, targetEmpId);
    if (!targetEmployee) {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Employee not found" });
    }

    const canManageTarget =
      viewer.role === "Admin" ||
      viewer.role === "HR" ||
      viewer.emp_id === targetEmpId ||
      (viewer.role === "Supervisor" &&
        String(viewer.designation || "").trim().toLowerCase() ===
          String(targetEmployee.designation || "").trim().toLowerCase());

    if (!canManageTarget) {
      if (req.file?.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ message: "You cannot replace this file" });
    }

    // 1. Check if Multer actually saved a file
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Normalize path for Windows (\ vs /)
    const newPhotoPath = req.file.path.replace(/\\/g, "/");
    const empId = targetEmpId;

    // 2. Fetch the old photo path from the database BEFORE we overwrite it
    const [rows] = await pool.query(
      "SELECT profile_photo FROM employees WHERE emp_id = ?",
      [empId],
    );

    const oldPhotoPath = rows.length > 0 ? rows[0].profile_photo : null;

    // 3. The Janitor Logic: If an old photo exists, delete it from the hard drive!
    if (oldPhotoPath) {
      // Build the exact absolute path to the old file
      const fullOldPath = path.join(process.cwd(), oldPhotoPath);

      // Check if the file actually exists on the drive, then delete it
      if (fs.existsSync(fullOldPath)) {
        fs.unlinkSync(fullOldPath);
      }
    }

    // 4. Update the database with the new photo path
    await pool.query(
      "UPDATE employees SET profile_photo = ? WHERE emp_id = ?",
      [newPhotoPath, empId],
    );

    res.json({
      message: "Photo uploaded and old photo deleted!",
      filePath: newPhotoPath,
    });
  } catch (error) {
    console.error("Photo Upload Error:", error);
    res.status(500).json({ message: "Server error during photo upload" });
  }
};

export const replaceResignationFile = async (req, res) => {
  const requester = await getEmployeeProfile(pool, req.user?.emp_id);
  const resignationId = req.params?.id;
  const fileField = String(req.body?.file_field || "").trim();
  const newFileKey = String(req.body?.file_key || "").trim();
  const oldFileKey = String(req.body?.old_file_key || "").trim();

  if (!requester) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const allowedFields = {
    endorsement_file_key: "endorsement_file_key",
    clearance_file_key: "clearance_file_key",
  };

  const columnName = allowedFields[fileField];
  if (!columnName) {
    return res.status(400).json({ message: "Invalid file field" });
  }

  if (!newFileKey) {
    return res.status(400).json({ message: "file_key is required" });
  }

  try {
    await ensureResignationsTable();

    const [rows] = await pool.query(
      `SELECT r.id, r.emp_id, e.designation, COALESCE(e.role, 'RankAndFile') AS role
       FROM resignations r
       JOIN employees e ON e.emp_id = r.emp_id
       WHERE r.id = ?
       LIMIT 1`,
      [resignationId],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Resignation request not found" });
    }

    const target = rows[0];
    const targetRole = normalizeRole(target.role);
    const canManageTarget =
      requester.role === "Admin" ||
      requester.role === "HR" ||
      requester.emp_id === target.emp_id ||
      (requester.role === "Supervisor" &&
        String(requester.designation || "").trim().toLowerCase() ===
          String(target.designation || "").trim().toLowerCase() &&
        targetRole !== "Admin");

    if (!canManageTarget) {
      return res.status(403).json({ message: "You cannot replace this file" });
    }

    await pool.query(
      `UPDATE resignations SET ${columnName} = ? WHERE id = ?`,
      [newFileKey, resignationId],
    );

    if (oldFileKey && oldFileKey !== newFileKey) {
      try {
        await deleteS3ObjectQuietly(oldFileKey);
      } catch (deleteError) {
        console.error("S3 cleanup error in replaceResignationFile:", deleteError);
      }
    }

    return res.json({ message: "Resignation file replaced successfully" });
  } catch (error) {
    console.error("DB Error in replaceResignationFile:", error);
    return res.status(500).json({ message: "Error replacing resignation file" });
  }
};

// 2. Update Personal Profile Details
export const updateMyProfile = async (req, res) => {
  const { email } = req.body;
  try {
    await pool.query("UPDATE employees SET email = ? WHERE emp_id = ?", [
      email,
      req.user.emp_id,
    ]);
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile" });
  }
};

// 3. Change Password
export const changeMyPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const [rows] = await pool.query(
      "SELECT password FROM employees WHERE emp_id = ?",
      [req.user.emp_id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    // Verify old password
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect current password" });

    // Hash new password and save
    const hashedPassword = await hashPassword(newPassword);
    await pool.query("UPDATE employees SET password = ? WHERE emp_id = ?", [
      hashedPassword,
      req.user.emp_id,
    ]);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Error changing password" });
  }
};
