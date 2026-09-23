import express from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware";

import multer, { memoryStorage } from "multer";
import { fileLeave } from "../functions/leave/fileLeave";
import { getAllLeaves } from "../functions/leave/getAllLeaves";

const file = multer({
  storage: memoryStorage(),
});

const router = express.Router();

router.use(authenticateToken);
router.get(
  "/",
  authorizeRoles("Admin", "Supervisor", "HR", "RankAndFile"),
  getAllLeaves,
);
router.post(
  "/",
  authorizeRoles("Supervisor", "HR", "RankAndFile"),
  file.single("Ocp"),
  fileLeave,
);
export default router;
