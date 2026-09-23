import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
import axiosInterceptor from "@/hooks/interceptor";
import { User } from "lucide-react";

const designationMap = {
  Operations: [
    "Supervisor(Finance & Operations)",
    "Assistant Finance & Operations Partner",
    "Admin & Human Resources Partner",
  ],
  "Health Program Partners": [
    "Supervisor(Health Program Partner)",
    "Health Program Partner",
    "Profiler",
  ],
  "Platform Innovation": [
    "Supervisor(Platform Innovation)",
    "Senior Platform Innovation Partner",
    "Platform Innovation Partner",
    "Data Analyst",
    "Business Analyst/Quality Assurance",
  ],
  "Network & System": [
    "Supervisor(Network & Systems)",
    "Network & Systems Partner",
  ],
};

export default function Employees({ shortcutMode = false }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = JSON.parse(localStorage.getItem("wah_user") || "{}");
  const canResetPassword = currentUser?.role === "Admin";
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDesignation, setFilterDesignation] = useState("All");
  const [activeMenu, setActiveMenu] = useState(null); // For Ellipsis

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [resetConfirm, setResetConfirm] = useState(null);
  const [addConfirm, setAddConfirm] = useState(null);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  const { toast, showToast, clearToast } = useToast();

  const [formData, setFormData] = useState({
    emp_id: "",
    first_name: "",
    middle_initial: "",
    last_name: "",
    designation: "",
    position: "",
    status: "Permanent",
    email: "",
    philhealth_no: "",
    tin: "",
    sss_no: "",
    pag_ibig_mid_no: "",
    pag_ibig_rtn: "",
    gsis_no: "",
    dob: "",
    hired_date: "",
  });

  useEffect(() => {
    if (shortcutMode) {
      setIsAddModalOpen(true);
      return;
    }

    if (searchParams.get("open") !== "add-employee") return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("open");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, shortcutMode]);

  // --- QUERIES ---
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees");
      return res.json();
    },
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // --- MUTATIONS ---
  const addMutation = useMutation({
    mutationFn: (newData) => {
      // Auto Password Logic: ID + FirstName (No spaces)
      const autoPassword = `${newData.emp_id}${newData.first_name.replace(/\s+/g, "")}`;
      return axiosInterceptor.post("/api/employees/add", {
        ...newData,
        password: autoPassword,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["employees"]);
      setIsAddModalOpen(false);
      resetForm();
      showToast("Employee added successfully.");
    },
    onError: (e) => showToast("Failed to add employee. ", e.message, "error"),
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedData) => {
      const res = await apiFetch(`/api/employees/${updatedData.emp_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update employee");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["employees"]);
      setEditEmployee(null);
      showToast("Employee updated successfully.");
    },
    onError: (error) => {
      showToast(error.message || "Update failed", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiFetch(`/api/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries(["employees"]);
      setDeleteConfirm(null);
      showToast("Employee deleted successfully.");
    },
    onError: () => showToast("Failed to delete employee.", "error"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (emp) => {
      const res = await apiFetch(
        `/api/employees/${emp.emp_id}/reset-password`,
        {
          method: "PUT",
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      return { ...data, emp };
    },
    onSuccess: ({ autoPassword, emp }) => {
      setResetConfirm(null);
      showToast(
        `Password reset for ${emp.first_name} ${emp.last_name}: ${autoPassword}`,
      );
    },
    onError: (error) => {
      showToast(error.message || "Password reset failed", "error");
    },
  });

  // --- HANDLERS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "middle_initial") {
      setFormData({
        ...formData,
        middle_initial: value.slice(0, 1).toUpperCase(),
      });
      return;
    }

    if (name === "designation") {
      setFormData({ ...formData, designation: value, position: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const resetForm = () =>
    setFormData({
      emp_id: "",
      first_name: "",
      middle_initial: "",
      last_name: "",
      designation: "",
      position: "",
      status: "Permanent",
      email: "",
      philhealth_no: "",
      tin: "",
      sss_no: "",
      pag_ibig_mid_no: "",
      pag_ibig_rtn: "",
      gsis_no: "",
      dob: "",
      hired_date: "",
    });

  const filteredEmployees = employees.filter((emp) => {
    // 1. Hide Admin accounts from the table completely
    if (emp.role === "Admin") {
      return false;
    }

    // 2. Existing filter logic
    const fullName =
      `${emp.first_name} ${emp.last_name} ${emp.emp_id}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "All" || emp.status === filterStatus;
    const matchesDesignation =
      filterDesignation === "All" || emp.designation === filterDesignation;

    return matchesSearch && matchesStatus && matchesDesignation;
  });

  if (isLoading)
    return <div className="p-6 font-bold">Loading Employees...</div>;

  return (
    <div className="max-w-full">
      {!shortcutMode && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Employee Management
            </h1>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              + Add Employee
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <input
              type="text"
              placeholder="Search ID or Name..."
              className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              value={filterDesignation}
              onChange={(e) => setFilterDesignation(e.target.value)}
            >
              <option value="All">All Designations</option>
              {Object.keys(designationMap).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Permanent">Permanent</option>
              <option value="Job Order">Job Order</option>
              <option value="Casual">Casual</option>
              <option value="PGT Employee">PGT Employee</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-bold text-gray-700">ID</th>
                  <th className="px-6 py-3 font-bold text-gray-700">
                    Full Name
                  </th>
                  <th className="px-6 py-3 font-bold text-gray-700">
                    Designation / Position
                  </th>
                  <th className="px-6 py-3 font-bold text-gray-700">
                    Email Address
                  </th>
                  <th className="px-6 py-3 font-bold text-gray-700">Status</th>
                  <th className="px-6 py-3 font-bold text-gray-700 text-center w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.emp_id}
                    onClick={() => setSelectedEmployeeDetails(emp)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium">{emp.emp_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* The Circular Profile Picture */}
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                          {emp.profile_photo ? (
                            <img
                              src={`${API_BASE_URL}/${emp.profile_photo.replace(/^\/+/, "")}`}
                              alt="Profile"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-gray-400" />
                          )}
                        </div>

                        {/* The Name */}
                        <div className="font-semibold text-gray-800">
                          {emp.last_name}, {emp.first_name}{" "}
                          {emp.middle_initial ? `${emp.middle_initial}.` : ""}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="font-medium text-gray-900">
                        {emp.designation}
                      </div>
                      <div className="text-xs opacity-75">{emp.position}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{emp.email}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                        {emp.status}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-center relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setActiveMenu(
                            activeMenu === emp.emp_id ? null : emp.emp_id,
                          )
                        }
                        className="p-1 rounded-full hover:bg-gray-200 transition-colors border-0 bg-transparent cursor-pointer text-gray-500"
                      >
                        <svg
                          width="20"
                          height="20"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                        </svg>
                      </button>

                      {/* Action Menu Dropdown */}
                      {activeMenu === emp.emp_id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveMenu(null)}
                          ></div>
                          <div className="absolute right-12 top-4 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in duration-100">
                            <button
                              onClick={() => {
                                setEditEmployee(emp);
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 border-0 bg-transparent cursor-pointer font-medium"
                            >
                              Edit Info
                            </button>
                            {canResetPassword && (
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  setResetConfirm(emp);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 border-0 bg-transparent cursor-pointer font-medium disabled:opacity-50"
                              >
                                Reset Password
                              </button>
                            )}
                            <hr className="my-1 border-gray-100" />
                            <button
                              onClick={() => {
                                setDeleteConfirm(emp);
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-0 bg-transparent cursor-pointer font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modals same as before but updated with logic */}
      {isAddModalOpen && !addConfirm && (
        <EmployeeModal
          title="Add New Employee"
          data={formData}
          onChange={handleInputChange}
          onClose={() => {
            setIsAddModalOpen(false);
            resetForm();
          }}
          onSubmit={(e) => {
            e.preventDefault();
            setAddConfirm(formData);
          }}
          isPending={addMutation.isPending}
        />
      )}

      {editEmployee && (
        <EmployeeModal
          title="Edit Employee Information"
          data={editEmployee}
          isEdit={true}
          onChange={(e) => {
            const { name, value } = e.target;
            if (name === "middle_initial") {
              setEditEmployee({
                ...editEmployee,
                middle_initial: value.slice(0, 1).toUpperCase(),
              });
              return;
            }

            if (name === "designation") {
              setEditEmployee({
                ...editEmployee,
                designation: value,
                position: "",
              });
              return;
            }

            setEditEmployee({
              ...editEmployee,
              [name]: value,
            });
          }}
          onClose={() => setEditEmployee(null)}
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(editEmployee);
          }}
          isPending={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation remains unchanged */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <h2 className="text-xl font-bold mb-2">Are you sure?</h2>
            <p className="text-gray-600 mb-6">
              You are about to delete{" "}
              <b>
                {deleteConfirm.first_name} {deleteConfirm.last_name}
              </b>
              .
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.emp_id)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🔐
            </div>
            <h2 className="text-xl font-bold mb-2">Reset Password?</h2>
            <p className="text-gray-600 mb-6">
              Reset password for{" "}
              <b>
                {resetConfirm.first_name} {resetConfirm.last_name}
              </b>
              ?
            </p>
            <div className="text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg p-2 mb-5">
              New password format: Employee ID + First Name
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirm(null)}
                disabled={resetPasswordMutation.isPending}
                className="flex-1 py-2 border border-gray-300 rounded-lg font-semibold text-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => resetPasswordMutation.mutate(resetConfirm)}
                disabled={resetPasswordMutation.isPending}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Confirmation */}
      {addConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl my-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-3">Confirm Add Employee</h2>
              <p className="text-gray-600 text-base">
                Please review and confirm the following employee information:
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-3 mb-8 max-h-96 overflow-y-auto text-base">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">
                  Employee ID:
                </span>
                <span className="font-mono">{addConfirm.emp_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">Name:</span>
                <span>
                  {addConfirm.first_name}{" "}
                  {addConfirm.middle_initial
                    ? `${addConfirm.middle_initial}.`
                    : ""}{" "}
                  {addConfirm.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">Email:</span>
                <span>{addConfirm.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">
                  Designation:
                </span>
                <span>{addConfirm.designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">Position:</span>
                <span>{addConfirm.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">Status:</span>
                <span>{addConfirm.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">Hired Date:</span>
                <span>
                  {addConfirm.hired_date
                    ? new Date(addConfirm.hired_date).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">
                  PHILHEALTH No.:
                </span>
                <span>{addConfirm.philhealth_no || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">TIN:</span>
                <span>{addConfirm.tin || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">SSS No.:</span>
                <span>{addConfirm.sss_no || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">
                  PAG-IBIG MID No.:
                </span>
                <span>{addConfirm.pag_ibig_mid_no || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">
                  PAG-IBIG RTN:
                </span>
                <span>{addConfirm.pag_ibig_rtn || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">GSIS No.:</span>
                <span>{addConfirm.gsis_no || "N/A"}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">
                    Auto-Password:
                  </span>
                  <span className="font-mono text-purple-600 font-semibold">
                    {addConfirm.emp_id}
                    {addConfirm.first_name.replace(/\s+/g, "")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setAddConfirm(null);
                  setIsAddModalOpen(true);
                }}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-semibold text-gray-600 hover:bg-gray-50 text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAddConfirm(null);
                  addMutation.mutate(formData);
                }}
                disabled={addMutation.isPending}
                className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 text-base"
              >
                {addMutation.isPending ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEmployeeDetails && (
        <EmployeeDetailsModal
          employee={selectedEmployeeDetails}
          onClose={() => setSelectedEmployeeDetails(null)}
        />
      )}

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}

function EmployeeDetailsModal({ employee, onClose }) {
  const details = [
    { label: "PHILHEALTH No.", value: employee.philhealth_no },
    { label: "TIN", value: employee.tin },
    { label: "SSS No.", value: employee.sss_no },
    { label: "PAG-IBIG MID No.", value: employee.pag_ibig_mid_no },
    { label: "PAG_IBIG RTN", value: employee.pag_ibig_rtn },
    { label: "GSIS No.", value: employee.gsis_no },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="m-0 text-xl font-bold text-gray-900">
              Employee Details
            </h2>
            <p className="m-0 mt-1 text-sm text-gray-600">
              {employee.last_name}, {employee.first_name}{" "}
              {employee.middle_initial ? `${employee.middle_initial}.` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 text-2xl bg-transparent border-0 cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {details.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 border-b border-gray-200 pb-2 last:border-b-0 last:pb-0"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {item.label}
              </span>
              <span className="text-sm font-semibold text-gray-800 text-right">
                {item.value || "N/A"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeModal({
  title,
  data,
  onChange,
  onClose,
  onSubmit,
  isPending,
  isEdit = false,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-4 py-2.5 bg-gray-900 flex justify-between items-center text-white">
          <h2 className="text-base font-bold m-0">{title}</h2>
          <button
            onClick={onClose}
            className="text-white text-2xl bg-transparent border-0 cursor-pointer"
          >
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-3.5 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Employee ID
              </label>
              <input
                name="emp_id"
                value={data.emp_id}
                onChange={onChange}
                disabled={isEdit}
                required
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                value={data.email}
                onChange={onChange}
                required
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="flex flex-col gap-0.5 col-span-2">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="col-span-1 flex flex-col gap-0.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    First Name
                  </label>
                  <input
                    name="first_name"
                    value={data.first_name}
                    onChange={onChange}
                    required
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="col-span-1 flex flex-col gap-0.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    M.I.
                  </label>
                  <input
                    name="middle_initial"
                    value={data.middle_initial || ""}
                    onChange={onChange}
                    maxLength="1"
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="col-span-1 flex flex-col gap-0.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Last Name
                  </label>
                  <input
                    name="last_name"
                    value={data.last_name}
                    onChange={onChange}
                    required
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Designation
              </label>
              <select
                name="designation"
                value={data.designation}
                onChange={onChange}
                required
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="">Select Designation</option>
                {Object.keys(designationMap).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Position
              </label>
              <select
                name="position"
                value={data.position}
                onChange={onChange}
                required
                disabled={!data.designation}
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-50"
              >
                <option value="">Select Position</option>
                {data.designation &&
                  designationMap[data.designation].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Emp. Status
              </label>
              <select
                name="status"
                value={data.status}
                onChange={onChange}
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option>Permanent</option>
                <option>Job Order</option>
                <option>Casual</option>
                <option>PGT Employee</option>
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Hired Date
              </label>
              <input
                name="hired_date"
                type="date"
                value={data.hired_date?.split("T")[0]}
                onChange={onChange}
                required
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="flex flex-col gap-0.5 col-span-2 mt-0.5">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Government Details
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">
                    PHILHEALTH No.
                  </label>
                  <input
                    name="philhealth_no"
                    value={data.philhealth_no || ""}
                    onChange={onChange}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">
                    TIN
                  </label>
                  <input
                    name="tin"
                    value={data.tin || ""}
                    onChange={onChange}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">
                    SSS No.
                  </label>
                  <input
                    name="sss_no"
                    value={data.sss_no || ""}
                    onChange={onChange}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">
                    PAG-IBIG MID No.
                  </label>
                  <input
                    name="pag_ibig_mid_no"
                    value={data.pag_ibig_mid_no || ""}
                    onChange={onChange}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">
                    PAG-IBIG RTN
                  </label>
                  <input
                    name="pag_ibig_rtn"
                    value={data.pag_ibig_rtn || ""}
                    onChange={onChange}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">
                    GSIS No.
                  </label>
                  <input
                    name="gsis_no"
                    value={data.gsis_no || ""}
                    onChange={onChange}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {!isEdit && (
            <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 p-2.5">
              <p className="m-0 text-xs text-purple-700 font-semibold">
                Auto-generated Password:{" "}
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-purple-200">
                  {data.emp_id}
                  {data.first_name.replace(/\s+/g, "") || "[FirstName]"}
                </span>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white"
            >
              {isPending
                ? "Processing..."
                : isEdit
                  ? "Update Employee"
                  : "Save Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
