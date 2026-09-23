import { useState } from "react";
import { AlertCircle } from "lucide-react";

export default function MissingDocsTracker({ missingDocs = [], onOpenModal }) {
  // State to track which employee's document modal is currently open
  const [selectedEmp, setSelectedEmp] = useState(null);

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-lg font-bold text-slate-800">
          Missing Requirements Tracker
        </h2>
        <button
          onClick={onOpenModal}
          className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-purple-800"
        >
          Update Documents
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          {/* Table Headers */}
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-4">Employee Name</th>
              <th className="px-6 py-4">Designation</th>
              <th className="px-6 py-4">Date Hired</th>
              <th className="px-6 py-4">Missing Documents</th>
              <th className="px-6 py-4">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {!missingDocs || missingDocs.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-6 py-8 text-center font-medium text-slate-500"
                >
                  All employees have complete documents! 🎉
                </td>
              </tr>
            ) : (
              missingDocs.map((emp) => {
                const docsList = emp.missing_docs
                  ? emp.missing_docs.split(", ")
                  : [];

                return (
                  <tr
                    key={emp.emp_id}
                    className="align-top transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {emp.designation}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {/* Robust Date Check for Date Hired */}
                      {emp.hired_date
                        ? new Date(emp.hired_date).toLocaleDateString()
                        : emp.date_hired
                          ? new Date(emp.date_hired).toLocaleDateString()
                          : emp.created_at
                            ? new Date(emp.created_at).toLocaleDateString()
                            : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      {/* THE CLICKABLE BADGE (Opens the Modal) */}
                      <button
                        onClick={() => setSelectedEmp(emp)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {docsList.length} Missing{" "}
                        {docsList.length === 1 ? "Document" : "Documents"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {/* Check for the correct database column name: updated_at */}
                      {emp.updated_at
                        ? new Date(emp.updated_at).toLocaleString()
                        : "N/A"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* NEW: MISSING DOCUMENTS MODAL */}
      {selectedEmp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Missing Documents
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {selectedEmp.first_name} {selectedEmp.last_name} •{" "}
                  {selectedEmp.designation}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmp(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (The List) */}
            <div className="p-6">
              <ul className="list-inside list-disc space-y-2 text-sm font-medium text-red-600 marker:text-red-400">
                {selectedEmp.missing_docs ? (
                  selectedEmp.missing_docs.split(", ").map((doc, idx) => (
                    <li key={idx} className="pl-1">
                      {doc}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">No missing documents.</li>
                )}
              </ul>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedEmp(null)}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const currentId = selectedEmp.emp_id; // Grab the ID
                  setSelectedEmp(null); // Close the inner modal
                  onOpenModal(currentId); // Pass the ID to the Dashboard
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 cursor-pointer"
              >
                Update Documents
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
