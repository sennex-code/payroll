import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
import axiosInterceptor from "../hooks/interceptor";

const badgeClass = {
  Present: "bg-green-100 text-green-800",
  Late: "bg-amber-100 text-amber-800",
  Undertime: "bg-rose-100 text-rose-800",
  "Half-Day": "bg-orange-100 text-orange-800",
  Absent: "bg-red-100 text-red-800",
  "On Leave": "bg-purple-100 text-purple-800",
  Pending: "bg-gray-100 text-gray-500",
  "": "bg-gray-100 text-gray-500", // Fallback styling for None
};

export default function Attendance({ shortcutMode = false }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, showToast, clearToast } = useToast();
  const [search, setSearch] = useState("");
  const [workweekForm, setWorkweekForm] = useState({
    workweek_type: "5-day",
    effective_from: "",
    effective_to: "",
  });
  const [editingWorkweekId, setEditingWorkweekId] = useState(null);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("wah_user") || "null");
    } catch {
      return null;
    }
  }, []);
  const isAdmin = currentUser?.role === "Admin";
  const canEditAttendance =
    currentUser?.role === "Admin" || currentUser?.role === "HR";
  const canConfigureWorkweek =
    currentUser?.role === "Admin" || currentUser?.role === "HR";

  // Modals State
  const [adjModal, setAdjModal] = useState(null);
  const [adjType, setAdjType] = useState("Subtract");
  const [adjDays, setAdjDays] = useState("");

  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [workweekModalOpen, setWorkweekModalOpen] = useState(false);

  // Calendar State
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Daily Form & Bulk Action State
  const [dailySearch, setDailySearch] = useState("");
  const [dailyStatusFilter, setDailyStatusFilter] = useState("All");
  const [attendanceForm, setAttendanceForm] = useState({});
  const [secondaryStatusForm, setSecondaryStatusForm] = useState({});
  const [selectedEmployees, setSelectedEmployees] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("Present");

  useEffect(() => {
    if (!shortcutMode && searchParams.get("open") !== "take-attendance") return;

    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    setSelectedDate(localDate);
    setDailyModalOpen(true);

    if (shortcutMode) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("open");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, shortcutMode]);

  // --- QUERIES ---
  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/attendance");
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
  });

  const { data: calendarSummary = [] } = useQuery({
    queryKey: ["attendance-calendar", year, month],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/employees/attendance-summary?year=${year}&month=${month + 1}`,
      );
      return res.json();
    },
  });

  const { data: workweekConfigs = [] } = useQuery({
    queryKey: ["workweek-config"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/workweek-config");
      if (!res.ok) throw new Error("Failed to fetch workweek config");
      return res.json();
    },
  });

  const { data: dailyList = [], isLoading: dailyLoading } = useQuery({
    queryKey: ["attendance-daily", selectedDate],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/employees/attendance-daily?date=${selectedDate}`,
      );
      const data = await res.json();

      const initialForm = {};
      const initialSecondary = {};
      data.forEach((emp) => {
        initialForm[emp.emp_id] = emp.attendance_status || "";
        // FIX: Tell React to load status2 from the database
        initialSecondary[emp.emp_id] = emp.status2 || "";
      });
      setAttendanceForm(initialForm);
      setSecondaryStatusForm(initialSecondary);
      return data;
    },
    enabled: !!selectedDate && dailyModalOpen,
  });

  // --- MUTATIONS ---
  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ empId, amount }) => {
      const res = await apiFetch(`/api/employees/leave-balance/${empId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adjustment: amount }),
      });
      if (!res.ok) throw new Error("Failed to adjust leave balance");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      showToast("Leave balance updated.");
      setAdjModal(null);
      setAdjDays("");
    },
    onError: () => showToast("Failed to adjust leave balance.", "error"),
  });

  const saveDailyAttendanceMutation = useMutation({
    mutationFn: async (records) => {
      // CHANGED: Use axiosInterceptor instead of apiFetch to guarantee the token is sent
      const res = await axiosInterceptor.post(
        "/api/employees/attendance-bulk",
        {
          date: selectedDate,
          records,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["attendance"]);
      queryClient.invalidateQueries(["attendance-calendar"]);
      showToast("Attendance saved successfully.");
      setDailyModalOpen(false);
    },
    onError: () => showToast("Failed to save attendance.", "error"),
  });

  const saveWorkweekMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await apiFetch("/api/employees/workweek-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save workweek config");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workweek-config"] });
      showToast("Workweek configuration saved.");
      setWorkweekForm((prev) => ({
        ...prev,
        effective_from: "",
        effective_to: "",
      }));
    },
    onError: (err) =>
      showToast(err.message || "Failed to save config.", "error"),
  });

  const updateWorkweekMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await apiFetch(`/api/employees/workweek-config/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update workweek config");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workweek-config"] });
      showToast("Workweek configuration updated.");
      setEditingWorkweekId(null);
      setWorkweekForm({
        workweek_type: "5-day",
        effective_from: "",
        effective_to: "",
      });
    },
    onError: (err) =>
      showToast(err.message || "Failed to update config.", "error"),
  });

  const deleteWorkweekMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiFetch(`/api/employees/workweek-config/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete workweek config");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workweek-config"] });
      showToast("Workweek configuration deleted.");
    },
    onError: (err) =>
      showToast(err.message || "Failed to delete config.", "error"),
  });

  // --- HANDLERS ---
  const handleDailySubmit = (e) => {
    e.preventDefault();
    if (!canEditAttendance) {
      showToast("View-only access: you cannot modify attendance.", "error");
      return;
    }

    const records = Object.entries(attendanceForm)
      .filter(([_, status]) => status !== "" && status !== "Pending")
      .map(([emp_id, status]) => {
        const secondary = secondaryStatusForm[emp_id];

        // FIX: Send them as two separate pieces of data!
        return {
          emp_id,
          status: status,
          status2: secondary || null,
        };
      });
    saveDailyAttendanceMutation.mutate(records);
  };

  const markAllPresent = () => {
    if (!canEditAttendance) return;

    const updated = { ...attendanceForm };
    dailyList.forEach((emp) => {
      // CHANGED: Check for "" (none) as well as "Pending"
      if (!updated[emp.emp_id] || updated[emp.emp_id] === "Pending") {
        updated[emp.emp_id] = "Present";
      }
    });
    setAttendanceForm(updated);
  };

  const filteredDaily = dailyList.filter((a) => {
    const matchesSearch = `${a.first_name} ${a.last_name} ${a.emp_id}`
      .toLowerCase()
      .includes(dailySearch.toLowerCase());

    if (!matchesSearch) return false;
    if (dailyStatusFilter === "All") return true;

    const primary = attendanceForm[a.emp_id] || "None";
    const secondary = secondaryStatusForm[a.emp_id] || "None";

    if (dailyStatusFilter === "None") {
      return primary === "None" && secondary === "None";
    }

    return primary === dailyStatusFilter || secondary === dailyStatusFilter;
  });

  const dailyModalOverview = useMemo(() => {
    return filteredDaily.reduce(
      (acc, emp) => {
        const primary = attendanceForm[emp.emp_id] || "";
        const secondary = secondaryStatusForm[emp.emp_id] || "";

        if (primary === "Present") acc.present += 1;
        if (primary === "Absent") acc.absent += 1;
        if (primary === "On Leave") acc.onLeave += 1;
        if (!primary && !secondary) acc.unassigned += 1;
        if (secondary === "Late") acc.late += 1;
        if (secondary === "Undertime") acc.undertime += 1;
        if (secondary === "Half-Day") acc.halfDay += 1;
        if (primary || secondary) acc.assigned += 1;

        return acc;
      },
      {
        total: filteredDaily.length,
        assigned: 0,
        unassigned: 0,
        present: 0,
        absent: 0,
        onLeave: 0,
        late: 0,
        undertime: 0,
        halfDay: 0,
      },
    );
  }, [filteredDaily, attendanceForm, secondaryStatusForm]);

  const toggleEmployeeSelection = (empId) => {
    if (!canEditAttendance) return;

    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(empId)) newSelected.delete(empId);
    else newSelected.add(empId);
    setSelectedEmployees(newSelected);
  };

  const toggleAllSelected = () => {
    if (!canEditAttendance) return;

    if (selectedEmployees.size === filteredDaily.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredDaily.map((e) => e.emp_id)));
    }
  };

  const applyBulkStatus = () => {
    if (!canEditAttendance) return;
    if (selectedEmployees.size === 0) return;
    const updated = { ...attendanceForm };
    selectedEmployees.forEach((id) => {
      updated[id] = bulkStatus;
    });
    setAttendanceForm(updated);
    setSelectedEmployees(new Set());
  };

  const handleWorkweekSubmit = (e) => {
    e.preventDefault();
    if (!workweekForm.effective_from) {
      showToast("Effective from date is required.", "error");
      return;
    }

    const payload = {
      ...workweekForm,
      effective_to: workweekForm.effective_to || null,
    };

    if (editingWorkweekId) {
      updateWorkweekMutation.mutate({ id: editingWorkweekId, payload });
      return;
    }

    saveWorkweekMutation.mutate(payload);
  };

  const handleEditWorkweek = (cfg) => {
    setEditingWorkweekId(cfg.id);
    setWorkweekForm({
      workweek_type: cfg.workweek_type,
      effective_from: String(cfg.effective_from).slice(0, 10),
      effective_to: cfg.effective_to
        ? String(cfg.effective_to).slice(0, 10)
        : "",
    });
  };

  const handleCancelEditWorkweek = () => {
    setEditingWorkweekId(null);
    setWorkweekForm({
      workweek_type: "5-day",
      effective_from: "",
      effective_to: "",
    });
  };

  const handleDeleteWorkweek = (cfg) => {
    const confirmed = window.confirm(
      `Delete ${cfg.workweek_type} rule effective ${String(cfg.effective_from).slice(0, 10)}?`,
    );
    if (!confirmed) return;
    deleteWorkweekMutation.mutate(cfg.id);
  };

  // --- UI HELPERS ---
  const getLeaveHighlightColor = (remaining) => {
    if (remaining <= 0) return "bg-red-100 text-red-800";
    if (remaining <= 3) return "bg-orange-100 text-orange-800";
    return "bg-blue-100 text-blue-800";
  };

  const pad = (n) => (n < 10 ? "0" + n : "" + n);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = Array(firstDay)
    .fill(null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const today = new Date();

  const filteredMain = attendance.filter((a) =>
    `${a.first_name} ${a.last_name} ${a.emp_id}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const overviewStats = useMemo(() => {
    return attendance.reduce(
      (acc, row) => {
        const primary = row.status || "Pending";
        if (primary === "Present") acc.present += 1;
        if (primary === "Absent") acc.absent += 1;
        if (primary === "On Leave") acc.onLeave += 1;
        if (primary === "Pending") acc.pending += 1;
        if (row.status2) acc.withSecondary += 1;
        return acc;
      },
      {
        total: attendance.length,
        present: 0,
        absent: 0,
        onLeave: 0,
        pending: 0,
        withSecondary: 0,
      },
    );
  }, [attendance]);

  if (isLoading)
    return <div className="p-6 font-bold">Loading Attendance...</div>;

  return (
    <div className="max-w-full">
      {!shortcutMode && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            {canConfigureWorkweek && (
              <button
                onClick={() => setWorkweekModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-sm cursor-pointer hover:bg-indigo-700 border-0 transition-colors"
              >
                ⚙️ Workweek Setup
              </button>
            )}
          </div>

          {/* --- INLINE CALENDAR VIEW --- */}
          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 px-4 py-3 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-base font-bold">
                    Attendance Calendar
                  </h2>
                  <p className="m-0 mt-1 text-xs text-white/90">
                    Select a date to review or record daily attendance.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => setViewDate(new Date(year, month - 1, 1))}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  ◀ Prev
                </button>
                <h3 className="m-0 text-base font-bold text-slate-800">
                  {viewDate.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <button
                  onClick={() => setViewDate(new Date(year, month + 1, 1))}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Next ▶
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="rounded-lg bg-slate-100 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (!day)
                    return <div key={`empty-${i}`} className="min-h-[88px]" />;
                  const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                  const isToday =
                    today.getFullYear() === year &&
                    today.getMonth() === month &&
                    today.getDate() === day;

                  const dayData = calendarSummary.find((s) => {
                    const dbDate = new Date(s.date);
                    return (
                      dbDate.getFullYear() === year &&
                      dbDate.getMonth() === month &&
                      dbDate.getDate() === day
                    );
                  });

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setDailyModalOpen(true);
                        setSelectedEmployees(new Set());
                      }}
                      className={`min-h-[88px] cursor-pointer rounded-xl border bg-white p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isToday ? "border-indigo-600 ring-2 ring-indigo-200" : "border-slate-200 hover:border-indigo-300"}`}
                    >
                      <div className="mb-1 flex w-full items-center justify-between">
                        <span
                          className={`text-xs font-bold ${isToday ? "text-indigo-700" : "text-slate-700"}`}
                        >
                          {day}
                        </span>
                      </div>
                      {dayData && (
                        <div className="mt-auto flex w-full flex-col gap-1">
                          {dayData.present_count > 0 && (
                            <div className="w-full truncate rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                              • {dayData.present_count} Present
                            </div>
                          )}
                          {dayData.late_count > 0 && (
                            <div className="w-full truncate rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              • {dayData.late_count} Late
                            </div>
                          )}
                          {dayData.undertime_count > 0 && (
                            <div className="w-full truncate rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              • {dayData.undertime_count} Undertime
                            </div>
                          )}
                          {dayData.halfday_count > 0 && (
                            <div className="w-full truncate rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                              • {dayData.halfday_count} Half-Day
                            </div>
                          )}
                          {dayData.leave_count > 0 && (
                            <div className="w-full truncate rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                              • {dayData.leave_count} On Leave
                            </div>
                          )}
                          {dayData.absent_count > 0 && (
                            <div className="w-full truncate rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                              • {dayData.absent_count} Absent
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* --- OVERALL ATTENDANCE OVERVIEW --- */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="m-0 text-base font-bold text-gray-900">
                Attendance Overview
              </h2>
              <input
                type="text"
                className="w-full max-w-[280px] px-3 py-1.5 rounded-lg border border-gray-300 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="m-0 text-[11px] font-semibold text-gray-500">
                  Total
                </p>
                <p className="m-0 text-sm font-bold text-gray-900">
                  {overviewStats.total}
                </p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <p className="m-0 text-[11px] font-semibold text-green-700">
                  Present
                </p>
                <p className="m-0 text-sm font-bold text-green-800">
                  {overviewStats.present}
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="m-0 text-[11px] font-semibold text-red-700">
                  Absent
                </p>
                <p className="m-0 text-sm font-bold text-red-800">
                  {overviewStats.absent}
                </p>
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
                <p className="m-0 text-[11px] font-semibold text-purple-700">
                  On Leave
                </p>
                <p className="m-0 text-sm font-bold text-purple-800">
                  {overviewStats.onLeave}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="m-0 text-[11px] font-semibold text-amber-700">
                  Pending
                </p>
                <p className="m-0 text-sm font-bold text-amber-800">
                  {overviewStats.pending}
                </p>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <p className="m-0 text-[11px] font-semibold text-sky-700">
                  With Status 2
                </p>
                <p className="m-0 text-sm font-bold text-sky-800">
                  {overviewStats.withSecondary}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase text-[11px]">
                      Employee
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase text-[11px]">
                      Employment
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase text-[11px]">
                      Primary Status
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 uppercase text-[11px]">
                      Status 2
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 uppercase text-[11px]">
                      Absences
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredMain.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-3 py-4 text-center text-gray-500"
                      >
                        No matching records.
                      </td>
                    </tr>
                  ) : (
                    filteredMain.map((a, index) => (
                      <tr
                        key={`${a.emp_id}-${index}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-3 py-2">
                          <p className="m-0 font-semibold text-gray-900">
                            {a.first_name} {a.last_name}
                          </p>
                          <p className="m-0 text-[11px] text-gray-500">
                            {a.emp_id}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {a.emp_status || "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass[a.status || "Pending"] || "bg-gray-100 text-gray-800"}`}
                          >
                            {a.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass[a.status2 || ""] || "bg-gray-100 text-gray-500"}`}
                          >
                            {a.status2 || "--"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-700">
                          {a.total_absences || 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* --- MODAL: DAILY ATTENDANCE FORM --- */}
      {dailyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onClick={() => setDailyModalOpen(false)}
        >
          <div
            className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-700 px-5 py-3 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="m-0 text-base font-bold">
                    Attendance for {selectedDate}
                  </h2>
                  <p className="m-0 mt-0.5 text-[11px] text-white/80">
                    Review, filter, and manage personnel attendance records.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90">
                    {canEditAttendance ? "Edit Mode" : "View Mode"}
                  </div>
                  <button
                    onClick={() => setDailyModalOpen(false)}
                    className="cursor-pointer rounded-md border border-white/20 bg-white/5 px-2 py-0.5 text-lg text-white transition-colors hover:bg-white/10 hover:text-slate-200"
                    aria-label="Close attendance modal"
                  >
                    &times;
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/60 p-3">
              {!canEditAttendance && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                  View-only mode: Supervisors can view attendance records but
                  cannot edit them.
                </div>
              )}

              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                <div className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                  Total: {dailyModalOverview.total}
                </div>
                <div className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                  Assigned: {dailyModalOverview.assigned}
                </div>
                <div className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-700">
                  Unassigned: {dailyModalOverview.unassigned}
                </div>
                <div className="shrink-0 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">
                  Present: {dailyModalOverview.present}
                </div>
                <div className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                  Absent: {dailyModalOverview.absent}
                </div>
                <div className="shrink-0 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700">
                  On Leave: {dailyModalOverview.onLeave}
                </div>
                <div className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                  Late: {dailyModalOverview.late}
                </div>
                <div className="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                  Under/Half:{" "}
                  {dailyModalOverview.undertime + dailyModalOverview.halfDay}
                </div>
              </div>

              <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2">
                <input
                  type="text"
                  placeholder="Search personnel..."
                  value={dailySearch}
                  onChange={(e) => setDailySearch(e.target.value)}
                  className="w-56 rounded-lg border border-slate-300 px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={dailyStatusFilter}
                  onChange={(e) => setDailyStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Status Types</option>
                  <option value="None">Unassigned</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Late">Late</option>
                  <option value="Undertime">Undertime</option>
                  <option value="Half-Day">Half-Day</option>
                </select>
              </div>

              {canEditAttendance ? (
                <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-800">
                      Selected: {selectedEmployees.size}
                    </span>
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select --</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="On Leave">On Leave</option>
                    </select>
                    <button
                      onClick={applyBulkStatus}
                      disabled={selectedEmployees.size === 0}
                      className="cursor-pointer rounded bg-indigo-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                  <button
                    onClick={markAllPresent}
                    className="cursor-pointer rounded border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-200"
                  >
                    ✓ Mark Unassigned as Present
                  </button>
                </div>
              ) : (
                <div className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
                  Bulk update tools are disabled in view-only mode.
                </div>
              )}

              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                    <tr>
                      <th className="px-3 py-1.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedEmployees.size > 0 &&
                            selectedEmployees.size === filteredDaily.length
                          }
                          onChange={toggleAllSelected}
                          disabled={!canEditAttendance}
                          className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-gray-700 uppercase text-[11px]">
                        Employee
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-gray-700 uppercase text-[11px]">
                        Designation
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-gray-700 uppercase text-[11px]">
                        Primary Status
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-gray-700 uppercase text-[11px]">
                        Secondary (Opt.)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dailyLoading ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="p-4 text-center font-bold text-gray-500"
                        >
                          Loading List...
                        </td>
                      </tr>
                    ) : (
                      filteredDaily.map((emp, index) => {
                        const isChecked = selectedEmployees.has(emp.emp_id);
                        return (
                          <tr
                            key={`${emp.emp_id}-${index}`}
                            className={`text-xs transition-colors hover:bg-slate-50 ${isChecked ? "bg-indigo-50/60" : ""}`}
                          >
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  toggleEmployeeSelection(emp.emp_id)
                                }
                                disabled={!canEditAttendance}
                                className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <p className="font-bold m-0 text-gray-900 text-xs">
                                {emp.first_name} {emp.last_name}
                              </p>
                              <p className="text-[10px] text-gray-500 m-0">
                                {emp.emp_id}
                              </p>
                            </td>
                            <td className="px-3 py-1.5 text-gray-600 text-xs">
                              {emp.emp_status}
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                // CHANGED: Default is now ""
                                value={attendanceForm[emp.emp_id] || ""}
                                onChange={(e) => {
                                  if (!canEditAttendance) return;
                                  const nextPrimary = e.target.value;
                                  setAttendanceForm({
                                    ...attendanceForm,
                                    [emp.emp_id]: nextPrimary,
                                  });

                                  // Keep status2 empty when primary is Absent.
                                  if (nextPrimary === "Absent") {
                                    setSecondaryStatusForm({
                                      ...secondaryStatusForm,
                                      [emp.emp_id]: "",
                                    });
                                  }
                                }}
                                disabled={!canEditAttendance}
                                // CHANGED: Pull fallback style correctly from badgeClass
                                className={`border p-1 rounded outline-none font-semibold max-w-[90px] text-xs disabled:cursor-not-allowed disabled:opacity-60 ${badgeClass[attendanceForm[emp.emp_id]] || badgeClass[""]}`}
                              >
                                <option value="">-- None --</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="On Leave">On Leave</option>
                              </select>
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                value={secondaryStatusForm[emp.emp_id] || ""}
                                onChange={(e) =>
                                  setSecondaryStatusForm({
                                    ...secondaryStatusForm,
                                    [emp.emp_id]: e.target.value,
                                  })
                                }
                                disabled={
                                  !canEditAttendance ||
                                  attendanceForm[emp.emp_id] === "Absent"
                                }
                                className={`border p-1 rounded outline-none font-semibold max-w-[90px] text-xs disabled:cursor-not-allowed disabled:opacity-60 ${badgeClass[secondaryStatusForm[emp.emp_id]] || badgeClass[""]}`}
                              >
                                <option value="">-- None --</option>
                                <option value="Late">Late</option>
                                <option value="Undertime">Undertime</option>
                                <option value="Half-Day">Half-Day</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 flex shrink-0 justify-end gap-2 border-t border-slate-200 pt-2">
                <button
                  onClick={() => setDailyModalOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  onClick={handleDailySubmit}
                  disabled={
                    !canEditAttendance || saveDailyAttendanceMutation.isPending
                  }
                  className="cursor-pointer rounded-lg border-0 bg-indigo-700 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-indigo-800 disabled:opacity-50"
                >
                  {!canEditAttendance
                    ? "View Only"
                    : saveDailyAttendanceMutation.isPending
                      ? "Saving..."
                      : "Save Attendance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Adjustment Modal */}
      {adjModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold m-0">Adjust Leave Balance</h2>
              <button
                onClick={() => {
                  setAdjModal(null);
                  setAdjDays("");
                }}
                className="text-white text-2xl border-0 bg-transparent cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adjustBalanceMutation.mutate({
                  empId: adjModal.emp_id,
                  amount:
                    adjType === "Subtract"
                      ? -Math.abs(adjDays)
                      : Math.abs(adjDays),
                });
              }}
              className="p-6"
            >
              <div className="flex flex-col gap-4">
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Subtract">Subtract Days (Minus)</option>
                  <option value="Add">Add Days (Plus)</option>
                </select>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={adjDays}
                  onChange={(e) => setAdjDays(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Number of days"
                />
                <button
                  type="submit"
                  disabled={adjustBalanceMutation.isPending}
                  className="w-full py-2 bg-purple-700 text-white rounded-lg font-bold border-0 cursor-pointer hover:bg-purple-800"
                >
                  {adjustBalanceMutation.isPending
                    ? "Saving..."
                    : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- WORKWEEK CONFIGURATION MODAL --- */}
      {workweekModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="bg-indigo-600 px-4 py-3 flex justify-between items-center text-white">
              <h2 className="text-base font-bold m-0">
                Workweek Configuration
              </h2>
              <button
                onClick={() => setWorkweekModalOpen(false)}
                className="text-white text-xl bg-transparent border-0 cursor-pointer hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            <div className="p-4 max-h-[75vh] overflow-y-auto space-y-4">
              <div>
                <form
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end mb-4"
                  onSubmit={handleWorkweekSubmit}
                >
                  <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700 uppercase">
                    Workweek Type
                    <select
                      value={workweekForm.workweek_type}
                      onChange={(e) =>
                        setWorkweekForm((prev) => ({
                          ...prev,
                          workweek_type: e.target.value,
                        }))
                      }
                      className="px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="5-day">5-day (8h, 1.00)</option>
                      <option value="4-day">4-day (10h, 1.25)</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700 uppercase">
                    From
                    <input
                      required
                      type="date"
                      value={workweekForm.effective_from}
                      onChange={(e) =>
                        setWorkweekForm((prev) => ({
                          ...prev,
                          effective_from: e.target.value,
                        }))
                      }
                      className="px-2 py-1.5 rounded-lg border border-gray-300 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700 uppercase">
                    To (Opt.)
                    <input
                      type="date"
                      value={workweekForm.effective_to}
                      onChange={(e) =>
                        setWorkweekForm((prev) => ({
                          ...prev,
                          effective_to: e.target.value,
                        }))
                      }
                      className="px-2 py-1.5 rounded-lg border border-gray-300 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={
                      saveWorkweekMutation.isPending ||
                      updateWorkweekMutation.isPending
                    }
                    className="h-9 px-3 rounded-lg border-0 bg-indigo-600 text-white text-xs font-bold cursor-pointer hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {saveWorkweekMutation.isPending ||
                    updateWorkweekMutation.isPending
                      ? "Saving..."
                      : editingWorkweekId
                        ? "Update"
                        : "Save"}
                  </button>
                </form>

                {editingWorkweekId && (
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={handleCancelEditWorkweek}
                      className="px-3 py-1 text-xs font-semibold rounded-md border border-indigo-300 text-indigo-800 bg-white hover:bg-indigo-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase text-[10px]">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase text-[10px]">
                        From
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase text-[10px]">
                        To
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase text-[10px]">
                        Hrs/Day
                      </th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase text-[10px]">
                        Unit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workweekConfigs.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-2 text-gray-500 text-xs"
                          colSpan={6}
                        >
                          No rules configured.
                        </td>
                      </tr>
                    ) : (
                      workweekConfigs.map((cfg) => (
                        <tr
                          key={cfg.id}
                          className="border-b border-gray-200 hover:bg-gray-100"
                        >
                          <td className="px-3 py-2 font-semibold text-gray-800 text-xs">
                            {cfg.workweek_type}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-xs">
                            {String(cfg.effective_from).slice(0, 10)}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-xs">
                            {cfg.effective_to
                              ? String(cfg.effective_to).slice(0, 10)
                              : "Open"}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-xs">
                            {Number(cfg.hours_per_day).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-xs">
                            {Number(cfg.absence_unit).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditWorkweek(cfg)}
                                className="px-2 py-0.5 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWorkweek(cfg)}
                                disabled={deleteWorkweekMutation.isPending}
                                className="px-2 py-0.5 text-[10px] font-bold rounded border border-red-200 bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-60 cursor-pointer"
                              >
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setWorkweekModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 font-semibold text-sm cursor-pointer hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
