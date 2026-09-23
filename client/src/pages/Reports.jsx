import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const fmt = (n) => {
  const num = Number(n);
  return isNaN(num)
    ? "₱0.00"
    : "₱" +
        num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
};

const FinancialTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-bold text-gray-800 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p
            key={index}
            style={{ color: entry.color }}
            className="text-sm font-semibold m-0"
          >
            {entry.name}: {fmt(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const currentYearMonth = new Date().toISOString().slice(0, 7);

  const {
    data: reportData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["payroll-reports"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/payroll-reports");
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const exportCSV = () => {
    if (!reportData || !monthlySummaryUpToCurrentMonth.length) return;

    let csvContent =
      "Month,Present Days,Absent Days,Late Days,Leaves,Total Incentives (PHP),Total Gross (PHP),Total Deductions (PHP),Total Net (PHP)\n";

    monthlySummaryUpToCurrentMonth.forEach((row) => {
      csvContent += `"${row.month}",${row.present},${row.absent},${row.late},${row.onLeave},${row.totalIncentives},${row.totalGross},${row.totalDeductions},${row.totalNet}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Combined_Report_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading)
    return (
      <div className="p-6 font-bold text-gray-700">Loading Reports...</div>
    );
  if (isError)
    return (
      <div className="p-6 font-bold text-red-600">
        Failed to load reports data.
      </div>
    );

  const { activeEmployees = 0, monthlySummary = [] } = reportData || {};

  const monthlySummaryUpToCurrentMonth = monthlySummary.filter((row) => {
    const sortMonth = String(row.sortMonth || "").slice(0, 7);
    if (!sortMonth) return true;
    return sortMonth <= currentYearMonth;
  });

  const chartData = [...monthlySummaryUpToCurrentMonth].reverse();
  const latestVisibleMonth = monthlySummaryUpToCurrentMonth[0] || {
    month: "No Data",
    totalNet: 0,
    totalDeductions: 0,
    absent: 0,
  };
  const latestMonthName = latestVisibleMonth.month;
  const latestNet = latestVisibleMonth.totalNet;
  const latestDeductions = latestVisibleMonth.totalDeductions;
  const latestAbsences = latestVisibleMonth.absent;

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="m-0 text-[1.4rem] font-bold text-gray-900">
          Combined Reports
        </h1>
        <button
          onClick={exportCSV}
          disabled={monthlySummaryUpToCurrentMonth.length === 0}
          className="px-5 py-2.5 rounded-lg border-0 text-white text-sm font-semibold cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:opacity-90 disabled:opacity-50 shadow-sm"
        >
          ⬇ Export CSV
        </button>
      </div>

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 flex flex-col gap-1 border-t-4 border-purple-600 shadow-sm">
          <span className="text-2xl font-bold text-purple-700">
            {activeEmployees}
          </span>
          <span className="text-[0.80rem] font-medium uppercase text-gray-500 tracking-wider">
            Active Employees
          </span>
        </div>
        <div className="bg-white rounded-xl p-4 flex flex-col gap-1 border-t-4 border-green-500 shadow-sm">
          <span className="text-2xl font-bold text-green-600">
            {fmt(latestNet)}
          </span>
          <span className="text-[0.80rem] font-medium uppercase text-gray-500 tracking-wider">
            Net Pay ({latestMonthName})
          </span>
        </div>
        <div className="bg-white rounded-xl p-4 flex flex-col gap-1 border-t-4 border-red-500 shadow-sm">
          <span className="text-2xl font-bold text-red-600">
            {fmt(latestDeductions)}
          </span>
          <span className="text-[0.80rem] font-medium uppercase text-gray-500 tracking-wider">
            Deductions ({latestMonthName})
          </span>
        </div>
        <div className="bg-white rounded-xl p-4 flex flex-col gap-1 border-t-4 border-orange-500 shadow-sm">
          <span className="text-2xl font-bold text-orange-600">
            {latestAbsences}
          </span>
          <span className="text-[0.80rem] font-medium uppercase text-gray-500 tracking-wider">
            Absences ({latestMonthName})
          </span>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h3 className="m-0 mb-4 text-base font-bold text-gray-800">
            Financial Overview (Gross vs Net)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  tickFormatter={(value) => `₱${value / 1000}k`}
                />
                <Tooltip content={<FinancialTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                <Bar
                  dataKey="totalGross"
                  name="Gross Pay"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="totalNet"
                  name="Net Pay"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h3 className="m-0 mb-4 text-base font-bold text-gray-800">
            Attendance Issues Trend
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
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
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                <Line
                  type="monotone"
                  dataKey="absent"
                  name="Absences"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="late"
                  name="Lates"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="m-0 text-base font-bold text-gray-900">
            Detailed Monthly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white text-sm text-left">
            <thead>
              <tr>
                <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50">
                  Period
                </th>
                {}
                <th className="px-5 py-3 font-bold text-blue-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-blue-50/50 text-center border-l">
                  Present
                </th>
                <th className="px-5 py-3 font-bold text-blue-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-blue-50/50 text-center">
                  Absent
                </th>
                <th className="px-5 py-3 font-bold text-blue-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-blue-50/50 text-center">
                  Late
                </th>
                <th className="px-5 py-3 font-bold text-blue-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-blue-50/50 text-center">
                  Leaves
                </th>
                {}
                <th className="px-5 py-3 font-bold text-green-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-green-50/50 text-right border-l">
                  Incentives
                </th>
                <th className="px-5 py-3 font-bold text-green-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-green-50/50 text-right">
                  Gross Pay
                </th>
                <th className="px-5 py-3 font-bold text-red-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-red-50/50 text-right">
                  Deductions
                </th>
                <th className="px-5 py-3 font-bold text-green-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-green-50/50 text-right">
                  Net Pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {monthlySummaryUpToCurrentMonth.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No combined data available yet.
                  </td>
                </tr>
              ) : (
                monthlySummaryUpToCurrentMonth.map((m) => (
                  <tr
                    key={m.month}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-bold text-gray-900 whitespace-nowrap">
                      {m.month}
                    </td>

                    {}
                    <td className="px-5 py-3 text-center text-gray-700 font-medium border-l border-gray-100 bg-blue-50/10">
                      {m.present}
                    </td>
                    <td className="px-5 py-3 text-center text-red-600 font-bold bg-blue-50/10">
                      {m.absent}
                    </td>
                    <td className="px-5 py-3 text-center text-orange-500 font-bold bg-blue-50/10">
                      {m.late}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-700 font-medium bg-blue-50/10">
                      {m.onLeave}
                    </td>

                    {}
                    <td className="px-5 py-3 text-right text-green-600 font-medium border-l border-gray-100 bg-green-50/10">
                      +{fmt(m.totalIncentives)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-800 font-bold bg-green-50/10">
                      {fmt(m.totalGross)}
                    </td>
                    <td className="px-5 py-3 text-right text-red-600 font-bold bg-red-50/10">
                      -{fmt(m.totalDeductions)}
                    </td>
                    <td className="px-5 py-3 text-right text-purple-700 font-black bg-green-50/10">
                      {fmt(m.totalNet)}
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
