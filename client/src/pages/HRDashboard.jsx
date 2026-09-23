import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Toast from "../components/Toast";

import {
  dashboardSummary,
  employees,
} from "@/components/queries/hrDashboard/queryHrDashboard";
import {
  updateMutationDoc,
  updateLeaveMutationOptions,
  updateResignationMutationOptions,
} from "@/components/mutations/hrDashboard/mutationHrDashboard";

import MissingDocsTracker from "@/components/hrDashboard/MissingDocsTracker";
import UpdateDocsModal from "@/components/hrDashboard/UpdateDocsModal";
import {
  AbsentModal,
  OnLeaveModal,
  PendingLeaveModal,
  ResignationModal,
} from "@/components/hrDashboard/StatsModal";
import { HR_DASHBOARD_QUICK_ACCESS } from "@/assets/constantData";

export default function HRDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDocsModal, setShowDocsModal] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Form & Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [docForm, setDocForm] = useState({ emp_id: "", missing_docs: [] });
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const { data: dashboardData, isLoading: isLoadingDashboard } =
    useQuery(dashboardSummary);
  const { data: employeesData = [], isLoading: isLoadingEmployees } =
    useQuery(employees);

  const updateDocsMutation = useMutation({
    ...updateMutationDoc,
    onSuccess: () => {
      queryClient.invalidateQueries(["dashboardSummary"]);
      showToast("Employee documents updated successfully!", "success");

      setDocForm({ emp_id: "", missing_docs: [] });
      setSearchQuery("");
      setShowDocsModal(false);
    },
    onError: (error) =>
      showToast(error.message || "Error updating documents", "error"),
  });

  const updateResignationMutation = useMutation({
    ...updateResignationMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries(["dashboardSummary"]);
      showToast("Resignation status updated successfully!", "success");
    },
    onError: (error) =>
      showToast(error.message || "Error updating resignation", "error"),
  });

  const updateLeaveMutation = useMutation({
    ...updateLeaveMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries(["dashboardSummary"]);
      showToast("Leave request updated successfully!", "success");
    },
    onError: (error) =>
      showToast(error.message || "Error updating leave request", "error"),
  });

  const filteredEmployees = employeesData.filter((emp) => {
    if (emp.role === "Admin") return false;
    return `${emp.emp_id} ${emp.first_name} ${emp.last_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
  });

  const selectedEmployee = employeesData.find(
    // FORCE STRING COMPARISON
    (e) => String(e.emp_id) === String(docForm.emp_id),
  );

  useEffect(() => {
    if (docForm.emp_id && dashboardData?.information?.missingDocs) {
      const existing = dashboardData.information.missingDocs.find(
        // FORCE STRING COMPARISON
        (d) => String(d.emp_id) === String(docForm.emp_id),
      );
      setDocForm((prev) => ({
        ...prev,
        missing_docs: existing?.missing_docs
          ? existing.missing_docs.split(", ")
          : [],
      }));
    }
  }, [docForm.emp_id, dashboardData]);

  const handleCheckboxChange = (docName) => {
    setDocForm((prev) => ({
      ...prev,
      missing_docs: prev.missing_docs.includes(docName)
        ? prev.missing_docs.filter((d) => d !== docName)
        : [...prev.missing_docs, docName],
    }));
  };

  const handleSubmitDocs = (e) => {
    e.preventDefault();
    if (!docForm.emp_id)
      return alert("Please select an employee from the list.");
    updateDocsMutation.mutate({
      emp_id: docForm.emp_id,
      missing_docs: docForm.missing_docs,
    });
  };

  if (isLoadingDashboard || isLoadingEmployees) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 font-semibold text-slate-700 shadow-sm">
        Loading HR Dashboard...
      </div>
    );
  }

  const quickActionTheme = {
    purple:
      "border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800",
    green:
      "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800",
  };

  const stats = dashboardData?.stats || [];

  return (
    <div className="max-w-full space-y-4">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="m-0 text-[1.3rem] font-bold text-slate-900">
          HR Dashboard
        </h1>
        <p className="m-0 mt-0.5 text-xs text-slate-500">
          Workforce approvals, attendance signals, and document compliance in
          one view.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => setActiveModal(stat.modalKey)}
            className="group relative rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            style={{ boxShadow: `inset 0 3px 0 0 ${stat.borderColor}` }}
          >
            <div className="p-3.5 text-left">
              <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
              <p
                className="m-0 text-2xl font-black"
                style={{ color: stat.borderColor }}
              >
                {stat.value}
              </p>
              <p className="m-0 mt-1 text-[10px] text-slate-400 transition-colors group-hover:text-slate-500">
                Click to view
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {HR_DASHBOARD_QUICK_ACCESS.map(
            ({ icon, label, sub, path, color }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`group rounded-lg border p-3.5 text-left shadow-sm transition-colors cursor-pointer md:p-3 ${quickActionTheme[color] || "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"}`}
              >
                <p className="mb-1 text-xl md:text-lg">{icon}</p>
                <p className="text-sm font-semibold text-slate-900 md:text-[13px]">
                  {label}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">{sub}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ),
          )}
        </div>
      </section>

      <MissingDocsTracker
        missingDocs={dashboardData?.information.missingDocs}
        onOpenModal={(empId = "") => {
          // 1. CLOSE THE TRACKER MODAL FIRST! (This unlocks the screen)
          setActiveModal(null);

          // 2. Set the employee ID immediately
          setDocForm({ emp_id: empId, missing_docs: [] });

          // 3. Find the name and pre-fill the search bar
          if (empId) {
            const emp = employeesData.find(
              (e) => String(e.emp_id) === String(empId),
            );
            if (emp) setSearchQuery(`${emp.first_name} ${emp.last_name}`);
          } else {
            setSearchQuery("");
          }

          // 4. Open the Update Form
          setShowDocsModal(true);
        }}
      />

      <UpdateDocsModal
        open={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        docForm={docForm}
        setDocForm={setDocForm}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredEmployees={filteredEmployees}
        selectedEmployee={selectedEmployee}
        handleCheckboxChange={handleCheckboxChange}
        handleSubmitDocs={handleSubmitDocs}
        mutation={updateDocsMutation}
      />

      <PendingLeaveModal
        open={activeModal === "pending-leave-approval"}
        onClose={() => setActiveModal(null)}
        pendingLeaves={dashboardData?.information.pendingLeaves}
        mutation={updateLeaveMutation}
      />
      <OnLeaveModal
        open={activeModal === "on-leave"}
        onClose={() => setActiveModal(null)}
        onLeave={dashboardData?.information.onLeave}
      />
      <AbsentModal
        open={activeModal === "absent"}
        onClose={() => setActiveModal(null)}
        absents={dashboardData?.information.absents}
      />
      <ResignationModal
        open={activeModal === "pending-resignation-approval"}
        onClose={() => setActiveModal(null)}
        resignations={dashboardData?.information.resignations}
        mutation={updateResignationMutation}
      />
    </div>
  );
}
