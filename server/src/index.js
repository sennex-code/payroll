import "dotenv/config";
import express from "express";
import cors from "cors";
import "./config/db.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import path from "path";
import hrReportsRoutes from "./routes/hrReportRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.ts";

const app = express();
const PORT = process.env.BACKEND_PORT || 8000;

// Updated CORS configuration to allow React and your custom headers
app.use(
  cors({
    origin: "http://localhost:5173", // Allow your React frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "bypass-tunnel-reminder",
      "ngrok-skip-browser-warning",
    ],
  }),
);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/file", fileRoutes);
app.use("/api/hr-reports", hrReportsRoutes);
app.use("/api/leaves", leaveRoutes);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
