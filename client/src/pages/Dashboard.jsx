import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarPlus2,
  Clock3,
  FileClock,
  FolderClock,
  HandCoins,
  UserMinus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "../lib/api";
import Employees from "./Employees";
import Attendance from "./Attendance";
import Payroll from "./Payroll";

function parseDateOnly(value) {
  if (value instanceof Date)
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(raw);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getDateDiffInclusive(start, end) {
  const from = parseDateOnly(start).getTime();
  const to = parseDateOnly(end).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

function getDateRangeInclusive(start, end) {
  const dates = [];
  const current = parseDateOnly(start);
  const to = parseDateOnly(end);

  while (current <= to) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

const fmtCompactCurrency = (value) => {
  const number = Number(value || 0);
  return `₱${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const DashboardLegend = () => (
  <Legend
    iconType="circle"
    iconSize={8}
    wrapperStyle={{
      fontSize: "11px",
      fontWeight: 600,
      color: "#475569",
      paddingTop: "8px",
    }}
  />
);

const AttendanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Day {label}
      </p>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <p
            key={entry.dataKey}
            className="m-0 flex items-center justify-between gap-3 text-xs font-semibold"
            style={{ color: entry.color }}
          >
            <span>{entry.name}</span>
            <span>{Number(entry.value || 0)}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

const PayrollTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <p
            key={entry.dataKey}
            className="m-0 flex items-center justify-between gap-3 text-xs font-semibold"
            style={{ color: entry.color }}
          >
            <span>{entry.name}</span>
            <span>{fmtCompactCurrency(entry.value)}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 1. RANK & FILE (EMPLOYEE) DASHBOARD
// ==========================================
function EmployeeDashboard({ currentUser }) {
  const navigate = useNavigate();

  // Fetch Dashboard Summary (For Balances & Missing Docs)
  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/dashboard-summary");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  // Fetch Personal Attendance
  const { data: myAttendance = [], isLoading: attLoading } = useQuery({
    queryKey: ["my-attendance", currentUser?.emp_id],
    queryFn: async () => {
      const res = await apiFetch(`/api/employees/my-attendance`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Personal Leaves
  const { data: myLeaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/leaves");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Personal Offsets
  const { data: myOffsets = [] } = useQuery({
    queryKey: ["offset-applications"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/offset-applications");
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (dashLoading || attLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 font-semibold text-slate-700 shadow-sm">
        Loading My Dashboard...
      </div>
    );
  }

  // Find user's specific data from the summary
  const myBalanceRecord = dashboardData?.balances?.find(
    (b) => String(b.emp_id) === String(currentUser.emp_id),
  );
  const myMissingDocsRecord = dashboardData?.missingDocs?.find(
    (d) => String(d.emp_id) === String(currentUser.emp_id),
  );
  const personalSummary = dashboardData?.personalSummary || {};
  const displayedLeaveBalance =
    personalSummary.leaveBalance !== undefined
      ? Number(personalSummary.leaveBalance || 0)
      : Number(myBalanceRecord?.leave_balance || 0);

  // Compile Pending Requests
  // Compile Pending Requests (FIXED: Added fallbacks so it never says "Invalid Date")
  const pendingRequests = [
    ...myLeaves
      .filter((l) => l.status === "Pending")
      .map((l) => ({
        id: `l-${l.id}`,
        type: "Leave",
        title: l.leave_type,
        date: l.created_at || l.date_from || new Date().toISOString(), // Fallback to date_from
      })),
    ...myOffsets
      .filter((o) => o.status === "Pending")
      .map((o) => ({
        id: `o-${o.id}`,
        type: "Offset",
        title: `${Number(o.days_applied)} Days Applied`,
        date: o.created_at || o.date_from || new Date().toISOString(), // Fallback to date_from
      })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const badgeClass = {
    Present: "bg-emerald-100 text-emerald-800",
    Late: "bg-amber-100 text-amber-800",
    Undertime: "bg-rose-100 text-rose-800",
    "Half-Day": "bg-orange-100 text-orange-800",
    Absent: "bg-red-100 text-red-800",
    "On Leave": "bg-violet-100 text-violet-800",
    Pending: "bg-slate-100 text-slate-700",
  };

  const employeeStatus =
    dashboardData?.personalSummary?.employeeStatus ||
    currentUser?.status ||
    "N/A";

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="m-0 text-[1.6rem] font-bold text-slate-900">
          Welcome back,{" "}
          {currentUser?.first_name || currentUser?.name || "Employee"}!
        </h1>
        <p className="m-0 mt-1 text-sm text-slate-500">
          Here is what is happening with your account today.
        </p>
        <p className="m-0 mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Employment Status: {employeeStatus}
        </p>
      </div>
      {/* ALERT: Missing Documents */}
      {myMissingDocsRecord && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <span className="mt-0.5 rounded-md bg-white p-1 text-red-600">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="m-0 mb-1 text-sm font-bold text-red-800">
              Action Required: Missing Documents
            </h3>
            <p className="m-0 text-xs leading-5 text-red-700">
              HR has flagged your profile for missing requirements:{" "}
              <span className="font-bold">
                {myMissingDocsRecord.missing_docs}
              </span>
              . Please submit these as soon as possible.
            </p>
          </div>
        </div>
      )}
      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="flex flex-col justify-between rounded-xl border border-emerald-200/70 bg-white p-5 shadow-sm">
          <p className="m-0 mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Leave Balance
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="m-0 text-4xl font-black text-slate-900">
              {displayedLeaveBalance}
            </h2>
            <span className="text-sm font-medium text-slate-500">
              Days Remaining
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-violet-200/80 bg-white p-5 shadow-sm">
          <p className="m-0 mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Offset Credits
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="m-0 text-4xl font-black text-slate-900">
              {myBalanceRecord?.offset_credits || 0}
            </h2>
            <span className="text-sm font-medium text-slate-500">
              Earned Credits
            </span>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate("/leave")}
            className="group flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <span className="rounded-md bg-violet-100 p-1.5 text-violet-700">
              <CalendarPlus2 className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-slate-800">
              File a Leave Request
            </span>
            <ArrowRight className="ml-auto h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => navigate("/leave")}
            className="group flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <span className="rounded-md bg-indigo-100 p-1.5 text-indigo-700">
              <Clock3 className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-slate-800">
              File an Offset
            </span>
            <ArrowRight className="ml-auto h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT ATTENDANCE */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h3 className="m-0 text-sm font-bold text-slate-900">
              Recent Attendance (Last 5 Days)
            </h3>
          </div>
          <div className="flex-1 p-5">
            {myAttendance.length === 0 ? (
              <p className="py-4 text-center text-sm italic text-slate-500">
                No recent attendance records found.
              </p>
            ) : (
              <div className="space-y-3">
                {myAttendance.slice(0, 5).map((log, idx) => {
                  // Fallback for compound statuses like "Present, Late"
                  const primaryStatus =
                    log.status?.split(",")[0]?.trim() || "Pending";
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="m-0 text-sm font-semibold text-slate-800">
                          {new Date(log.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass[primaryStatus] || badgeClass["Pending"]}`}
                      >
                        {log.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => navigate("/attendance")}
              className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
            >
              View Full Calendar
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* PENDING REQUESTS TRACKER */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h3 className="m-0 text-sm font-bold text-slate-900">
              My Pending Requests
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {pendingRequests.length} Pending
            </span>
          </div>
          <div className="flex-1 p-5 overflow-y-auto max-h-[300px]">
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <FolderClock className="h-5 w-5" />
                </span>
                <p className="m-0 text-sm font-semibold text-slate-700">
                  You are all caught up!
                </p>
                <p className="m-0 mt-1 text-xs text-slate-500">
                  No pending requests waiting for approval.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <div className="mt-0.5 rounded-md bg-white p-1.5 text-violet-700 ring-1 ring-slate-200">
                      {req.type === "Leave" ? (
                        <CalendarPlus2 className="h-3.5 w-3.5" />
                      ) : (
                        <Clock3 className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-sm font-bold text-slate-900">
                        {req.type} Request
                      </p>
                      <p className="m-0 text-xs text-slate-600">{req.title}</p>
                      <p className="m-0 mt-1 text-[10px] text-slate-400">
                        Filed on {new Date(req.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. ADMIN / HR / SUPERVISOR DASHBOARD
// ==========================================
function AdminDashboard({ currentUser }) {
  const [activeModal, setActiveModal] = useState(null);
  const [approvedLeaves, setApprovedLeaves] = useState(new Set());
  const [reviewConfirm, setReviewConfirm] = useState(null);
  const [quickActionHost, setQuickActionHost] = useState(null);
  const [quickActionSeed, setQuickActionSeed] = useState(0);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const [year, month] = period.split("-").map(Number);

  const fetchDashboardData = async () => {
    const res = await apiFetch("/api/employees/dashboard-summary", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return await res.json();
  };

  const dashboardQuery = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: fetchDashboardData,
  });

  const employeesQuery = useQuery({
    queryKey: ["dashboard-employees"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const payrollQuery = useQuery({
    queryKey: ["dashboard-payroll", period],
    queryFn: async () => {
      const res = await apiFetch(`/api/employees/payroll?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch payroll snapshot");
      return res.json();
    },
  });

  const attendanceSummaryQuery = useQuery({
    queryKey: ["dashboard-attendance-summary", year, month],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/employees/attendance-summary?year=${year}&month=${month}`,
      );
      if (!res.ok) throw new Error("Failed to fetch attendance summary");
      return res.json();
    },
  });

  const employeesData = employeesQuery.data || [];
  const payrollData = payrollQuery.data || [];
  const attendanceSummary = attendanceSummaryQuery.data || [];

  const activeEmployeeCount = employeesData.filter(
    (e) =>
      String(e.status || "").toLowerCase() !== "inactive" &&
      String(e.role || "").toLowerCase() !== "admin",
  ).length;

  const pendingLeaveCount = dashboardQuery.data?.pendingLeaves?.length || 0;
  const onLeaveCount = dashboardQuery.data?.onLeave?.length || 0;
  const absentsCount = dashboardQuery.data?.absents?.length || 0;
  const pendingResignationCount =
    dashboardQuery.data?.resignations?.length || 0;

  const payrollTotals = payrollData.reduce(
    (acc, row) => {
      acc.gross += Number(row.gross_pay || 0);
      acc.net += Number(row.net_pay || 0);
      acc.deductions += Number(row.absence_deductions || 0);
      return acc;
    },
    { gross: 0, net: 0, deductions: 0 },
  );

  const attendanceTotals = attendanceSummary.reduce(
    (acc, item) => {
      acc.present += Number(item.present_count || 0);
      acc.absent += Number(item.absent_count || 0);
      acc.late += Number(item.late_count || 0);
      return acc;
    },
    { present: 0, absent: 0, late: 0 },
  );

  const attendanceChartData = attendanceSummary
    .map((item) => ({
      day: String(item.formatted_date || item.date || "").slice(8, 10),
      Present: Number(item.present_count || 0),
      Absent: Number(item.absent_count || 0),
      Late: Number(item.late_count || 0),
    }))
    .sort((a, b) => Number(a.day) - Number(b.day));

  const payrollChartData = [...payrollData]
    .sort((a, b) => Number(b.net_pay || 0) - Number(a.net_pay || 0))
    .slice(0, 8)
    .map((row) => ({
      employee: `${row.emp_id}`,
      Net: Number(row.net_pay || 0),
      Gross: Number(row.gross_pay || 0),
    }));

  const quickActions = [
    {
      label: "Add Employee",
      sub: "Open Add Employee modal",
      action: "add-employee",
      icon: <Users className="h-4 w-4" />,
      color: "bg-blue-50 border-blue-200 text-blue-800",
    },
    {
      label: "Take Attendance",
      sub: "Open attendance modal",
      action: "take-attendance",
      icon: <Clock3 className="h-4 w-4" />,
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
    },
    {
      label: "Salary Settings",
      sub: "Open Position Salary Settings",
      action: "salary-settings",
      icon: <HandCoins className="h-4 w-4" />,
      color: "bg-purple-50 border-purple-200 text-purple-800",
    },
  ];

  const cards = [
    {
      label: "Active Employees",
      value: activeEmployeeCount,
      borderColor: "#0f766e",
      icon: <Users className="h-4 w-4" />,
      clickable: false,
    },
    {
      label: "Pending Approvals",
      value: pendingLeaveCount + pendingResignationCount,
      borderColor: "#7c3aed",
      icon: <FileClock className="h-4 w-4" />,
      clickable: true,
      modalKey: "pending",
    },
    {
      label: "On Leave",
      value: onLeaveCount,
      borderColor: "#d4a017",
      icon: <Briefcase className="h-4 w-4" />,
      clickable: true,
      modalKey: "leave",
    },
    {
      label: "Absent",
      value: absentsCount,
      borderColor: "#c0392b",
      icon: <UserMinus className="h-4 w-4" />,
      clickable: true,
      modalKey: "absent",
    },
  ];

  const priorityClass = {
    High: "bg-red-100 text-red-800",
    Medium: "bg-yellow-100 text-yellow-800",
    Low: "bg-blue-100 text-blue-800",
  };

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };

  const handleUpdateLeaveStatus = async (id, payload) => {
    try {
      const res = await apiFetch(`/api/employees/leaves/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setApprovedLeaves(new Set([...approvedLeaves, id]));
        // Note: For a true refresh, use queryClient.invalidateQueries(["dashboardSummary"])
        // if you import useQueryClient. Otherwise, this visual state handles it.
      } else {
        alert("Failed to update leave request");
      }
    } catch (error) {
      console.error("Error updating leave:", error);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setApprovedLeaves(new Set());
  };

  const openQuickAction = (action) => {
    setQuickActionSeed((prev) => prev + 1);

    if (action.action === "add-employee") {
      setQuickActionHost("employees");
      return;
    }

    if (action.action === "take-attendance") {
      setQuickActionHost("attendance");
      return;
    }

    if (action.action === "salary-settings") {
      setQuickActionHost("payroll");
    }
  };

  const openLeaveDecisionConfirm = (employee, status) => {
    const totalDays = getDateDiffInclusive(
      employee.date_from,
      employee.date_to,
    );
    const requestedDates = getDateRangeInclusive(
      employee.date_from,
      employee.date_to,
    );

    setReviewConfirm({
      employee,
      status,
      totalDays,
      isMultiDay: totalDays > 1,
      selectedDates: status === "Approved" ? requestedDates : [],
      remarks: "",
    });
  };

  const toggleApprovedDate = (date) => {
    if (!reviewConfirm) return;
    const selected = new Set(reviewConfirm.selectedDates || []);
    if (selected.has(date)) {
      selected.delete(date);
    } else {
      selected.add(date);
    }

    setReviewConfirm({
      ...reviewConfirm,
      selectedDates: Array.from(selected).sort(),
    });
  };

  const submitLeaveDecision = async () => {
    if (!reviewConfirm) return;

    const trimmedRemarks = String(reviewConfirm.remarks || "").trim();
    const isDenyDecision = reviewConfirm.status === "Denied";

    if (isDenyDecision && !trimmedRemarks) {
      alert("Reason is required for denial.");
      return;
    }

    if (reviewConfirm.status === "Denied") {
      await handleUpdateLeaveStatus(reviewConfirm.employee.id, {
        status: "Denied",
        supervisor_remarks: trimmedRemarks,
      });
      setReviewConfirm(null);
      return;
    }

    const requestedDates = getDateRangeInclusive(
      reviewConfirm.employee.date_from,
      reviewConfirm.employee.date_to,
    );
    const selectedDates = reviewConfirm.selectedDates || [];

    if (selectedDates.length === 0) {
      alert("Select at least one day to approve.");
      return;
    }

    const isPartial =
      reviewConfirm.isMultiDay && selectedDates.length < requestedDates.length;

    await handleUpdateLeaveStatus(reviewConfirm.employee.id, {
      status: isPartial ? "Partially Approved" : "Approved",
      approved_days: selectedDates.length,
      approved_dates: selectedDates,
      supervisor_remarks: undefined,
    });
    setReviewConfirm(null);
  };

  if (
    dashboardQuery.isLoading ||
    employeesQuery.isLoading ||
    payrollQuery.isLoading ||
    attendanceSummaryQuery.isLoading
  )
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 font-semibold text-slate-700 shadow-sm">
        Loading Dashboard...
      </div>
    );

  return (
    <div className="max-w-full space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="m-0 text-[1.3rem] font-bold text-slate-900">
              Admin Command Center
            </h1>
            <p className="m-0 mt-0.5 text-xs text-slate-500">
              Central overview for people, attendance, leave, payroll, and
              approvals.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 transition-all duration-200 hover:border-violet-300 hover:bg-violet-50">
            Payroll Period
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
            />
          </label>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => c.clickable && setActiveModal(c.modalKey)}
            disabled={!c.clickable}
            className={`group relative rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 ${
              c.clickable
                ? "cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
                : "cursor-default"
            }`}
            style={{ boxShadow: `inset 0 3px 0 0 ${c.borderColor}` }}
          >
            <div className="p-3.5 text-left">
              <p className="m-0 mb-1 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span style={{ color: c.borderColor }}>{c.icon}</span>
                {c.label}
              </p>
              <p className="m-0 mb-1 text-[11px] font-medium text-slate-600">
                {c.label === "Pending Approvals"
                  ? `${pendingLeaveCount} leaves + ${pendingResignationCount} resignations`
                  : c.label === "Absent"
                    ? `${attendanceTotals.absent} attendance absences in ${period}`
                    : c.label === "On Leave"
                      ? `${onLeaveCount} currently on leave`
                      : "Total active profiles"}
              </p>
              <p
                className="m-0 text-2xl font-black"
                style={{ color: c.borderColor }}
              >
                {c.value}
              </p>
              {c.clickable && (
                <p className="m-0 mt-1 text-[10px] text-slate-400 transition-colors group-hover:text-slate-500">
                  Click to view
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Total Gross Payroll
          </p>
          <p className="m-0 mt-1 text-xl font-black text-emerald-800">
            ₱
            {payrollTotals.gross.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-sky-700">
            Total Net Payroll
          </p>
          <p className="m-0 mt-1 text-xl font-black text-sky-800">
            ₱
            {payrollTotals.net.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-sm transition-all duration-200 hover:shadow-md">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-rose-700">
            Total Deductions
          </p>
          <p className="m-0 mt-1 text-xl font-black text-rose-800">
            ₱
            {payrollTotals.deductions.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-bold text-slate-900">
            Quick Actions
          </h2>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Core Modules
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {quickActions.map((action) => (
            <button
              key={action.action}
              onClick={() => openQuickAction(action)}
              className={`group rounded-lg border p-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${action.color}`}
            >
              <span className="inline-flex items-center gap-2 text-xs font-bold">
                {action.icon}
                {action.label}
              </span>
              <p className="m-0 mt-1 text-[11px] text-slate-600">
                {action.sub}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                Open
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {quickActionHost === "employees" && (
        <Employees key={`qa-employees-${quickActionSeed}`} shortcutMode />
      )}
      {quickActionHost === "attendance" && (
        <Attendance key={`qa-attendance-${quickActionSeed}`} shortcutMode />
      )}
      {quickActionHost === "payroll" && (
        <Payroll key={`qa-payroll-${quickActionSeed}`} shortcutMode />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
          <h3 className="m-0 text-sm font-bold text-slate-900">
            Attendance Overview ({period})
          </h3>
          <p className="m-0 mt-1 text-[11px] text-slate-500">
            Daily present, absent, and late counts for the selected month.
          </p>
          <div className="mt-3 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<AttendanceTooltip />}
                  cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
                />
                <DashboardLegend />
                <Line
                  type="monotone"
                  dataKey="Present"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Absent"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Late"
                  stroke="#d97706"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
          <h3 className="m-0 text-sm font-bold text-slate-900">
            Payroll Snapshot ({period})
          </h3>
          <p className="m-0 mt-1 text-[11px] text-slate-500">
            Top employees by net pay for the selected payroll period.
          </p>
          <div className="mt-3 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis dataKey="employee" axisLine={false} tickLine={false} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₱${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  content={<PayrollTooltip />}
                  cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                />
                <DashboardLegend />
                <Bar dataKey="Gross" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Net" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Modal Dialog */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={closeModal}
        >
          <div
            className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-xl translate-x-[-50%] translate-y-[-50%] gap-3 rounded-xl border border-slate-200 bg-white p-0 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:-translate-y-1/2 data-[state=open]:translate-y-[-50%]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-violet-200 bg-gradient-to-r from-[#4e1b8a] to-[#6630b0] px-4 py-3">
              <h2 className="m-0 text-base font-semibold text-white">
                {activeModal === "pending"
                  ? `Pending Leave Approvals`
                  : activeModal === "leave"
                    ? `Employees On Leave`
                    : activeModal === "absent"
                      ? `Absent Employees`
                      : `Recent Activity`}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/80 opacity-80 ring-offset-white transition-all duration-200 hover:bg-white/10 hover:text-white hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2 disabled:pointer-events-none"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-4 py-3 max-h-[56vh]">
              {activeModal === "pending" && (
                <div className="space-y-2.5">
                  {[...(dashboardQuery.data.pendingLeaves || [])]
                    .sort(
                      (a, b) =>
                        priorityOrder[a.priority] - priorityOrder[b.priority],
                    )
                    .map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/30 hover:shadow-sm"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-semibold text-xs">
                          {employee.first_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="m-0 text-[13px] font-semibold text-gray-900">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="m-0 mt-0.5 text-xs text-gray-600">
                            {employee.leave_type}
                          </p>
                          <p className="m-0 mt-0.5 text-[11px] text-gray-500">
                            Dates:{" "}
                            {new Date(employee.date_from).toLocaleDateString()}{" "}
                            - {new Date(employee.date_to).toLocaleDateString()}
                          </p>
                          <p
                            className={`m-0 mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityClass[employee.priority] || "bg-gray-100 text-gray-800"}`}
                          >
                            Priority: {employee.priority}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!approvedLeaves.has(employee.id) ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openLeaveDecisionConfirm(employee, "Approved")
                                }
                                className="inline-flex items-center rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-green-700 hover:shadow active:translate-y-px"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openLeaveDecisionConfirm(employee, "Denied")
                                }
                                className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-700 hover:shadow active:translate-y-px"
                              >
                                Deny
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 whitespace-nowrap">
                              Processed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {activeModal === "leave" && (
                <div className="space-y-2.5">
                  {dashboardQuery.data?.onLeave?.map((employee, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/40 hover:shadow-sm"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-semibold text-xs">
                        {employee.first_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="m-0 text-[13px] font-semibold text-gray-900">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-gray-600">
                          {employee.leave_type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeModal === "absent" && (
                <div className="space-y-2.5">
                  {dashboardQuery.data?.absents?.map((employee, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50/30 hover:shadow-sm"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 font-semibold text-xs">
                        {employee.first_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="m-0 text-[13px] font-semibold text-gray-900">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-gray-600">
                          No time-in recorded for today.
                        </p>
                      </div>
                      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-800">
                        Absent
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeModal === "recent-activity" && (
                <div className="space-y-3">
                  {dashboardQuery.data?.recentActivities.map(
                    (activity, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="m-0 text-sm text-gray-500">
                              {activity.date}
                            </p>
                            <p className="m-0 text-sm font-semibold text-gray-900 mt-1">
                              {activity.employee}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              activity.status === "Pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : activity.status === "Approved"
                                  ? "bg-green-100 text-green-800"
                                  : activity.status === "Denied"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {activity.status}
                          </span>
                        </div>
                        <div className="mt-2">
                          <p className="m-0 text-xs font-medium text-gray-600">
                            Activity Type:{" "}
                            <span className="text-gray-900">
                              {activity.type}
                            </span>
                          </p>
                          <p className="m-0 text-xs text-gray-700 mt-1">
                            {activity.activity}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow active:translate-y-px focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
          onClick={() => setReviewConfirm(null)}
        >
          <div
            className="fixed left-[50%] top-[50%] z-[61] w-full max-w-xl translate-x-[-50%] translate-y-[-50%] rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="m-0 text-sm font-semibold text-slate-900">
                {reviewConfirm.status === "Denied"
                  ? "Confirm Denial"
                  : "Confirm Approval"}
              </h3>
              <button
                type="button"
                onClick={() => setReviewConfirm(null)}
                className="rounded text-lg text-slate-500 transition-colors hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="max-h-[56vh] space-y-3 overflow-y-auto px-4 py-3">
              <p className="m-0 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  {reviewConfirm.employee.first_name}{" "}
                  {reviewConfirm.employee.last_name}
                </span>{" "}
                requested {reviewConfirm.employee.leave_type} from{" "}
                {new Date(
                  reviewConfirm.employee.date_from,
                ).toLocaleDateString()}{" "}
                to{" "}
                {new Date(reviewConfirm.employee.date_to).toLocaleDateString()}.
              </p>

              <p className="m-0 text-xs text-slate-700">
                Are you sure you want to {reviewConfirm.status.toLowerCase()}{" "}
                this leave request?
              </p>

              {reviewConfirm.status === "Approved" &&
                reviewConfirm.isMultiDay && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                    <p className="m-0 mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Multi-day request: select specific days to approve
                    </p>
                    <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1">
                      {getDateRangeInclusive(
                        reviewConfirm.employee.date_from,
                        reviewConfirm.employee.date_to,
                      ).map((date) => (
                        <label
                          key={date}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] text-slate-700 transition-colors hover:bg-amber-100/40"
                        >
                          <input
                            type="checkbox"
                            checked={(
                              reviewConfirm.selectedDates || []
                            ).includes(date)}
                            onChange={() => toggleApprovedDate(date)}
                          />
                          <span>
                            {parseDateOnly(date).toLocaleDateString()}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="m-0 mt-2 text-[11px] font-semibold text-amber-800">
                      Selected: {(reviewConfirm.selectedDates || []).length}{" "}
                      day(s)
                    </p>
                  </div>
                )}

              {reviewConfirm.status === "Denied" && (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Reason (required)
                  </label>
                  <textarea
                    rows={2}
                    value={reviewConfirm.remarks}
                    onChange={(e) =>
                      setReviewConfirm({
                        ...reviewConfirm,
                        remarks: e.target.value,
                      })
                    }
                    className="w-full resize-none rounded-md border border-slate-300 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Enter reason for denial"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setReviewConfirm(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:shadow active:translate-y-px"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitLeaveDecision}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:shadow active:translate-y-px ${reviewConfirm.status === "Denied" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
              >
                {reviewConfirm.status === "Denied"
                  ? "Confirm Denial"
                  : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupervisorDashboard({ currentUser }) {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/dashboard-summary");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  const { data: myAttendance = [], isLoading: attLoading } = useQuery({
    queryKey: ["my-attendance", currentUser?.emp_id],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/my-attendance");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/leaves");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: offsets = [] } = useQuery({
    queryKey: ["offset-applications"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/offset-applications");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: resignations = [] } = useQuery({
    queryKey: ["resignations"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/resignations");
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (dashLoading || attLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 font-semibold text-slate-700 shadow-sm">
        Loading Supervisor Dashboard...
      </div>
    );
  }

  const personalSummary = dashboardData?.personalSummary || {};
  const employeeStatus =
    personalSummary.employeeStatus || currentUser?.status || "N/A";
  const teamSummary = dashboardData?.teamSummary || {
    teamSize: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    onLeaveCount: 0,
    pendingApprovals: 0,
  };

  const myPendingRequests = [
    ...leaves
      .filter(
        (row) =>
          String(row.emp_id) === String(currentUser.emp_id) &&
          String(row.status || "").toLowerCase() === "pending",
      )
      .map((row) => ({
        id: `leave-${row.id}`,
        type: "Leave",
        detail: row.leave_type,
        created_at: row.created_at || row.date_from,
      })),
    ...offsets
      .filter(
        (row) =>
          String(row.emp_id) === String(currentUser.emp_id) &&
          ["pending", "pending approval"].includes(
            String(row.status || "").toLowerCase(),
          ),
      )
      .map((row) => ({
        id: `offset-${row.id}`,
        type: "Offset",
        detail: `${Number(row.days_applied || 0)} day(s)`,
        created_at: row.created_at || row.date_from,
      })),
    ...resignations
      .filter(
        (row) =>
          String(row.emp_id) === String(currentUser.emp_id) &&
          String(row.status || "").toLowerCase() === "pending approval",
      )
      .map((row) => ({
        id: `resignation-${row.id}`,
        type: "Resignation",
        detail: row.resignation_type,
        created_at: row.created_at,
      })),
  ]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  const teamAttendanceRows = dashboardData?.teamAttendanceStatus || [];
  const teamPendingRequests = dashboardData?.teamPendingRequests || [];

  const statusClass = {
    Present: "bg-emerald-100 text-emerald-800",
    Late: "bg-amber-100 text-amber-800",
    Undertime: "bg-rose-100 text-rose-800",
    "Half-Day": "bg-orange-100 text-orange-800",
    Absent: "bg-red-100 text-red-800",
    "On Leave": "bg-violet-100 text-violet-800",
    Pending: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="max-w-full space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="m-0 text-[1.3rem] font-bold text-slate-900">
          Supervisor Dashboard
        </h1>
        <p className="m-0 mt-0.5 text-xs text-slate-500">
          Personal insights and team overview for your assigned designation.
        </p>
        <p className="m-0 mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Employment Status: {employeeStatus}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            My Attendance Today
          </p>
          <p className="m-0 mt-1 text-xl font-black text-emerald-800">
            {personalSummary.todayAttendanceStatus || "Absent"}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-blue-700">
            My Leave Balance
          </p>
          <p className="m-0 mt-1 text-xl font-black text-blue-800">
            {Number(personalSummary.leaveBalance || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-violet-700">
            My Offset Credits
          </p>
          <p className="m-0 mt-1 text-xl font-black text-violet-800">
            {Number(personalSummary.offsetCredits || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            My Pending Requests
          </p>
          <p className="m-0 mt-1 text-xl font-black text-amber-800">
            {Number(personalSummary.pendingRequestCount || 0)}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-bold text-slate-900">
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            onClick={() => navigate("/leave")}
            className="group rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold text-violet-800">
              <CalendarPlus2 className="h-4 w-4" />
              File Leave / Offset
            </span>
            <p className="m-0 mt-1 text-[11px] text-slate-600">
              Create and track your personal requests.
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
          <button
            onClick={() => navigate("/attendance")}
            className="group rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800">
              <Clock3 className="h-4 w-4" />
              Team Attendance
            </span>
            <p className="m-0 mt-1 text-[11px] text-slate-600">
              Review attendance entries for your team.
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
          <button
            onClick={() => navigate("/leave")}
            className="group rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold text-sky-800">
              <FileClock className="h-4 w-4" />
              Team Pending Requests
            </span>
            <p className="m-0 mt-1 text-[11px] text-slate-600">
              Review pending leave, offset, and resignation requests.
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-1">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Team Size
          </p>
          <p className="m-0 mt-1 text-2xl font-black text-slate-900">
            {teamSummary.teamSize}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm lg:col-span-1">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Present
          </p>
          <p className="m-0 mt-1 text-2xl font-black text-emerald-800">
            {teamSummary.presentCount}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm lg:col-span-1">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Late
          </p>
          <p className="m-0 mt-1 text-2xl font-black text-amber-800">
            {teamSummary.lateCount}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm lg:col-span-1">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-red-700">
            Absent
          </p>
          <p className="m-0 mt-1 text-2xl font-black text-red-800">
            {teamSummary.absentCount}
          </p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm lg:col-span-1">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-violet-700">
            On Leave
          </p>
          <p className="m-0 mt-1 text-2xl font-black text-violet-800">
            {teamSummary.onLeaveCount}
          </p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 shadow-sm lg:col-span-1">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-sky-700">
            Pending
          </p>
          <p className="m-0 mt-1 text-2xl font-black text-sky-800">
            {teamSummary.pendingApprovals}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="m-0 text-sm font-bold text-slate-900">
            Team Attendance Today
          </h3>
          <p className="m-0 mt-1 text-[11px] text-slate-500">
            Status of employees under your supervision.
          </p>
          <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {teamAttendanceRows.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No team attendance data found.
              </p>
            ) : (
              teamAttendanceRows.map((row) => (
                <div
                  key={row.emp_id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-bold text-slate-900">
                      {row.first_name} {row.last_name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass[row.status] || statusClass.Pending}`}
                  >
                    {row.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="m-0 text-sm font-bold text-slate-900">
            Team Pending Requests
          </h3>
          <p className="m-0 mt-1 text-[11px] text-slate-500">
            Recent requests awaiting your review.
          </p>
          <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {teamPendingRequests.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No pending team requests.
              </p>
            ) : (
              teamPendingRequests.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="m-0 text-xs font-bold text-slate-900">
                      {row.first_name} {row.last_name}
                    </p>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      {row.type}
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-[11px] text-slate-600">
                    {row.detail || "Pending review"}
                  </p>
                  <p className="m-0 mt-0.5 text-[10px] text-slate-400">
                    Filed on {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="m-0 text-sm font-bold text-slate-900">
            My Recent Attendance
          </h3>
          <div className="mt-3 space-y-2">
            {myAttendance.slice(0, 5).map((row, idx) => (
              <div
                key={`${row.date}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="m-0 text-xs font-semibold text-slate-700">
                  {new Date(row.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass[row.status] || statusClass.Pending}`}
                >
                  {row.status}
                </span>
              </div>
            ))}
            {myAttendance.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">
                No recent attendance records.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="m-0 text-sm font-bold text-slate-900">
            My Pending Requests
          </h3>
          <div className="mt-3 space-y-2">
            {myPendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <FolderClock className="h-5 w-5" />
                </span>
                <p className="m-0 text-sm font-semibold text-slate-700">
                  You are all caught up.
                </p>
              </div>
            ) : (
              myPendingRequests.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="m-0 text-xs font-bold text-slate-900">
                      {row.type} Request
                    </p>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Pending
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-[11px] text-slate-600">
                    {row.detail}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ==========================================
// 3. MAIN EXPORT HANDLER
// ==========================================
export default function Dashboard() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("wah_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Show personalized dashboard for regular employees
  if (currentUser?.role === "RankAndFile") {
    return <EmployeeDashboard currentUser={currentUser} />;
  }

  if (currentUser?.role === "Supervisor") {
    return <SupervisorDashboard currentUser={currentUser} />;
  }

  // Show Admin view for Admin/HR
  return <AdminDashboard currentUser={currentUser} />;
}
