import express from "express";
import { getHRReports } from "../controllers/HrReportsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authenticateToken);
router.get("/", getHRReports);

export default router;
