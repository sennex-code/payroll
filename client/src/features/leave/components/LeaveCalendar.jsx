import { useState } from "react";
import LeaveCalendarGrid from "./LeaveCalendarGrid";
import LeaveCalendarHeader from "./LeaveCalendarHeader";
import { getDaysInMonth } from "../utils/date.utils";
import { pad } from "../utils/leave.utils";
import {
  getAttendanceForDate,
  getLeavesForDate,
} from "../utils/calendar.utils";

export default function LeaveCalendar({
  leaves,
  scopeOptions = [],
  onScopeChange,
  attendance,
  activeScope,
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth({ year: year, month: month });
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const [selectedDate, setSelectedDate] = useState(null);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedDateStr = selectedDate
    ? `${year}-${pad(month + 1)}-${pad(selectedDate)}`
    : null;
  const selectedLeaves = selectedDateStr
    ? getLeavesForDate(selectedDateStr, leaves)
    : [];
  const selectedAttendance = selectedDateStr
    ? getAttendanceForDate(selectedDateStr, attendance)
    : null;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <LeaveCalendarHeader
        scopeOptions={scopeOptions}
        onScopeChange={onScopeChange}
        monthName={monthName}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        activeScope={activeScope}
      ></LeaveCalendarHeader>
      <LeaveCalendarGrid
        selectedDateStr={selectedDateStr}
        month={month}
        year={year}
        cells={cells}
        leaves={leaves}
        attendance={attendance}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedAttendance={selectedAttendance}
        selectedLeaves={selectedLeaves}
      ></LeaveCalendarGrid>
    </div>
  );
}
