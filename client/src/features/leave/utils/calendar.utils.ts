import { isInRange } from "./date.utils";
import { getLeaveDateStatus, pad } from "./leave.utils";

export function getLeavesForDate(dateStr: string, leaves: any[]): any[] {
  return leaves
    .filter((l) =>
      isInRange({ date: dateStr, from: l.date_from, to: l.date_to }),
    )
    .map((leave) => ({
      ...leave,
      calendar_status: getLeaveDateStatus(leave, dateStr),
    }));
}

export function getAttendanceForDate(dateStr: string, attendance: any[]): any {
  return attendance.find((a) => {
    const d = new Date(a.date);
    const formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return formattedDate === dateStr;
  });
}
