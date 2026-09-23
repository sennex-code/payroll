import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck2,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Users,
  Wallet,
  Settings,
  User, // <-- ADDED THIS IMPORT
} from "lucide-react";

const navItems = {
  Admin: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/employees", icon: Users, label: "Employees" },
    { to: "/attendance", icon: CalendarCheck2, label: "Attendance" },
    { to: "/leave", icon: FileSpreadsheet, label: "Applications" },
    { to: "/payroll", icon: Wallet, label: "Payroll" },
    { to: "/payroll-reports", icon: BarChart3, label: "Reports" },
    { to: "/settings", icon: Settings, label: "Settings" }, // <-- ADDED
    { to: "/file-management", icon: FileSpreadsheet, label: "File Management" },
  ],
  Supervisor: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/employees", icon: Users, label: "Employees" },
    { to: "/attendance", icon: CalendarCheck2, label: "Attendance" },
    { to: "/leave", icon: FileSpreadsheet, label: "Applications" },
    { to: "/payslips", icon: ReceiptText, label: "Payslips" },
    { to: "/file-management", icon: FileSpreadsheet, label: "File Management" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ],
  HR: [
    { to: "/hr-dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/employees", icon: Users, label: "Employees" },
    { to: "/attendance", icon: CalendarCheck2, label: "Attendance" },
    { to: "/leave", icon: FileSpreadsheet, label: "Applications" },
    { to: "/payroll", icon: Wallet, label: "Payroll" },
    { to: "/reports", icon: BarChart3, label: "Reports" },
    { to: "/payslips", icon: ReceiptText, label: "Payslips" },
    { to: "/settings", icon: Settings, label: "Settings" }, // <-- ADDED
    { to: "/file-management", icon: FileSpreadsheet, label: "File Management" },
  ],
  RankAndFile: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/leave", icon: FileSpreadsheet, label: "Applications" },
    { to: "/file-management", icon: FileSpreadsheet, label: "File Management" },
    { to: "/my-reports", icon: BarChart3, label: "Reports" },
    { to: "/payslips", icon: ReceiptText, label: "My Payslips" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ],
};

export default function Sidebar({ role, onLogout, isCollapsed = false }) {
  const items = navItems[role] || navItems.RankAndFile;

  // --- ADDED THESE THREE VARIABLES ---
  const currentUser = JSON.parse(localStorage.getItem("wah_user") || "{}");
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const displayName =
    currentUser.name ||
    `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() ||
    "Employee";

  return (
    <aside
      className={`flex h-full flex-col overflow-x-hidden overflow-y-auto border-r border-white/15 bg-gradient-to-b from-[#3e0d75] via-[#4d128f] to-[#5a1ea2] text-white ${isCollapsed ? "md:w-[84px]" : "md:w-[248px]"}`}
    >
      <div
        className={`border-b border-white/15 ${isCollapsed ? "px-3 py-4" : "px-5 py-5"}`}
      >
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/25">
            <img
              src="/images/wah-logo.png"
              alt="WAH"
              className="h-7 w-7 object-contain"
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="m-0 truncate text-[11px] uppercase tracking-[0.2em] text-white/65">
                WAH Payroll
              </p>
              <p className="m-0 truncate text-sm font-semibold text-white">
                Workspace
              </p>
            </div>
          )}
        </div>
      </div>

      <nav
        className={`flex-1 space-y-1.5 ${isCollapsed ? "px-2 py-3" : "px-3 py-4"}`}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `group flex items-center rounded-xl text-[0.84rem] font-medium text-white/85 no-underline transition-all duration-150 hover:bg-white/12 hover:text-white ${isCollapsed ? "justify-center px-2.5 py-2.5" : "gap-3 px-3.5 py-2.5"} ${isActive ? "bg-white/18 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]" : ""}`
            }
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white/95 transition-colors group-hover:bg-white/15">
              <item.icon className="h-4 w-4" />
            </span>
            {!isCollapsed && (
              <span className="whitespace-nowrap">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* --- ADDED: USER PROFILE & LOGOUT SECTION --- */}
      <div
        className={`mt-auto border-t border-white/15 bg-black/10 ${isCollapsed ? "p-3" : "p-4"}`}
      >
        <div
          className={`mb-4 flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}
        >
          {/* Circular Avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 overflow-hidden ring-2 ring-white/10">
            {currentUser.profile_photo ? (
              <img
                src={`${API_BASE_URL}/${currentUser.profile_photo.replace(/^\/+/, "")}`}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-white/70" />
            )}
          </div>

          {/* Name & Role (Hidden when collapsed) */}
          {!isCollapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold text-white">
                {displayName}
              </span>
              <span className="truncate text-[10px] font-bold tracking-widest text-white/50 uppercase mt-0.5">
                {role}
              </span>
            </div>
          )}
        </div>

        {/* Existing Logout Button (Styled slightly to fit the new bottom block) */}
        <button
          title="Log out"
          className={`flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/10 text-[0.88rem] font-semibold text-white transition-colors duration-150 hover:bg-white/20 hover:border-white/40 ${isCollapsed ? "py-2.5" : "gap-2 py-2.5"}`}
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && "Log out"}
        </button>
      </div>
    </aside>
  );
}
