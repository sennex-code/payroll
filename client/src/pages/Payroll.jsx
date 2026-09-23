import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
import { User, Mail } from "lucide-react"; // <-- ADDED Mail Icon

// --- OFFICIAL DESIGNATIONS & POSITIONS ---
const DESIGNATIONS = {
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

const DEFAULT_DEDUCTION_TYPES = [
  "CAP",
  "SSS Loan",
  "Pag-IBIG Loan",
  "Cash Advance",
  "Others",
];

const DEFAULT_INCENTIVE_TYPES = [
  "Performance",
  "Attendance",
  "Project",
  "Others",
];

const toUiAdjustmentCategory = (rawType) => {
  const normalized = String(rawType || "")
    .trim()
    .toLowerCase();

  if (["decrease", "deduction", "deductions"].includes(normalized)) {
    return "Decrease";
  }

  return "Incentive";
};

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

const fmtSigned = (n) => {
  const num = Number(n || 0);
  if (isNaN(num)) return "+₱0.00";
  return `${num >= 0 ? "+" : "-"}${fmt(Math.abs(num))}`;
};

const sanitizeMoneyInput = (value) => {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");

  if (parts.length === 1) return parts[0];

  const integerPart = parts[0];
  const decimalPart = parts.slice(1).join("").slice(0, 2);
  return `${integerPart}.${decimalPart}`;
};

const formatMoneyOnBlur = (value) => {
  const sanitized = sanitizeMoneyInput(value);
  if (!sanitized) return "";
  const num = Number(sanitized);
  if (Number.isNaN(num)) return "";
  return num.toFixed(2);
};

const getMonthsInRange = (startPeriod, endPeriod) => {
  if (!/^\d{4}-\d{2}$/.test(String(startPeriod || ""))) return [];
  if (!/^\d{4}-\d{2}$/.test(String(endPeriod || ""))) return [];

  const [startYear, startMonth] = startPeriod.split("-").map(Number);
  const [endYear, endMonth] = endPeriod.split("-").map(Number);

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth - 1, 1);
  if (start > end) return [];

  const months = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
};

const getCurrentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function Payroll({ shortcutMode = false }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, showToast, clearToast } = useToast();
  const [period, setPeriod] = useState(getCurrentPeriod);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("wah_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isAdmin = currentUser?.role === "Admin";

  // Modal & Form States
  const [adjustmentModal, setAdjustmentModal] = useState(null);
  const [salarySettingsModal, setSalarySettingsModal] = useState(false);
  const [confirmSalarySettingsModal, setConfirmSalarySettingsModal] =
    useState(false);
  const [salaryBreakdownModal, setSalaryBreakdownModal] = useState(null);
  const [resetConfirmModal, setResetConfirmModal] = useState(false);
  const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);

  const [adjustmentType, setAdjustmentType] = useState("Incentive");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentLineItems, setAdjustmentLineItems] = useState([]);
  const [deductionTypes, setDeductionTypes] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("wah_deduction_types") || "[]",
      );
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
    } catch {
      // Ignore malformed local storage values.
    }
    return DEFAULT_DEDUCTION_TYPES;
  });
  const [selectedDeductionType, setSelectedDeductionType] = useState(
    DEFAULT_DEDUCTION_TYPES[0],
  );
  const [newDeductionType, setNewDeductionType] = useState("");
  const [incentiveTypes, setIncentiveTypes] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("wah_incentive_types") || "[]",
      );
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
    } catch {
      // Ignore malformed local storage values.
    }
    return DEFAULT_INCENTIVE_TYPES;
  });
  const [selectedIncentiveType, setSelectedIncentiveType] = useState(
    DEFAULT_INCENTIVE_TYPES[0],
  );
  const [newIncentiveType, setNewIncentiveType] = useState("");
  const [applyToOtherMonth, setApplyToOtherMonth] = useState(false);
  const [adjustmentTargetPeriod, setAdjustmentTargetPeriod] = useState(period);
  const [applyByRange, setApplyByRange] = useState(false);
  const [adjustmentRangeStart, setAdjustmentRangeStart] = useState(period);
  const [adjustmentRangeEnd, setAdjustmentRangeEnd] = useState(period);
  const [selectedEmployees, setSelectedEmployees] = useState(new Set());
  const [bulkAdjustmentMode, setBulkAdjustmentMode] = useState(false);
  const [search, setSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("All");

  const [salaryForm, setSalaryForm] = useState({
    designation: "",
    position: "",
    amount: "",
  });

  const [positionSalaries, setPositionSalaries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("wah_position_salaries") || "{}");
    } catch {
      return {};
    }
  });

  // --- QUERIES ---
  const { data: payrollData = [], isLoading: isLoadingPayroll } = useQuery({
    queryKey: ["payroll", period],
    queryFn: async () => {
      const res = await apiFetch(`/api/employees/payroll?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch payroll");
      return res.json();
    },
  });

  const { data: employeesData = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const { data: salaryHistoryData = [] } = useQuery({
    queryKey: [
      "salary-history",
      adjustmentModal?.emp_id,
      applyToOtherMonth ? adjustmentTargetPeriod : period,
    ],
    enabled: Boolean(adjustmentModal?.emp_id),
    queryFn: async () => {
      const activePeriod = applyToOtherMonth ? adjustmentTargetPeriod : period;
      const res = await apiFetch(
        `/api/employees/salary-history/${adjustmentModal.emp_id}?period=${activePeriod}`,
      );
      if (!res.ok) throw new Error("Failed to fetch salary history");
      return res.json();
    },
  });

  // --- MUTATIONS ---

  // NEW: Individual Email Mutation
  const sendPayslipMutation = useMutation({
    mutationFn: async (emp_id) => {
      const res = await apiFetch(
        `/api/employees/payroll/${emp_id}/send-payslip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period }),
        },
      );
      if (!res.ok) throw new Error("Failed to send payslip");
      return res.json();
    },
    onSuccess: () => showToast("Payslip sent successfully!"),
    onError: () =>
      showToast("Failed to send payslip. Check server logs.", "error"),
  });

  const sendBulkPayslipsMutation = useMutation({
    mutationFn: async (selectedPeriod) => {
      const res = await apiFetch(`/api/employees/payroll/send-bulk-payslips`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ period: selectedPeriod }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to send bulk payslips");
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Using the period from the mutation argument or state
      showToast(
        `Success! All payslips for ${period} have been dispatched.`,
        "success",
      );
    },
    onError: (error) => {
      showToast(`Error: ${error.message}`, "error");
      console.error("Payroll Dispatch Error:", error);
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await apiFetch("/api/employees/salary-adjustment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save adjustments");
      return res.json();
    },
  });

  const updateHistoryEntryMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await apiFetch(
        `/api/employees/salary-history/${payload.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: payload.type,
            amount: payload.amount,
            description: payload.description,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to update adjustment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({
        queryKey: ["salary-history", adjustmentModal?.emp_id],
      });
      setEditingHistoryEntry(null);
      showToast("Adjustment updated successfully.");
    },
    onError: () => showToast("Failed to update adjustment.", "error"),
  });

  const deleteHistoryEntryMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiFetch(`/api/employees/salary-history/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove adjustment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({
        queryKey: ["salary-history", adjustmentModal?.emp_id],
      });
      showToast("Adjustment removed successfully.");
    },
    onError: () => showToast("Failed to remove adjustment.", "error"),
  });

  const updateBaseSalaryMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await apiFetch("/api/employees/update-base-salary", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update base salary");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });

      const updatedSalaries = {
        ...positionSalaries,
        [variables.position]: Number(variables.amount),
      };
      setPositionSalaries(updatedSalaries);
      localStorage.setItem(
        "wah_position_salaries",
        JSON.stringify(updatedSalaries),
      );

      showToast("Base salary updated for selected position.");
      setSalaryForm({ designation: "", position: "", amount: "" });
      setConfirmSalarySettingsModal(false);
      setSalarySettingsModal(false);
    },
    onError: () => showToast("Failed to update base salary.", "error"),
  });

  const generatePayrollMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/employees/generate-payroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) throw new Error("Failed to generate payroll");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (err) =>
      console.error(err.message || "Failed to generate payroll."),
  });

  const resetPayrollMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/employees/reset-payroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to reset payroll data");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      setResetConfirmModal(false);
      showToast("All payroll data has been reset successfully.");
    },
    onError: () => {
      showToast("Failed to reset payroll data.", "error");
    },
  });

  // Auto-generate payroll when period changes
  useEffect(() => {
    if (isAdmin) {
      generatePayrollMutation.mutate();
    }
  }, [period]);

  useEffect(() => {
    if (!shortcutMode && searchParams.get("open") !== "salary-settings") return;

    setSalarySettingsModal(true);

    if (shortcutMode) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("open");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, shortcutMode]);

  useEffect(() => {
    if (!Array.isArray(deductionTypes) || deductionTypes.length === 0) return;
    localStorage.setItem("wah_deduction_types", JSON.stringify(deductionTypes));
    if (!deductionTypes.includes(selectedDeductionType)) {
      setSelectedDeductionType(deductionTypes[0]);
    }
  }, [deductionTypes, selectedDeductionType]);

  useEffect(() => {
    if (!Array.isArray(incentiveTypes) || incentiveTypes.length === 0) return;
    localStorage.setItem("wah_incentive_types", JSON.stringify(incentiveTypes));
    if (!incentiveTypes.includes(selectedIncentiveType)) {
      setSelectedIncentiveType(incentiveTypes[0]);
    }
  }, [incentiveTypes, selectedIncentiveType]);

  // --- HANDLERS ---
  const getCurrentAdjustmentDescription = () =>
    adjustmentType === "Decrease"
      ? selectedDeductionType
      : selectedIncentiveType;

  const addCurrentAdjustmentLine = () => {
    const amountValue = Number(adjustmentAmount);
    if (!adjustmentAmount || Number.isNaN(amountValue) || amountValue <= 0) {
      showToast("Enter a valid amount greater than 0.", "error");
      return;
    }

    const descriptionValue = getCurrentAdjustmentDescription();
    if (!descriptionValue) {
      showToast("Select a type.", "error");
      return;
    }

    const nextLine = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: adjustmentType,
      description: descriptionValue,
      amount: Number(amountValue.toFixed(2)),
    };

    setAdjustmentLineItems((prev) => [...prev, nextLine]);
    setAdjustmentAmount("");
  };

  const removeAdjustmentLine = (lineId) => {
    setAdjustmentLineItems((prev) => prev.filter((line) => line.id !== lineId));
  };

  const handleAdjustment = async () => {
    const currentAmountValue = Number(adjustmentAmount);
    const currentDescription = getCurrentAdjustmentDescription();
    const hasCurrentDraft =
      !!adjustmentAmount &&
      !Number.isNaN(currentAmountValue) &&
      currentAmountValue > 0 &&
      !!currentDescription;

    const lineItems = [
      ...adjustmentLineItems,
      ...(hasCurrentDraft
        ? [
            {
              id: "draft",
              type: adjustmentType,
              description: currentDescription,
              amount: Number(currentAmountValue.toFixed(2)),
            },
          ]
        : []),
    ];

    if (lineItems.length === 0) {
      return showToast(
        "Add at least one adjustment line (incentive or deduction).",
        "error",
      );
    }

    if (adjustmentType === "Decrease" && !selectedDeductionType) {
      return showToast("Select a deduction type.", "error");
    }

    if (adjustmentType === "Incentive" && !selectedIncentiveType) {
      return showToast("Select an incentive type.", "error");
    }

    const targetPeriod = applyToOtherMonth ? adjustmentTargetPeriod : period;

    let targetPeriods = [targetPeriod];
    if (applyToOtherMonth && applyByRange) {
      targetPeriods = getMonthsInRange(
        adjustmentRangeStart,
        adjustmentRangeEnd,
      );
      if (targetPeriods.length === 0) {
        return showToast("Select a valid month range.", "error");
      }
    } else if (!/^\d{4}-\d{2}$/.test(String(targetPeriod || ""))) {
      return showToast("Select a valid target month.", "error");
    }

    const empIds = bulkAdjustmentMode
      ? Array.from(selectedEmployees)
      : [adjustmentModal.emp_id];
    if (empIds.length === 0)
      return showToast("No employees selected.", "error");

    try {
      for (const month of targetPeriods) {
        for (const line of lineItems) {
          await adjustmentMutation.mutateAsync({
            emp_ids: empIds,
            type: line.type,
            amount: line.amount,
            description: line.description,
            date: `${month}-01`,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({
        queryKey: ["salary-history", adjustmentModal?.emp_id],
      });

      if (targetPeriods.length > 1) {
        showToast(
          `Adjustments applied successfully across ${targetPeriods.length} months.`,
        );
      } else {
        showToast("Adjustments applied successfully.");
      }
      closeAdjustmentModal();
    } catch {
      showToast("Failed to apply adjustments.", "error");
    }
  };

  const handleBaseSalaryUpdate = (e) => {
    e.preventDefault();
    if (!salaryForm.position || !salaryForm.amount)
      return showToast("Fill in all fields.", "error");

    setConfirmSalarySettingsModal(true);
  };

  const confirmBaseSalaryUpdate = () => {
    updateBaseSalaryMutation.mutate({
      position: salaryForm.position,
      amount: salaryForm.amount,
    });
  };

  const closeAdjustmentModal = () => {
    setAdjustmentModal(null);
    setAdjustmentAmount("");
    setAdjustmentLineItems([]);
    setNewDeductionType("");
    setNewIncentiveType("");
    setApplyToOtherMonth(false);
    setAdjustmentTargetPeriod(period);
    setApplyByRange(false);
    setAdjustmentRangeStart(period);
    setAdjustmentRangeEnd(period);
    setAdjustmentType("Incentive");
    setEditingHistoryEntry(null);
    setSelectedEmployees(new Set());
  };

  const startEditHistoryEntry = (entry) => {
    const uiType = toUiAdjustmentCategory(entry.type);
    const fallbackType =
      uiType === "Decrease" ? deductionTypes[0] : incentiveTypes[0];

    setEditingHistoryEntry({
      id: entry.id,
      type: uiType,
      amount: Number(entry.amount || 0),
      description: entry.description || fallbackType || "",
    });
  };

  const saveEditHistoryEntry = () => {
    if (!editingHistoryEntry) return;

    if (
      !editingHistoryEntry.amount ||
      Number(editingHistoryEntry.amount) <= 0
    ) {
      showToast("Amount must be greater than 0.", "error");
      return;
    }

    const fallbackType =
      editingHistoryEntry.type === "Decrease"
        ? deductionTypes[0]
        : incentiveTypes[0];
    const selectedType =
      String(editingHistoryEntry.description || "").trim() || fallbackType;

    if (!selectedType) {
      showToast("Select a type.", "error");
      return;
    }

    updateHistoryEntryMutation.mutate({
      id: editingHistoryEntry.id,
      type: editingHistoryEntry.type,
      amount: Number(editingHistoryEntry.amount),
      description: selectedType,
    });
  };

  const removeHistoryEntry = (id) => {
    if (!window.confirm("Remove this adjustment entry?")) return;
    deleteHistoryEntryMutation.mutate(id);
  };

  const addDeductionType = () => {
    const value = newDeductionType.trim();
    if (!value) return;

    const exists = deductionTypes.some(
      (item) => item.toLowerCase() === value.toLowerCase(),
    );

    if (exists) {
      setSelectedDeductionType(
        deductionTypes.find(
          (item) => item.toLowerCase() === value.toLowerCase(),
        ) || value,
      );
      setNewDeductionType("");
      return;
    }

    const updated = [...deductionTypes, value].sort((a, b) =>
      a.localeCompare(b),
    );
    setDeductionTypes(updated);
    setSelectedDeductionType(value);
    setNewDeductionType("");
  };

  const removeDeductionType = () => {
    if (deductionTypes.length <= 1) {
      showToast("At least one deduction type must remain.", "error");
      return;
    }

    const updated = deductionTypes.filter(
      (item) => item !== selectedDeductionType,
    );
    setDeductionTypes(updated);
    setSelectedDeductionType(updated[0] || "");
  };

  const addIncentiveType = () => {
    const value = newIncentiveType.trim();
    if (!value) return;

    const exists = incentiveTypes.some(
      (item) => item.toLowerCase() === value.toLowerCase(),
    );

    if (exists) {
      setSelectedIncentiveType(
        incentiveTypes.find(
          (item) => item.toLowerCase() === value.toLowerCase(),
        ) || value,
      );
      setNewIncentiveType("");
      return;
    }

    const updated = [...incentiveTypes, value].sort((a, b) =>
      a.localeCompare(b),
    );
    setIncentiveTypes(updated);
    setSelectedIncentiveType(value);
    setNewIncentiveType("");
  };

  const removeIncentiveType = () => {
    if (incentiveTypes.length <= 1) {
      showToast("At least one incentive type must remain.", "error");
      return;
    }

    const updated = incentiveTypes.filter(
      (item) => item !== selectedIncentiveType,
    );
    setIncentiveTypes(updated);
    setSelectedIncentiveType(updated[0] || "");
  };

  const toggleEmployeeSelection = (id) => {
    const newSelected = new Set(selectedEmployees);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelectedEmployees(newSelected);
  };

  const designationOptions = useMemo(() => {
    const unique = new Set();
    for (const row of payrollData) {
      if (row.designation) unique.add(row.designation);
    }
    return ["All", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [payrollData]);

  const filteredPayroll = useMemo(() => {
    const searchText = (search || "").toLowerCase();

    return payrollData.filter((p) => {
      const bySearch = `${p.first_name} ${p.last_name} ${p.emp_id}`
        .toLowerCase()
        .includes(searchText);
      const byDesignation =
        designationFilter === "All" || p.designation === designationFilter;
      return bySearch && byDesignation;
    });
  }, [payrollData, search, designationFilter]);

  const currentPeriodHistory = useMemo(
    () => salaryHistoryData,
    [salaryHistoryData],
  );

  useEffect(() => {
    if (adjustmentModal) {
      setApplyToOtherMonth(false);
      setAdjustmentTargetPeriod(period);
      setApplyByRange(false);
      setAdjustmentRangeStart(period);
      setAdjustmentRangeEnd(period);
    }
  }, [adjustmentModal, period]);

  const allFilteredSelected =
    filteredPayroll.length > 0 &&
    filteredPayroll.every((p) => selectedEmployees.has(p.emp_id));

  const payrollSummary = useMemo(() => {
    return filteredPayroll.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.gross += Number(row.gross_pay || 0);
        acc.deductions += Number(row.absence_deductions || 0);
        acc.net += Number(row.net_pay || 0);
        return acc;
      },
      { count: 0, gross: 0, deductions: 0, net: 0 },
    );
  }, [filteredPayroll]);

  if (isLoadingPayroll || isLoadingEmployees)
    return (
      <div className="p-6 text-gray-900 font-bold">Loading Payroll Data...</div>
    );

  return (
    <div>
      {!shortcutMode && (
        <>
          <div className="flex items-center justify-between gap-4 mb-6 flex-nowrap">
            <h1 className="m-0 text-[1.4rem] font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
              Payroll
            </h1>
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
              <label className="flex items-center gap-2 text-sm text-gray-600 mr-2">
                Period:
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
              </label>

              {isAdmin && (
                <>
                  <button
                    onClick={() => setSalarySettingsModal(true)}
                    className="px-4 py-2 rounded-lg bg-blue-600 border border-blue-600 text-white text-sm font-semibold cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Salary Settings
                  </button>

                  {/* NEW: Bulk Email Button */}
                  <button
                    onClick={() => {
                      // Ensure 'period' is the actual value (e.g., "2024-03")
                      if (
                        window.confirm(
                          `Are you sure you want to send payslips to all employees for the period of ${period}?`,
                        )
                      ) {
                        // PASS THE PERIOD HERE
                        sendBulkPayslipsMutation.mutate(period);
                      }
                    }}
                    disabled={
                      sendBulkPayslipsMutation.isPending ||
                      filteredPayroll.length === 0
                    }
                    className="px-4 py-2 rounded-lg bg-indigo-600 border border-indigo-600 text-white text-sm font-semibold cursor-pointer hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                    {sendBulkPayslipsMutation.isPending
                      ? `Sending to ${filteredPayroll.length} employees...`
                      : "Email All"}
                  </button>

                  <button
                    onClick={() => {
                      setBulkAdjustmentMode(!bulkAdjustmentMode);
                      setSelectedEmployees(new Set());
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors border ${bulkAdjustmentMode ? "bg-gray-900 text-white border-gray-900" : "bg-black text-white border-black hover:bg-gray-800"}`}
                  >
                    {bulkAdjustmentMode ? "Cancel Bulk" : "Adjust Multiple"}
                  </button>

                  <button
                    onClick={() => setResetConfirmModal(true)}
                    className="px-4 py-2 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm font-semibold cursor-pointer hover:bg-red-100 transition-colors"
                  >
                    Reset All Data
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Employees
              </p>
              <p className="m-0 mt-1 text-xl font-black text-gray-900">
                {payrollSummary.count}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Gross Total
              </p>
              <p className="m-0 mt-1 text-xl font-black text-gray-900">
                {fmt(payrollSummary.gross)}
              </p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 shadow-sm">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-red-600">
                Deductions
              </p>
              <p className="m-0 mt-1 text-xl font-black text-red-700">
                -{fmt(payrollSummary.deductions)}
              </p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50 p-3 shadow-sm">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-green-600">
                Net Total
              </p>
              <p className="m-0 mt-1 text-xl font-black text-green-700">
                {fmt(payrollSummary.net)}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                className="w-full max-w-[300px] px-4 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={designationFilter}
                onChange={(e) => {
                  setDesignationFilter(e.target.value);
                  setSelectedEmployees(new Set());
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-500"
              >
                {designationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All Designations" : option}
                  </option>
                ))}
              </select>

              {isAdmin && bulkAdjustmentMode && selectedEmployees.size > 0 && (
                <button
                  onClick={() =>
                    setAdjustmentModal({
                      name: `${selectedEmployees.size} Employee(s)`,
                      isBulk: true,
                    })
                  }
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold cursor-pointer hover:bg-green-700 border-0"
                >
                  Apply Adjustment to {selectedEmployees.size} Employees
                </button>
              )}
            </div>
          </div>

          {!isAdmin && (
            <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-700">
              View-only mode: only Admin can generate payroll, adjust salaries,
              and update salary settings.
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {isAdmin && bulkAdjustmentMode && (
                      <th className="px-6 py-3 text-center w-12">
                        <input
                          type="checkbox"
                          onChange={() =>
                            setSelectedEmployees(
                              allFilteredSelected
                                ? new Set()
                                : new Set(filteredPayroll.map((p) => p.emp_id)),
                            )
                          }
                          checked={allFilteredSelected}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs">
                      ID
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs">
                      Name
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs text-right">
                      Basic Pay
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs text-right">
                      Deductions
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs text-right">
                      Incentives
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs text-right">
                      Net Pay
                    </th>
                    {isAdmin && !bulkAdjustmentMode && (
                      <th className="px-6 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs text-right">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPayroll.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? (bulkAdjustmentMode ? 7 : 7) : 6}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No payroll records found for {period}. Click "Generate
                        Payroll" to calculate.
                      </td>
                    </tr>
                  ) : (
                    filteredPayroll.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => {
                          if (isAdmin && bulkAdjustmentMode) {
                            toggleEmployeeSelection(p.emp_id);
                          }
                        }}
                        className={`hover:bg-gray-50 transition-colors ${selectedEmployees.has(p.emp_id) ? "bg-purple-50" : ""} ${isAdmin && bulkAdjustmentMode ? "cursor-pointer" : ""}`}
                      >
                        {isAdmin && bulkAdjustmentMode && (
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedEmployees.has(p.emp_id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleEmployeeSelection(p.emp_id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">{p.emp_id}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                              {p.profile_photo ? (
                                <img
                                  src={`${API_BASE_URL}/${p.profile_photo.replace(/^\/+/, "")}`}
                                  alt="Profile"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">
                                {p.first_name} {p.last_name}
                              </div>
                              <div className="text-xs text-gray-500 font-normal mt-0.5">
                                {p.position}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {fmt(p.basic_pay)}
                        </td>
                        <td className="px-6 py-4 text-right text-red-600">
                          <div className="font-semibold">
                            {fmt(p.absence_deductions)}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {p.deduction_reasons || "No deduction type"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div
                            className={`font-semibold ${Number(p.incentives || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {fmtSigned(p.incentives)}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {p.incentive_reasons || "No incentive type"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-purple-700">
                          {fmt(p.net_pay)}
                        </td>
                        {isAdmin && !bulkAdjustmentMode && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendPayslipMutation.mutate(p.emp_id);
                                }}
                                disabled={
                                  sendPayslipMutation.isPending &&
                                  sendPayslipMutation.variables === p.emp_id
                                }
                                className="px-3 py-1.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold border-0 cursor-pointer hover:bg-indigo-200 flex items-center gap-1.5"
                                title="Send Email"
                              >
                                <Mail className="w-3 h-3" />
                                Email
                              </button>

                              <button
                                onClick={() => setSalaryBreakdownModal(p)}
                                className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold border-0 cursor-pointer hover:bg-blue-200"
                              >
                                View
                              </button>
                              <button
                                onClick={() => setAdjustmentModal(p)}
                                className="px-3 py-1.5 rounded-md bg-purple-100 text-purple-700 text-xs font-bold border-0 cursor-pointer hover:bg-purple-200"
                              >
                                Adjust
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Salary Settings Modal (With Grouped Preview Table & Dropdown) */}
      {isAdmin && salarySettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-gray-900 flex justify-between items-center text-white shrink-0">
              <h2 className="text-lg font-bold m-0">
                Position Salary Settings
              </h2>
              <button
                onClick={() => setSalarySettingsModal(false)}
                className="text-white text-2xl bg-transparent border-0 cursor-pointer hover:text-gray-300"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 uppercase mb-3 border-b border-gray-200 pb-2">
                    Update Base Salary
                  </h3>
                  <p className="text-xs text-gray-600 mb-5">
                    Select a designation and position to enter the new monthly
                    base salary. This will immediately apply to all employees
                    currently holding this position.
                  </p>
                  <form onSubmit={handleBaseSalaryUpdate} className="space-y-5">
                    {/* DESIGNATION DROPDOWN */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Select Designation (Optional Filter)
                      </label>
                      <select
                        value={salaryForm.designation}
                        onChange={(e) =>
                          setSalaryForm({
                            ...salaryForm,
                            designation: e.target.value,
                            position: "", // Reset position when designation changes
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      >
                        <option value="">All Designations</option>
                        {Object.keys(DESIGNATIONS).map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* POSITION DROPDOWN */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Select Position
                      </label>
                      <select
                        required
                        value={salaryForm.position}
                        onChange={(e) =>
                          setSalaryForm({
                            ...salaryForm,
                            position: e.target.value,
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      >
                        <option value="" disabled>
                          Choose Position...
                        </option>
                        {salaryForm.designation
                          ? // Show only positions for the selected designation
                            DESIGNATIONS[salaryForm.designation].map((pos) => (
                              <option key={pos} value={pos}>
                                {pos}
                              </option>
                            ))
                          : // Show all positions grouped if no designation is selected
                            Object.entries(DESIGNATIONS).map(
                              ([dept, positions]) => (
                                <optgroup key={dept} label={dept}>
                                  {positions.map((pos) => (
                                    <option key={pos} value={pos}>
                                      {pos}
                                    </option>
                                  ))}
                                </optgroup>
                              ),
                            )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        New Monthly Base Salary
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                          ₱
                        </span>
                        <input
                          required
                          type="text"
                          inputMode="decimal"
                          value={salaryForm.amount}
                          onChange={(e) =>
                            setSalaryForm({
                              ...salaryForm,
                              amount: sanitizeMoneyInput(e.target.value),
                            })
                          }
                          onBlur={() =>
                            setSalaryForm({
                              ...salaryForm,
                              amount: formatMoneyOnBlur(salaryForm.amount),
                            })
                          }
                          placeholder="0.00"
                          className="w-full border border-gray-300 rounded-lg p-2.5 pl-8 outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmSalarySettingsModal(false);
                          setSalarySettingsModal(false);
                          setSalaryForm({
                            designation: "",
                            position: "",
                            amount: "",
                          });
                        }}
                        className="flex-1 py-2 border border-gray-300 rounded-lg font-semibold text-gray-600 bg-white cursor-pointer hover:bg-gray-50"
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={updateBaseSalaryMutation.isPending}
                        className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-semibold cursor-pointer border-0 hover:bg-purple-700 disabled:opacity-50"
                      >
                        {updateBaseSalaryMutation.isPending
                          ? "Updating..."
                          : "Update All"}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  Salary settings are Admin-only and apply per selected
                  position.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && confirmSalarySettingsModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white">
              <h3 className="m-0 text-base font-bold">Confirm Salary Update</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="m-0 text-sm text-gray-700 leading-relaxed">
                Update monthly base salary for
                <span className="font-bold text-gray-900">
                  {" "}
                  {salaryForm.position}
                </span>
                to
                <span className="font-bold text-gray-900">
                  {" "}
                  {fmt(salaryForm.amount)}
                </span>
                ?
              </p>
              <p className="m-0 text-xs text-gray-500">
                This will apply to all current and future employees with this
                position.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmSalarySettingsModal(false)}
                  disabled={updateBaseSalaryMutation.isPending}
                  className="flex-1 py-2 border border-gray-300 rounded-lg font-semibold text-gray-600 bg-white cursor-pointer hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBaseSalaryUpdate}
                  disabled={updateBaseSalaryMutation.isPending}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-semibold cursor-pointer border-0 hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateBaseSalaryMutation.isPending
                    ? "Updating..."
                    : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Salary Breakdown Modal */}
      {salaryBreakdownModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex justify-between items-center text-white">
              <h2 className="text-lg font-semibold m-0">Salary Breakdown</h2>
              <button
                onClick={() => setSalaryBreakdownModal(null)}
                className="text-white text-2xl bg-transparent border-0 cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="text-sm font-bold text-gray-700 mb-4">
                {salaryBreakdownModal.first_name}{" "}
                {salaryBreakdownModal.last_name}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-semibold text-gray-700">Basic Pay</span>
                  <span className="text-gray-900 font-bold">
                    {fmt(salaryBreakdownModal.basic_pay)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-red-200 bg-red-50">
                  <span className="font-semibold text-red-700">Deductions</span>
                  <span className="text-red-700 font-bold">
                    -{fmt(salaryBreakdownModal.absence_deductions)}
                  </span>
                </div>
                {salaryBreakdownModal.deduction_reasons && (
                  <div className="py-3 bg-red-50 rounded-lg border border-red-200 p-3">
                    <p className="text-xs font-bold text-red-800 uppercase mb-2">
                      Deduction Types:
                    </p>
                    <p className="text-xs text-red-900 leading-relaxed">
                      {salaryBreakdownModal.deduction_reasons}
                    </p>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-green-200 bg-green-50">
                  <span className="font-semibold text-green-700">
                    Incentives
                  </span>
                  <span
                    className={`font-bold ${Number(salaryBreakdownModal.incentives || 0) >= 0 ? "text-green-700" : "text-red-700"}`}
                  >
                    {fmtSigned(salaryBreakdownModal.incentives)}
                  </span>
                </div>
                {salaryBreakdownModal.incentive_reasons && (
                  <div className="py-3 bg-yellow-50 rounded-lg border border-yellow-200 p-3">
                    <p className="text-xs font-bold text-yellow-800 uppercase mb-2">
                      Incentive Types:
                    </p>
                    <p className="text-xs text-yellow-900 leading-relaxed">
                      {salaryBreakdownModal.incentive_reasons}
                    </p>
                  </div>
                )}
                <div className="flex justify-between py-3 bg-purple-50 rounded-lg p-3">
                  <span className="font-bold text-purple-900">Net Pay</span>
                  <span className="text-purple-900 font-black text-lg">
                    {fmt(salaryBreakdownModal.net_pay)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {isAdmin && adjustmentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 flex justify-between items-center text-white">
              <h2 className="text-lg font-semibold m-0">
                {bulkAdjustmentMode ? "Bulk Adjustment" : "Adjust Salary"}
              </h2>
              <button
                onClick={closeAdjustmentModal}
                className="text-white text-2xl bg-transparent border-0 cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-7">
                  <p className="text-sm font-bold text-gray-700">
                    {bulkAdjustmentMode
                      ? `${selectedEmployees.size} selected`
                      : `${adjustmentModal.first_name} ${adjustmentModal.last_name}`}
                  </p>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={applyToOtherMonth}
                        onChange={(e) => setApplyToOtherMonth(e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      Apply to another month
                    </label>
                    {applyToOtherMonth && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                          <input
                            type="checkbox"
                            checked={applyByRange}
                            onChange={(e) => setApplyByRange(e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                          />
                          Select month range
                        </label>

                        {applyByRange ? (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="month"
                              value={adjustmentRangeStart}
                              onChange={(e) =>
                                setAdjustmentRangeStart(e.target.value)
                              }
                              className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                            />
                            <input
                              type="month"
                              value={adjustmentRangeEnd}
                              onChange={(e) =>
                                setAdjustmentRangeEnd(e.target.value)
                              }
                              className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                            />
                          </div>
                        ) : (
                          <input
                            type="month"
                            value={adjustmentTargetPeriod}
                            onChange={(e) =>
                              setAdjustmentTargetPeriod(e.target.value)
                            }
                            className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                  >
                    <option value="Incentive">Incentives</option>
                    <option value="Decrease">Deductions</option>
                  </select>
                  {adjustmentType === "Decrease" ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Deduction Type and Amount
                      </label>
                      <div className="flex gap-2 mb-2">
                        <select
                          value={selectedDeductionType}
                          onChange={(e) =>
                            setSelectedDeductionType(e.target.value)
                          }
                          className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                        >
                          {deductionTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <div className="relative w-36">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                            ₱
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={adjustmentAmount}
                            onChange={(e) =>
                              setAdjustmentAmount(
                                sanitizeMoneyInput(e.target.value),
                              )
                            }
                            onBlur={() =>
                              setAdjustmentAmount(
                                formatMoneyOnBlur(adjustmentAmount),
                              )
                            }
                            placeholder="0.00"
                            className="w-full border border-gray-300 rounded-lg p-2 pl-6 outline-none focus:ring-2 focus:ring-purple-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={removeDeductionType}
                          className="w-10 rounded-lg border border-red-300 bg-red-50 text-red-700 text-lg font-bold cursor-pointer hover:bg-red-100"
                          title="Remove selected deduction type"
                        >
                          -
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDeductionType}
                          onChange={(e) => setNewDeductionType(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addDeductionType();
                            }
                          }}
                          placeholder="Add deduction type"
                          className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        <button
                          type="button"
                          onClick={addDeductionType}
                          className="w-10 rounded-lg border border-green-300 bg-green-50 text-green-700 text-lg font-bold cursor-pointer hover:bg-green-100"
                          title="Add deduction type"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Incentive Type and Amount
                      </label>
                      <div className="flex gap-2 mb-2">
                        <select
                          value={selectedIncentiveType}
                          onChange={(e) =>
                            setSelectedIncentiveType(e.target.value)
                          }
                          className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                        >
                          {incentiveTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <div className="relative w-36">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                            ₱
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={adjustmentAmount}
                            onChange={(e) =>
                              setAdjustmentAmount(
                                sanitizeMoneyInput(e.target.value),
                              )
                            }
                            onBlur={() =>
                              setAdjustmentAmount(
                                formatMoneyOnBlur(adjustmentAmount),
                              )
                            }
                            placeholder="0.00"
                            className="w-full border border-gray-300 rounded-lg p-2 pl-6 outline-none focus:ring-2 focus:ring-purple-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={removeIncentiveType}
                          className="w-10 rounded-lg border border-red-300 bg-red-50 text-red-700 text-lg font-bold cursor-pointer hover:bg-red-100"
                          title="Remove selected incentive type"
                        >
                          -
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newIncentiveType}
                          onChange={(e) => setNewIncentiveType(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addIncentiveType();
                            }
                          }}
                          placeholder="Add incentive type"
                          className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        <button
                          type="button"
                          onClick={addIncentiveType}
                          className="w-10 rounded-lg border border-green-300 bg-green-50 text-green-700 text-lg font-bold cursor-pointer hover:bg-green-100"
                          title="Add incentive type"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 lg:col-span-5">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="m-0 text-xs font-bold uppercase tracking-wider text-gray-600">
                        Adjustment Lines
                      </p>
                      <button
                        type="button"
                        onClick={addCurrentAdjustmentLine}
                        className="rounded-md border border-purple-300 bg-purple-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-purple-700 hover:bg-purple-100"
                      >
                        Add Line
                      </button>
                    </div>

                    {adjustmentLineItems.length === 0 ? (
                      <p className="m-0 text-xs text-gray-500">
                        No line items added yet. You can mix incentives and
                        deductions.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {adjustmentLineItems.map((line, index) => (
                          <div
                            key={line.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-2"
                          >
                            <div className="min-w-0">
                              <p className="m-0 truncate text-xs font-semibold text-gray-800">
                                {index + 1}.{" "}
                                {line.type === "Decrease"
                                  ? "Deduction"
                                  : "Incentive"}{" "}
                                - {line.description}
                              </p>
                              <p className="m-0 mt-0.5 text-xs font-bold text-gray-700">
                                ₱{Number(line.amount || 0).toFixed(2)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAdjustmentLine(line.id)}
                              className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-red-700 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      onClick={closeAdjustmentModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 font-medium cursor-pointer hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdjustment}
                      disabled={adjustmentMutation.isPending}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium cursor-pointer border-0 hover:bg-purple-700"
                    >
                      {adjustmentMutation.isPending
                        ? "Applying..."
                        : applyToOtherMonth && applyByRange
                          ? "Apply to Range"
                          : "Apply"}
                    </button>
                  </div>

                  {!bulkAdjustmentMode && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs font-bold text-gray-700 uppercase mb-2">
                        Recent Deductions/Incentives (
                        {applyToOtherMonth
                          ? applyByRange
                            ? adjustmentRangeEnd
                            : adjustmentTargetPeriod
                          : period}
                        )
                      </p>
                      {currentPeriodHistory.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          No editable adjustment records found for this month.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {currentPeriodHistory.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md border border-gray-200 bg-gray-50 p-2 flex items-center justify-between gap-2"
                            >
                              <div className="text-xs text-gray-700">
                                <span className="font-bold">
                                  {toUiAdjustmentCategory(entry.type) ===
                                  "Decrease"
                                    ? "Deduction"
                                    : "Incentive"}
                                </span>
                                : {entry.description || "No type provided"} ={" "}
                                {fmt(entry.amount)}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => startEditHistoryEntry(entry)}
                                  className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold border-0 cursor-pointer hover:bg-blue-200"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => removeHistoryEntry(entry.id)}
                                  disabled={
                                    deleteHistoryEntryMutation.isPending
                                  }
                                  className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold border-0 cursor-pointer hover:bg-red-200 disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && editingHistoryEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex justify-between items-center text-white">
              <h2 className="text-lg font-semibold m-0">Edit Adjustment</h2>
              <button
                onClick={() => setEditingHistoryEntry(null)}
                className="text-white text-2xl bg-transparent border-0 cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Type and Amount
              </label>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <select
                  value={editingHistoryEntry.type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    const nextOptions =
                      nextType === "Decrease" ? deductionTypes : incentiveTypes;
                    const hasCurrentDescription = nextOptions.includes(
                      editingHistoryEntry.description,
                    );

                    setEditingHistoryEntry({
                      ...editingHistoryEntry,
                      type: nextType,
                      description: hasCurrentDescription
                        ? editingHistoryEntry.description
                        : nextOptions[0] || "",
                    });
                  }}
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  <option value="Incentive">Incentives</option>
                  <option value="Decrease">Deductions</option>
                </select>
                <select
                  value={editingHistoryEntry.description || ""}
                  onChange={(e) =>
                    setEditingHistoryEntry({
                      ...editingHistoryEntry,
                      description: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  {(editingHistoryEntry.type === "Decrease"
                    ? deductionTypes
                    : incentiveTypes
                  ).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingHistoryEntry.amount}
                  onChange={(e) =>
                    setEditingHistoryEntry({
                      ...editingHistoryEntry,
                      amount: e.target.value,
                    })
                  }
                  placeholder="Amount"
                  className="w-28 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setEditingHistoryEntry(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 font-medium cursor-pointer hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditHistoryEntry}
                  disabled={updateHistoryEntryMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium cursor-pointer border-0 hover:bg-blue-700 disabled:opacity-60"
                >
                  {updateHistoryEntryMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Reset All Payroll Data?
            </h2>
            <p className="text-gray-600 mb-4">
              This will permanently delete all payroll records and salary
              adjustments. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResetConfirmModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 font-medium cursor-pointer hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => resetPayrollMutation.mutate()}
                disabled={resetPayrollMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium cursor-pointer border-0 hover:bg-red-700 disabled:bg-red-400"
              >
                {resetPayrollMutation.isPending ? "Resetting..." : "Reset All"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
