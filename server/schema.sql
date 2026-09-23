-- WAH Payroll Database Schema
-- Created: 2026-03-23

CREATE TABLE IF NOT EXISTS employees (
  emp_id VARCHAR(50) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_initial CHAR(1),
  designation VARCHAR(100),
  position VARCHAR(100),
  status VARCHAR(50),
  email VARCHAR(100) UNIQUE,
  profile_photo VARCHAR(255),
  philhealth_no VARCHAR(50),
  tin VARCHAR(50),
  sss_no VARCHAR(50),
  pag_ibig_mid_no VARCHAR(50),
  pag_ibig_rtn VARCHAR(50),
  gsis_no VARCHAR(50),
  dob DATE,
  hired_date DATE,
  password VARCHAR(255),
  basic_pay DECIMAL(12,2),
  role ENUM('Admin', 'Supervisor', 'HR', 'RankAndFile') DEFAULT 'RankAndFile',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  status ENUM('Present', 'Absent', 'Late', 'Undertime', 'Half-Day', 'On Leave', 'Field') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_emp_date (emp_id, date),
  INDEX idx_emp_date (emp_id, date),
  INDEX idx_status (status),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_balances (
  emp_id VARCHAR(50) PRIMARY KEY,
  leave_balance DECIMAL(5,2) DEFAULT 0,
  offset_credits DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  leave_type VARCHAR(100),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  priority VARCHAR(50),
  status ENUM('Pending', 'Approved', 'Denied', 'Partially Approved') DEFAULT 'Pending',
  approved_days DECIMAL(5,2),
  approved_dates JSON,
  cancellation_requested_at TIMESTAMP NULL,
  cancellation_reason TEXT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_emp_status (emp_id, status),
  INDEX idx_date_range (date_from, date_to),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resignations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  resignation_type VARCHAR(100) NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  resignation_letter TEXT,
  recipient_name VARCHAR(255),
  recipient_emp_id VARCHAR(50),
  resignation_date DATE,
  last_working_day DATE,
  leaving_reasons_json JSON,
  leaving_reason_other TEXT,
  exit_interview_answers_json JSON,
  endorsement_file_key VARCHAR(512),
  clearance_file_key VARCHAR(512),
  current_step TINYINT DEFAULT 1,
  status ENUM('Pending Approval', 'Approved', 'Rejected') DEFAULT 'Pending Approval',
  reviewed_by VARCHAR(50),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resignation_drafts (
  emp_id VARCHAR(50) PRIMARY KEY,
  payload_json JSON NOT NULL,
  current_step TINYINT DEFAULT 1,
  interview_part TINYINT DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stored_files (
  storage_key VARCHAR(120) PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL,
  content LONGBLOB NOT NULL,
  created_by VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stored_files_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_missing_docs (
  emp_id VARCHAR(50) PRIMARY KEY,
  missing_docs TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offset_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  working_days_completed INT COMMENT 'Actual working days in period',
  baseline_days INT DEFAULT 22 COMMENT '22-day baseline',
  offset_earned DECIMAL(5,2) DEFAULT 0 COMMENT 'Credits earned in period from extra days',
  offset_used DECIMAL(5,2) DEFAULT 0 COMMENT 'Offset days used to fill gaps',
  carried_over DECIMAL(5,2) DEFAULT 0 COMMENT 'Carried over from previous period',
  final_balance DECIMAL(5,2) DEFAULT 0 COMMENT 'Remaining after this period',
  status ENUM('Draft', 'Pending', 'Approved', 'Rejected') DEFAULT 'Draft',
  supervisor_emp_id VARCHAR(50),
  supervisor_remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  INDEX idx_emp_period (emp_id, period_year, period_month),
  INDEX idx_status (status),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE,
  FOREIGN KEY (supervisor_emp_id) REFERENCES employees(emp_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offset_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  days_applied DECIMAL(5,2) NOT NULL,
  reason TEXT COMMENT 'Reason for filing offset application',
  status ENUM('Pending', 'Approved', 'Denied', 'Partially Approved') DEFAULT 'Pending',
  approved_days DECIMAL(5,2) COMMENT 'Days approved if partially approved',
  supervisor_emp_id VARCHAR(50),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  basic_pay DECIMAL(12,2),
  absences_count INT DEFAULT 0,
  absence_deductions DECIMAL(12,2) DEFAULT 0,
  incentives DECIMAL(12,2) DEFAULT 0,
  gross_pay DECIMAL(12,2),
  net_pay DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_emp_period (emp_id, period_start),
  INDEX idx_emp_period (emp_id, period_start),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salary_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  effective_date DATE,
  type VARCHAR(100),
  amount DECIMAL(12,2),
  description TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_emp_date (emp_id, effective_date),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS position_salary_settings (
  position VARCHAR(100) PRIMARY KEY,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_position_salary_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
