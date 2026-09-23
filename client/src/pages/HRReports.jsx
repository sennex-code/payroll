import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { User } from "lucide-react";
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

export default function HRReports() {
  const [reportType, setReportType] = useState("leave");
  const [dateRange, setDateRange] = useState("month");

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const {
    data: dynamicData = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["hr-reports", reportType, dateRange],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/hr-reports?type=${reportType}&range=${dateRange}`,
      );
      if (!res.ok) throw new Error("Failed to fetch HR reports");

      const rawData = await res.json();

      return rawData.map((item) => {
        const cleaned = { ...item };
        if (cleaned.days != null)
          cleaned.days = Math.round(Number(cleaned.days));
        if (cleaned.leaveBalance != null)
          cleaned.leaveBalance = Math.round(Number(cleaned.leaveBalance));
        if (cleaned.offsetCredits != null)
          cleaned.offsetCredits = Math.round(Number(cleaned.offsetCredits));
        return cleaned;
      });
    },
  });

  const kpis = useMemo(() => {
    if (reportType === "leave") {
      const total = dynamicData.length;
      const pending = dynamicData.filter((d) => d.status === "Pending").length;
      const approved = dynamicData.filter(
        (d) => d.status === "Approved",
      ).length;
      const denied = dynamicData.filter((d) => d.status === "Denied").length;
      return [
        {
          label: "Total Requests",
          value: total,
          color: "border-purple-600",
          text: "text-purple-700",
        },
        {
          label: "Approved",
          value: approved,
          color: "border-green-500",
          text: "text-green-600",
        },
        {
          label: "Pending",
          value: pending,
          color: "border-yellow-500",
          text: "text-yellow-600",
        },
        {
          label: "Denied",
          value: denied,
          color: "border-red-500",
          text: "text-red-600",
        },
      ];
    } else if (reportType === "attendance") {
      const days = dynamicData.length;
      const avgPresent = days
        ? Math.round(
            dynamicData.reduce((acc, d) => acc + Number(d.present), 0) / days,
          )
        : 0;
      const avgAbsent = days
        ? Math.round(
            dynamicData.reduce((acc, d) => acc + Number(d.absent), 0) / days,
          )
        : 0;
      const avgLate = days
        ? Math.round(
            dynamicData.reduce((acc, d) => acc + Number(d.late), 0) / days,
          )
        : 0;
      return [
        {
          label: "Days Tracked",
          value: days,
          color: "border-purple-600",
          text: "text-purple-700",
        },
        {
          label: "Avg Present/Day",
          value: avgPresent,
          color: "border-green-500",
          text: "text-green-600",
        },
        {
          label: "Avg Absent/Day",
          value: avgAbsent,
          color: "border-red-500",
          text: "text-red-600",
        },
        {
          label: "Avg Late/Day",
          value: avgLate,
          color: "border-orange-500",
          text: "text-orange-600",
        },
      ];
    } else {
      const totalEmps = dynamicData.length;

      const totalLeaveBal = Math.round(
        dynamicData.reduce((acc, d) => acc + Number(d.leaveBalance), 0),
      );
      const totalOffset = Math.round(
        dynamicData.reduce((acc, d) => acc + Number(d.offsetCredits), 0),
      );
      return [
        {
          label: "Tracked Employees",
          value: totalEmps,
          color: "border-purple-600",
          text: "text-purple-700",
        },
        {
          label: "Total Leave Credits",
          value: totalLeaveBal,
          color: "border-green-500",
          text: "text-green-600",
        },
        {
          label: "Total Offset Credits",
          value: totalOffset,
          color: "border-blue-500",
          text: "text-blue-600",
        },
        {
          label: "System Status",
          value: "Active",
          color: "border-gray-500",
          text: "text-gray-700",
        },
      ];
    }
  }, [dynamicData, reportType]);

  const exportCSV = () => {
    if (!dynamicData || dynamicData.length === 0) return;
    let csvContent = "";

    if (reportType === "leave") {
      csvContent = "Employee,Leave Type,Days,From,To,Status\n";
      dynamicData.forEach(
        (r) =>
          (csvContent += `"${r.employee}","${r.leaveType}",${r.days},${r.dateFrom},${r.dateTo},${r.status}\n`),
      );
    } else if (reportType === "attendance") {
      csvContent = "Date,Present,Absent,On Leave,Late\n";
      dynamicData.forEach(
        (r) =>
          (csvContent += `${r.date},${r.present},${r.absent},${r.onLeave},${r.late}\n`),
      );
    } else {
      csvContent = "Employee,Leave Balance,Offset Credits\n";
      dynamicData.forEach(
        (r) =>
          (csvContent += `"${r.employee}",${r.leaveBalance},${r.offsetCredits}\n`),
      );
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `HR_${reportType}_Report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const statusColors = {
    Approved: "bg-green-100 text-green-800",
    Denied: "bg-red-100 text-red-800",
    Pending: "bg-yellow-100 text-yellow-800",
  };

  const chartData =
    reportType === "attendance" ? [...dynamicData].reverse() : dynamicData;

  if (isLoading)
    return (
      <div className="p-6 font-bold text-gray-700">Loading HR Reports...</div>
    );
  if (isError)
    return (
      <div className="p-6 font-bold text-red-600">
        Failed to load reports data.
      </div>
    );

  return (
    <div className="max-w-full space-y-6">
      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="m-0 text-[1.4rem] font-bold text-gray-900">
          Human Resources Reports
        </h1>
        <button
          onClick={exportCSV}
          disabled={dynamicData.length === 0}
          className="px-5 py-2.5 rounded-lg border-0 text-white text-sm font-semibold cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:opacity-90 disabled:opacity-50 shadow-sm"
        >
          ⬇ Export CSV
        </button>
      </div>

      {}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="leave">Leave Applications</option>
              <option value="attendance">Attendance Summary</option>
              <option value="balance">Leave Balances</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              disabled={reportType === "balance"}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-xl p-4 flex flex-col gap-1 border-t-4 shadow-sm ${kpi.color}`}
          >
            <span className={`text-2xl font-bold ${kpi.text}`}>
              {kpi.value}
            </span>
            <span className="text-[0.80rem] font-medium uppercase text-gray-500 tracking-wider">
              {kpi.label}
            </span>
          </div>
        ))}
      </div>

      {}
      {dynamicData.length > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h3 className="m-0 mb-4 text-base font-bold text-gray-800">
            {reportType === "leave" && "Leave Days Requested"}
            {reportType === "attendance" && "Daily Attendance Trends"}
            {reportType === "balance" && "Leave Credits Distribution"}
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {reportType === "attendance" ? (
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
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
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
                    dataKey="present"
                    name="Present"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="absent"
                    name="Absent"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="late"
                    name="Late"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              ) : (
                <BarChart
                  data={dynamicData.slice(0, 15)}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis
                    dataKey="employee"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                  {reportType === "leave" && (
                    <Bar
                      dataKey="days"
                      name="Days Requested"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {reportType === "balance" && (
                    <>
                      <Bar
                        dataKey="leaveBalance"
                        name="Leave Balance"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="offsetCredits"
                        name="Offset Credits"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                    </>
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="m-0 text-base font-bold text-gray-900">
            Detailed Report Data
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white text-sm text-left">
            <thead>
              {reportType === "leave" && (
                <tr>
                  <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50">
                    Employee
                  </th>
                  <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50 text-center">
                    Leave Type
                  </th>
                  <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50 text-center">
                    Days
                  </th>
                  <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50 text-center">
                    From - To
                  </th>
                  <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50 text-center">
                    Status
                  </th>
                </tr>
              )}
              {reportType === "attendance" && (
                <tr>
                  <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50">
                    Date
                  </th>
                  <th className="px-5 py-3 font-bold text-green-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-green-50/50 text-center border-l">
                    Present
                  </th>
                  <th className="px-5 py-3 font-bold text-red-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-red-50/50 text-center">
                    Absent
                  </th>
                  <th className="px-5 py-3 font-bold text-yellow-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-yellow-50/50 text-center">
                    On Leave
                  </th>
                  <th className="px-5 py-3 font-bold text-orange-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-orange-50/50 text-center">
                    Late
                  </th>
                </tr>
              )}
              {reportType === "balance" && (
                <tr>
                  <th className="px-5 py-3 font-bold text-gray-600 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-gray-50">
                    Employee
                  </th>
                  <th className="px-5 py-3 font-bold text-green-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-green-50/50 text-center border-l">
                    Leave Balance
                  </th>
                  <th className="px-5 py-3 font-bold text-blue-700 uppercase tracking-wider text-[10px] border-b border-gray-200 bg-blue-50/50 text-center">
                    Offset Credits
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dynamicData.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No data available for the selected parameters.
                  </td>
                </tr>
              ) : (
                dynamicData.map((report, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    {}
                    {reportType === "leave" && (
                      <>
                        <td className="px-5 py-3 font-bold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                              {report.profilePhoto ? (
                                <img
                                  src={`${API_BASE_URL}/${report.profilePhoto.replace(/^\/+/, "")}`}
                                  alt="Profile"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <span>{report.employee}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center text-gray-700 font-medium">
                          {report.leaveType}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-800 font-bold">
                          {report.days}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600 text-xs">
                          {report.dateFrom} <br /> {report.dateTo}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColors[report.status] || "bg-gray-100 text-gray-800"}`}
                          >
                            {report.status}
                          </span>
                        </td>
                      </>
                    )}

                    {}
                    {reportType === "attendance" && (
                      <>
                        <td className="px-5 py-3 font-bold text-gray-900 whitespace-nowrap">
                          {report.date}
                        </td>
                        <td className="px-5 py-3 text-center text-green-700 font-bold border-l border-gray-100 bg-green-50/10">
                          {report.present}
                        </td>
                        <td className="px-5 py-3 text-center text-red-700 font-bold bg-red-50/10">
                          {report.absent}
                        </td>
                        <td className="px-5 py-3 text-center text-yellow-700 font-bold bg-yellow-50/10">
                          {report.onLeave}
                        </td>
                        <td className="px-5 py-3 text-center text-orange-700 font-bold bg-orange-50/10">
                          {report.late}
                        </td>
                      </>
                    )}

                    {}
                    {reportType === "balance" && (
                      <>
                        <td className="px-5 py-3 font-bold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                              {report.profilePhoto ? (
                                <img
                                  src={`${API_BASE_URL}/${report.profilePhoto.replace(/^\/+/, "")}`}
                                  alt="Profile"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <span>{report.employee}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center text-green-700 font-bold border-l border-gray-100 bg-green-50/10">
                          {report.leaveBalance}
                        </td>
                        <td className="px-5 py-3 text-center text-blue-700 font-bold bg-blue-50/10">
                          {report.offsetCredits}
                        </td>
                      </>
                    )}
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
