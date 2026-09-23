import express from "express";
import db from "../config/db.js";

const router = express.Router();

router.get("/dashboard-summary", (req, res) => {
  const summary = {
    pendingLeaves: [],
    onLeave: [],
    absent: [],
    activities: [],
    leaveBalances: [],
  };

  res.json(summary);
});

export default router;
