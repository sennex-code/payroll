import React from "react";

import {
  getAttendanceForDate,
  getLeavesForDate,
} from "../utils/calendar.utils";
import { pad } from "../utils/leave.utils";
import { attendanceColors, statusColors } from "../leaveConstants";
import LeaveCalendarModal from "./LeaveCalendarModal";

const LeaveCalendarGrid = ({
  cells,
  leaves,
  attendance,
  selectedDate,
  setSelectedDate,
  month,
  year,
  selectedAttendance,
  selectedLeaves,
  selectedDateStr,
}) => {
  return (
    <>
      <div className="bg-slate-50 p-4">
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
            if (day === null)
              return <div key={"e" + i} className="min-h-22.5" />;

            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const dayLeaves = getLeavesForDate(dateStr, leaves);
            const dayAtt = getAttendanceForDate(dateStr, attendance);
            const isSelected = day === selectedDate;
            const visibleLeaves = dayLeaves.slice(0, 3);
            const extraLeavesCount = Math.max(
              dayLeaves.length - visibleLeaves.length,
              0,
            );

            const firstLeaveStatus =
              dayLeaves.length > 0 ? dayLeaves[0].calendar_status : null;
            const colorConfig = firstLeaveStatus
              ? // @ts-ignore
                statusColors[firstLeaveStatus]
              : null;

            return (
              <button
                key={i}
                type="button"
                className={`relative flex min-h-22.5 cursor-pointer flex-col items-start justify-start rounded-xl p-2 text-left transition-all duration-150 ${
                  dayLeaves.length > 0 && !isSelected
                    ? colorConfig?.border + " " + colorConfig?.bg
                    : "border border-slate-200 bg-white"
                } ${isSelected ? "z-10 border-slate-900 bg-slate-900 text-white shadow-md" : "hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"}`}
                onClick={() => setSelectedDate(day)}
              >
                <span
                  className={`mb-0.5 text-xs font-bold ${isSelected ? "text-white" : "text-slate-900"}`}
                >
                  {day}
                </span>

                <div className="mt-0.5 flex w-full flex-col gap-1">
                  {dayAtt && dayAtt.status !== "On Leave" && (
                    <span
                      className={`flex w-fit rounded-md px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : //  @ts-ignore
                            attendanceColors[dayAtt.status] ||
                            "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {dayAtt.status}
                    </span>
                  )}
                  {visibleLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="mt-0.5 flex w-full flex-col gap-0.5 border-t border-gray-100/50 pt-0.5 text-left"
                    >
                      <span
                        className={`truncate text-[0.6rem] font-bold leading-tight ${isSelected ? "text-white" : "text-purple-800"}`}
                      >
                        {leave.first_name} {leave.last_name}
                      </span>
                      <span
                        className={`truncate text-[0.55rem] font-semibold leading-tight ${isSelected ? "text-white/90" : "text-gray-600"}`}
                      >
                        {leave.leave_type}
                      </span>
                      <span
                        className={`truncate text-[0.55rem] font-semibold uppercase ${
                          isSelected
                            ? "text-purple-200"
                            : // @ts-ignore
                              statusColors[leave.calendar_status]?.text
                        }`}
                      >
                        • {leave.calendar_status}
                      </span>
                    </div>
                  ))}
                  {extraLeavesCount > 0 && (
                    <span
                      className={`mt-0.5 inline-flex w-fit rounded-md px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      +{extraLeavesCount} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {selectedDate && (
        <LeaveCalendarModal
          setSelectedDate={setSelectedDate}
          selectedDateStr={selectedDateStr}
          selectedAttendance={selectedAttendance}
          selectedLeaves={selectedLeaves}
        ></LeaveCalendarModal>
      )}
    </>
  );
};

export default LeaveCalendarGrid;
