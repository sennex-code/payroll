import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

export default function SalaryHistory() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const typeColors = {
    Increase: { bg: "bg-green-100", text: "text-green-800", icon: "📈" },
    Decrease: { bg: "bg-red-100", text: "text-red-800", icon: "📉" },
    Bonus: { bg: "bg-blue-100", text: "text-blue-800", icon: "🎁" },
  };

  // 1. Fetch the list of employees on mount for the dropdown
  useEffect(() => {
    apiFetch("/api/employees")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEmployees(data);
          // Default selection to the first employee
          if (data.length > 0) setSelectedEmployee(data[0].emp_id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching employees:", err);
        setLoading(false);
      });
  }, []);

  // 2. Fetch salary history whenever the selected employee changes
  useEffect(() => {
    if (!selectedEmployee) return;

    apiFetch(`/api/employees/salary-history/${selectedEmployee}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSalaryRecords(data);
        } else {
          setSalaryRecords([]);
        }
      })
      .catch((err) => console.error("Error fetching salary records:", err));
  }, [selectedEmployee]);

  // Calculation helpers (using Number() to handle MySQL DECIMAL strings)
  const getTotalChange = () => {
    return salaryRecords.reduce((sum, record) => {
      const amt = Number(record.amount);
      return sum + (record.type === "Decrease" ? -amt : amt);
    }, 0);
  };

  const getTotalIncreases = () => {
    return salaryRecords
      .filter((r) => r.type === "Increase")
      .reduce((sum, r) => sum + Number(r.amount), 0);
  };

  const getIncreaseCount = () => {
    return salaryRecords.filter((r) => r.type === "Increase").length;
  };

  // The latest record is at index 0 because of our ORDER BY DESC SQL query
  const currentSalary =
    salaryRecords.length > 0 ? Number(salaryRecords[0].new_salary) : 0;

  if (loading)
    return (
      <div className="p-6 text-white font-bold">Loading Salary History...</div>
    );

  return (
    <div className="max-w-full">
      <h1 className="m-0 text-[1.4rem] font-bold text-gray-900 mb-6">
        Salary History
      </h1>

      {/* Employee Selector */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white shadow-sm p-6">
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Select Employee
        </label>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-base text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-purple-600 focus:border-transparent"
        >
          {employees.map((emp) => (
            <option key={emp.emp_id} value={emp.emp_id}>
              {emp.emp_id} - {emp.first_name} {emp.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border-l-4 border-l-blue-500 border border-gray-200 bg-white shadow-sm p-6">
          <p className="m-0 text-sm font-medium text-gray-600 mb-2">
            Current Salary
          </p>
          <p className="m-0 text-3xl font-bold text-blue-600">
            ₱
            {currentSalary.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="m-0 text-xs text-gray-500 mt-2">As of Latest Record</p>
        </div>

        <div className="rounded-lg border-l-4 border-l-green-500 border border-gray-200 bg-white shadow-sm p-6">
          <p className="m-0 text-sm font-medium text-gray-600 mb-2">
            Total Increases
          </p>
          <p className="m-0 text-3xl font-bold text-green-600">
            +₱{getTotalIncreases().toLocaleString()}
          </p>
          <p className="m-0 text-xs text-gray-500 mt-2">
            {getIncreaseCount()} adjustments
          </p>
        </div>

        <div
          className={`rounded-lg border-l-4 ${getTotalChange() >= 0 ? "border-l-green-500" : "border-l-red-500"} border border-gray-200 bg-white shadow-sm p-6`}
        >
          <p className="m-0 text-sm font-medium text-gray-600 mb-2">
            Net Change
          </p>
          <p
            className={`m-0 text-3xl font-bold ${getTotalChange() >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {getTotalChange() >= 0 ? "+" : ""}₱
            {getTotalChange().toLocaleString()}
          </p>
          <p className="m-0 text-xs text-gray-500 mt-2">From all adjustments</p>
        </div>
      </div>

      {/* Timeline Table */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="m-0 text-lg font-semibold text-gray-900">
            Salary Adjustment History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-right">
                  Amount
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-right">
                  New Salary
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {salaryRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No salary history records found for this employee.
                  </td>
                </tr>
              ) : (
                salaryRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-3 text-gray-900">
                      {new Date(record.effective_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${typeColors[record.type]?.bg} ${typeColors[record.type]?.text}`}
                      >
                        {typeColors[record.type]?.icon} {record.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-700">
                      {record.description}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold">
                      <span
                        className={
                          record.type === "Decrease"
                            ? "text-red-600"
                            : "text-green-600"
                        }
                      >
                        {record.type === "Decrease" ? "-" : "+"}₱
                        {Number(record.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-gray-900">
                      ₱
                      {Number(record.new_salary).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {record.remarks}
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
