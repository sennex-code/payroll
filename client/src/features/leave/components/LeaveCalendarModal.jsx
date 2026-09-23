import React from "react";
import { badgeClass } from "../leaveConstants";

const LeaveCalendarModal = ({
  setSelectedDate,
  selectedDateStr,
  selectedAttendance,
  selectedLeaves,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      onClick={() => setSelectedDate(null)}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-4 text-white">
          <div>
            <h4 className="m-0 text-base font-bold">Date Details</h4>
            <p className="m-0 mt-1 text-xs text-slate-200">
              {new Date(selectedDateStr).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="cursor-pointer rounded-md border border-white/30 bg-white/10 px-2.5 py-1 text-sm font-bold text-white hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto bg-slate-50 p-5">
          {!selectedAttendance && selectedLeaves.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              No leave or attendance records found for this date.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedAttendance && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-sm font-bold text-slate-900">
                        Daily Attendance Record
                      </p>
                      <p className="m-0 mt-1 text-xs text-slate-500">
                        System Log
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${attendanceColors[selectedAttendance.status] || "bg-gray-200 text-gray-800"}`}
                    >
                      {selectedAttendance.status}
                    </span>
                  </div>
                </div>
              )}

              {selectedLeaves.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-sm font-bold text-indigo-700">
                        {l.first_name} {l.last_name}
                      </p>
                      <p className="m-0 mt-1 text-sm font-bold text-slate-900">
                        {l.leave_type}{" "}
                        {l.leave_type === "Offset" &&
                          Number(l.days_applied || 0) > 0 &&
                          `(${Number(l.days_applied || 0).toFixed(2)} days)`}
                      </p>
                      <p className="m-0 mt-1 text-xs text-slate-500">
                        {new Date(l.date_from).toLocaleDateString()} to{" "}
                        {new Date(l.date_to).toLocaleDateString()}
                      </p>
                      {l.supervisor_remarks && (
                        <p className="m-0 mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs italic text-slate-600">
                          "{l.supervisor_remarks}"
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${badgeClass[l.calendar_status] || "bg-gray-100"}`}
                    >
                      {l.calendar_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendarModal;
