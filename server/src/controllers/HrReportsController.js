import pool from "../config/db.js";

export const getHRReports = async (req, res) => {
  try {
    const { type, range } = req.query;
    let reportData = [];

    if (type === "leave") {
      const [rows] = await pool.query(`
        SELECT 
          l.id, 
          CONCAT(e.first_name, ' ', e.last_name) AS employee, 
          e.emp_id AS empId,
          e.profile_photo AS profilePhoto,
          l.leave_type AS leaveType, 
          COALESCE(l.approved_days, DATEDIFF(l.date_to, l.date_from) + 1) AS days, 
          l.status, 
          DATE_FORMAT(l.date_from, '%Y-%m-%d') AS dateFrom, 
          DATE_FORMAT(l.date_to, '%Y-%m-%d') AS dateTo
        FROM leave_requests l
        JOIN employees e ON l.emp_id = e.emp_id
        WHERE e.role != 'Admin' /* <-- HIDES ADMIN */
        ORDER BY l.date_from DESC
      `);
      reportData = rows;
    } else if (type === "attendance") {
      const [rows] = await pool.query(`
        SELECT 
          DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
          SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN a.status = 'On Leave' THEN 1 ELSE 0 END) AS onLeave,
          SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) AS late
        FROM attendance a
        JOIN employees e ON a.emp_id = e.emp_id
        WHERE e.role != 'Admin' /* <-- HIDES ADMIN */
        GROUP BY a.date
        ORDER BY a.date DESC
        LIMIT 30
      `);
      reportData = rows;
    } else if (type === "balance") {
      const [rows] = await pool.query(`
        SELECT 
          CONCAT(e.first_name, ' ', e.last_name) AS employee, 
          e.emp_id AS empId,
          e.profile_photo AS profilePhoto,
          b.leave_balance AS leaveBalance,
          b.offset_credits AS offsetCredits
        FROM leave_balances b
        JOIN employees e ON b.emp_id = e.emp_id
        WHERE e.role != 'Admin' /* <-- HIDES ADMIN */
      `);
      reportData = rows;
    }

    res.json(reportData);
  } catch (error) {
    console.error("HR Reports Error:", error);
    res.status(500).json({ message: "Server error fetching HR reports" });
  }
};
