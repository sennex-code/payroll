import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MainLayout from "./components/MainLayout";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Payroll from "./pages/Payroll";
import Settings from "./pages/Settings";
import FileManagement from "./pages/FileManagement1";

// HR & Reports Pages
import HRDashboard from "./pages/HRDashboard";
import SalaryHistory from "./pages/SalaryHistory";
import HRReports from "./pages/HRReports";
import Payslips from "./pages/Payslips";
import Reports from "./pages/Reports";
import MyReports from "./pages/MyReports";
import axiosInterceptor from "./hooks/interceptor";
import Login from "./pages/Login";

const STORAGE_TOKEN_KEY = "wah_token";
const STORAGE_USER_KEY = "wah_user";

const safeParseUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || "null");
  } catch {
    return null;
  }
};

function RoleProtectedRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/" replace />;

  if (!allowedRoles.includes(user.role)) {
    const defaultPath = user.role === "HR" ? "/hr-dashboard" : "/dashboard";
    return <Navigate to={defaultPath} replace />;
  }

  return children;
}

function AppRoutes({ user }) {
  const role = user?.role;

  const defaultPathByRole = {
    Admin: "/dashboard",
    Supervisor: "/dashboard",
    HR: "/hr-dashboard",
    RankAndFile: "/dashboard",
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout role={role} />}>
          {/* --- DASHBOARDS --- */}
          <Route
            path="/dashboard"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Admin", "Supervisor", "RankAndFile"]}
              >
                <Dashboard />
              </RoleProtectedRoute>
            }
          />

          {/* ADDED: Missing HR Dashboard Route */}
          <Route
            path="/hr-dashboard"
            element={
              <RoleProtectedRoute user={user} allowedRoles={["HR"]}>
                <HRDashboard />
              </RoleProtectedRoute>
            }
          />

          {/* --- HR & ADMIN CORE PAGES --- */}
          <Route
            path="/employees"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Admin", "Supervisor", "HR"]}
              >
                <Employees />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Admin", "Supervisor", "HR"]}
              >
                <Attendance />
              </RoleProtectedRoute>
            }
          />

          {/* PROTECTED: Everyone needs access to Leave to file apps */}
          <Route
            path="/leave"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Admin", "Supervisor", "HR", "RankAndFile"]}
              >
                <Leave />
              </RoleProtectedRoute>
            }
          />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/file-management"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Admin", "Supervisor", "HR", "RankAndFile"]}
              >
                <FileManagement />
              </RoleProtectedRoute>
            }
          />

          {/* PROTECTED: Payroll is only for Admin and Supervisor */}
          <Route
            path="/payroll"
            element={
              <RoleProtectedRoute user={user} allowedRoles={["Admin", "HR"]}>
                <Payroll />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/salary-history"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Admin", "Supervisor"]}
              >
                <SalaryHistory />
              </RoleProtectedRoute>
            }
          />

          {/* --- REPORTS --- */}
          <Route
            path="/reports"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Admin", "Supervisor", "HR"]}
              >
                <HRReports />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/payroll-reports"
            element={
              <RoleProtectedRoute user={user} allowedRoles={["Admin"]}>
                <Reports />
              </RoleProtectedRoute>
            }
          />

          {/* --- EMPLOYEE SELF-SERVICE --- */}
          <Route
            path="/payslips"
            element={
              <RoleProtectedRoute
                user={user}
                allowedRoles={["Supervisor", "HR", "RankAndFile"]}
              >
                <Payslips />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/my-reports"
            element={
              <RoleProtectedRoute user={user} allowedRoles={["RankAndFile"]}>
                <MyReports />
              </RoleProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route
            path="*"
            element={
              <Navigate to={defaultPathByRole[role] || "/dashboard"} replace />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const queryClient = new QueryClient();

export default function App() {
  const [user, setUser] = useState(() => safeParseUser());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const hasToken = useMemo(
    () => Boolean(localStorage.getItem(STORAGE_TOKEN_KEY)),
    [user],
  );
  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem(STORAGE_TOKEN_KEY);
      if (!token) {
        setIsBootstrapping(false);
        return;
      }
      try {
        const res = await axiosInterceptor.get("/api/auth/me");

        const data = res.data;
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
      } catch {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        setUser(null);
      } finally {
        setIsBootstrapping(false);
      }
    };
    bootstrapAuth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {!hasToken || !user ? <Login></Login> : <AppRoutes user={user} />}
    </QueryClientProvider>
  );
}
