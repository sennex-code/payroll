import express from "express";
import { getMe, login, logout } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import refresh from "../helper/refresh.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.post("/logout", logout);

router.post("/refresh", refresh);

export default router;
