import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
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

const fmt = (n) => {
  const num = Number(n);
  return Number.isNaN(num)
    ? "P0.00"
    : "P" +
        num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
};

export default function MyReports() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("wah_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const { data: myAttendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["my-attendance", currentUser?.emp_id],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/my-attendance");
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
  });

  const { data: payrollData = [], isLoading: payrollLoading } = useQuery({
    queryKey: ["my-payroll-report", period],
    queryFn: async () => {
      const res = await apiFetch(`/api/employees/payroll?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch payroll report");
      return res.json();
    },
  });

  const myPayrollRows = payrollData.filter(
    (row) => String(row.emp_id) === String(currentUser?.emp_id),
  );

  const attendanceSummary = myAttendance.reduce(
    (acc, entry) => {
      const status = String(entry.status || "Pending");
      const key = status.split(",")[0].trim();
      acc.total += 1;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { total: 0, Present: 0, Absent: 0, Late: 0, Undertime: 0, "Half-Day": 0 },
  );

  const attendanceTrend = useMemo(() => {
    const map = new Map();

    myAttendance.forEach((entry) => {
      const date = new Date(entry.date);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });

      if (!map.has(key)) {
        map.set(key, {
          key,
          month: label,
          Present: 0,
          Absent: 0,
          Late: 0,
          Undertime: 0,
          "On Leave": 0,
        });
      }

      const row = map.get(key);
      const status = String(entry.status || "Pending")
        .split(",")[0]
        .trim();

      if (Object.prototype.hasOwnProperty.call(row, status)) {
        row[status] += 1;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6)
      .map(({ key, ...rest }) => rest);
  }, [myAttendance]);

  const payrollBreakdown = useMemo(() => {
    const row = myPayrollRows[0];
    if (!row) return [];

    return [
      { metric: "Basic Pay", amount: Number(row.basic_pay || 0) },
      { metric: "Incentives", amount: Number(row.incentives || 0) },
      { metric: "Deductions", amount: Number(row.absence_deductions || 0) },
      { metric: "Net Pay", amount: Number(row.net_pay || 0) },
    ];
  }, [myPayrollRows]);

  if (attendanceLoading || payrollLoading) {
    return (
      <div className="p-6 font-bold text-gray-800">Loading reports...</div>
    );
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="m-0 text-[1.4rem] font-bold text-gray-900">
          My Reports
        </h1>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          Period:
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="m-0 mb-3 text-base font-bold text-gray-900">
          Personal Attendance Report
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            ["Total Logs", attendanceSummary.total, "text-slate-900"],
            ["Present", attendanceSummary.Present, "text-green-700"],
            ["Absent", attendanceSummary.Absent, "text-red-700"],
            ["Late", attendanceSummary.Late, "text-amber-700"],
            ["Undertime", attendanceSummary.Undertime, "text-orange-700"],
            ["Half-Day", attendanceSummary["Half-Day"], "text-purple-700"],
          ].map(([label, value, color]) => (
            <div
              key={label}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center"
            >
              <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                {label}
              </p>
              <p className={`m-0 mt-1 text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="m-0 mb-3 text-base font-bold text-gray-900">
            Attendance Trend (Last 6 Months)
          </h2>
          {attendanceTrend.length === 0 ? (
            <p className="m-0 py-10 text-center text-sm font-medium text-gray-500">
              No attendance trend data yet.
            </p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={attendanceTrend}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                  />
                  <Tooltip />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Absent"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Late"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Undertime"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="m-0 mb-3 text-base font-bold text-gray-900">
            Payroll Breakdown (
            {new Date(`${period}-01`).toLocaleString("default", {
              month: "short",
              year: "numeric",
            })}
            )
          </h2>
          {payrollBreakdown.length === 0 ? (
            <p className="m-0 py-10 text-center text-sm font-medium text-gray-500">
              No payroll data to visualize for this period.
            </p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={payrollBreakdown}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis
                    dataKey="metric"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                    tickFormatter={(v) => `P${Math.round(v / 1000)}k`}
                  />
                  <Tooltip formatter={(value) => fmt(value)} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h2 className="m-0 text-base font-bold text-gray-900">
            Personal Payroll Report
          </h2>
          <span className="text-xs font-semibold text-gray-500">
            {new Date(`${period}-01`).toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Basic Pay
                </th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Incentives
                </th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Deductions
                </th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Net Pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {myPayrollRows.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="px-4 py-6 text-center text-sm font-medium text-gray-500"
                  >
                    No payroll report available for this period.
                  </td>
                </tr>
              ) : (
                myPayrollRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-semibold text-gray-800">
                      {fmt(row.basic_pay)}
                    </td>
                    <td className="px-4 py-2.5 text-green-700">
                      +{fmt(row.incentives)}
                    </td>
                    <td className="px-4 py-2.5 text-red-700">
                      -{fmt(row.absence_deductions)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-blue-700">
                      {fmt(row.net_pay)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
