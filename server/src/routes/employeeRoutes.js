import express from "express";
import {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  resetEmployeePassword,
  deleteEmployee,
  getAllLeaves,
  updateLeaveStatus,
  // fileLeave,
  getAllPayroll,
  generatePayroll,
  getAttendance,
  adjustLeaveBalance,
  getDashboardSummary,
  getSalaryHistory,
  updateSalaryHistoryEntry,
  deleteSalaryHistoryEntry,
  applySalaryAdjustment,
  updateBaseSalaryByPosition,
  getAttendanceCalendarSummary,
  getDailyAttendance,
  getAllResignations,
  saveBulkAttendance,
  getWorkweekConfigs,
  upsertWorkweekConfig,
  updateWorkweekConfigById,
  deleteWorkweekConfigById,
  getOffsetBalance,
  fileOffsetApplication,
  getOffsetApplications,
  updateOffsetApplicationStatus,
  getPayrollReports,
  getMyAttendance,
  updateMissingDocs,
  getMyResignations,
  getResignations,
  fileResignation,
  getResignationRecipient,
  getMyResignationDraft,
  saveMyResignationDraft,
  updateResignationStatus,
  cancelMyResignation,
  requestMyResignationCancellation,
  uploadResignationClearance,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  resetPayrollData,
  cancelMyOffsetApplication,
  cancelMyLeave,
  requestMyOffsetCancellation,
  requestMyLeaveCancellation,
  addHrNoteToPendingRequest,
  getFileManagementInventory,
  getFileTemplates,
  uploadFileTemplate,
  replaceFileTemplate,
  downloadFileTemplate,
  deleteFileTemplate,
  uploadProfilePhoto,
  replaceResignationFile,
  updateMyProfile,
  changeMyPassword,
} from "../controllers/employeeController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";
import {
  sendPayslip,
  sendBulkPayslips,
} from "../controllers/payrollController.js";
import multer from "multer"; // <-- THIS IS THE MISSING LINE
import path from "path"; // <-- Make sure you have this too
import fs from "fs";

const router = express.Router();

router.use(authenticateToken);

router.get(
  "/dashboard-summary",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getDashboardSummary,
);

router.post("/missing-docs", authorizeRoles("Admin", "HR"), updateMissingDocs);

router.get(
  "/my-attendance",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getMyAttendance,
);
router.get(
  "/attendance",
  authorizeRoles("Admin", "Supervisor", "HR"),
  getAttendance,
);

router.get("/all-resignations", getAllResignations);
router.get(
  "/my-resignations",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getMyResignations,
);
router.get(
  "/resignations",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getResignations,
);
router.post(
  "/resignations",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  fileResignation,
);
router.get(
  "/resignations/recipient",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getResignationRecipient,
);
router.get(
  "/resignations/draft",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getMyResignationDraft,
);
router.put(
  "/resignations/draft",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  saveMyResignationDraft,
);
router.put(
  "/resignations/:id",
  authorizeRoles("Admin", "Supervisor"),
  updateResignationStatus,
);

router.get(
  "/notifications",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getMyNotifications,
);
router.put(
  "/notifications/:id/read",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  markNotificationRead,
);
router.put(
  "/notifications/read-all",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  markAllNotificationsRead,
);
router.delete(
  "/notifications/:id",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  deleteNotification,
);
router.delete(
  "/notifications",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  deleteAllNotifications,
);
router.put("/leave-balance/:id", authorizeRoles("HR"), adjustLeaveBalance);

router.get(
  "/attendance-summary",
  authorizeRoles("Admin", "Supervisor", "HR"),
  getAttendanceCalendarSummary,
);
router.get(
  "/attendance-daily",
  authorizeRoles("Admin", "Supervisor", "HR"),
  getDailyAttendance,
);
router.post(
  "/attendance-bulk",
  authorizeRoles("Admin", "HR"),
  saveBulkAttendance,
);

router.get(
  "/workweek-config",
  authorizeRoles("Admin", "Supervisor", "HR"),
  getWorkweekConfigs,
);
router.post("/workweek-config", authorizeRoles("Admin"), upsertWorkweekConfig);
router.put(
  "/workweek-config/:id",
  authorizeRoles("Admin"),
  updateWorkweekConfigById,
);
router.delete(
  "/workweek-config/:id",
  authorizeRoles("Admin"),
  deleteWorkweekConfigById,
);

router.put(
  "/resignations/:id",
  authorizeRoles("Admin", "Supervisor", "HR"),
  updateResignationStatus,
);
router.delete(
  "/resignations/:id/cancel",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  cancelMyResignation,
);
router.post(
  "/resignations/:id/request-cancel",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  requestMyResignationCancellation,
);
router.post(
  "/resignations/:id/clearance",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  uploadResignationClearance,
);
router.put(
  "/resignations/:id/file",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  replaceResignationFile,
);

router.get(
  "/offset-balance/:emp_id",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getOffsetBalance,
);
router.post(
  "/offset-applications",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  fileOffsetApplication,
);
router.get(
  "/offset-applications",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getOffsetApplications,
);
router.put(
  "/offset-applications/:id",
  authorizeRoles("Supervisor", "HR"),
  updateOffsetApplicationStatus,
);
router.delete(
  "/offset-applications/:id/cancel",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  cancelMyOffsetApplication,
);
router.post(
  "/offset-applications/:id/request-cancel",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  requestMyOffsetCancellation,
);

// router.get(
//   "/leaves",
//   authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
//   getAllLeaves,
// );
// router.post(
//   "/leaves",
//   authorizeRoles("Supervisor", "HR", "RankAndFile"),
//   fileLeave,
// );
router.put(
  "/leaves/:id",
  authorizeRoles("Supervisor", "HR"),
  updateLeaveStatus,
);
router.delete(
  "/leaves/:id/cancel",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  cancelMyLeave,
);
router.post(
  "/leaves/:id/request-cancel",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  requestMyLeaveCancellation,
);

router.post(
  "/pending-requests/:module/:id/hr-note",
  authorizeRoles("HR"),
  addHrNoteToPendingRequest,
);

router.get(
  "/payroll",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getAllPayroll,
);
router.post("/generate-payroll", authorizeRoles("Admin"), generatePayroll);
router.post(
  "/salary-adjustment",
  authorizeRoles("Admin"),
  applySalaryAdjustment,
);
router.put(
  "/update-base-salary",
  authorizeRoles("Admin"),
  updateBaseSalaryByPosition,
);

router.post("/reset-payroll", authorizeRoles("Admin"), resetPayrollData);

router.get(
  "/salary-history/:emp_id",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getSalaryHistory,
);
router.put(
  "/salary-history/:id",
  authorizeRoles("Admin"),
  updateSalaryHistoryEntry,
);
router.delete(
  "/salary-history/:id",
  authorizeRoles("Admin"),
  deleteSalaryHistoryEntry,
);

router.get(
  "/payroll-reports",
  authorizeRoles("Admin", "Supervisor", "HR"),
  getPayrollReports,
);

router.get(
  "/file-management",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getFileManagementInventory,
);

router.get("/", authorizeRoles("Admin", "Supervisor", "HR"), getAllEmployees);
router.post("/add", authorizeRoles("Admin", "HR"), createEmployee);
router.put("/:id", authorizeRoles("Admin", "HR"), updateEmployee);
router.put(
  "/:id/reset-password",
  authorizeRoles("Admin"),
  resetEmployeePassword,
);
router.delete("/:id", authorizeRoles("Admin"), deleteEmployee);

// Setup Profile Photo Multer
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/profiles";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const targetEmpId = req.params?.emp_id || req.user?.emp_id;
    cb(
      null,
      `avatar-${targetEmpId}-${Date.now()}${path.extname(file.originalname)}`,
    );
  },
});
const uploadPhoto = multer({ storage: photoStorage });
const uploadTemplate = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 15 },
});

router.get(
  "/file-templates",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getFileTemplates,
);
router.get(
  "/file-templates/:id/download",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  downloadFileTemplate,
);
router.post(
  "/file-templates",
  authorizeRoles("Admin", "HR"),
  uploadTemplate.single("template_file"),
  uploadFileTemplate,
);
router.put(
  "/file-templates/:id",
  authorizeRoles("Admin", "HR"),
  uploadTemplate.single("template_file"),
  replaceFileTemplate,
);
router.delete(
  "/file-templates/:id",
  authorizeRoles("Admin", "HR"),
  deleteFileTemplate,
);

// ADD THESE ROUTES (Put them under your router.use(authenticateToken) line)
router.post(
  "/me/photo",
  uploadPhoto.single("profile_photo"),
  uploadProfilePhoto,
);
router.post(
  "/employees/:emp_id/photo",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  uploadPhoto.single("profile_photo"),
  uploadProfilePhoto,
);
router.put("/me/profile", updateMyProfile);
router.put("/me/change-password", changeMyPassword);

// TODO : PAYROLL
// payrollRoutes.js
router.post("/payroll/:emp_id/send-payslip", sendPayslip);
router.post("/payroll/send-bulk-payslips", sendBulkPayslips);
export default router;
