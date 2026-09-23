import { getDateDiffInclusive } from "./date.utils";

// --

export function getLeaveDateStatus(leave: Leave, dateStr: string): LeaveStatus {
  const requestStatus = leave.status || "Pending";

  if (requestStatus === "Approved") return "Approved";
  if (requestStatus === "Denied") return "Denied";
  if (requestStatus === "Pending") return "Pending";

  if (requestStatus === "Partially Approved") {
    const approvedSet = new Set(parseApprovedDates(leave.approved_dates));
    if (approvedSet.size === 0) return "Pending";
    return approvedSet.has(dateStr) ? "Approved" : "Denied";
  }

  return "Pending";
}
// ---
export function getOffsetRequestedDays(item: Partial<Leave>) {
  const rawDays = Number(item?.days_applied);
  if (!Number.isNaN(rawDays) && rawDays > 0) {
    return rawDays;
  }

  const fromDate = item?.date_from;
  const toDate = item?.date_to || fromDate;

  if (!fromDate || !toDate) {
    console.log(
      "Error on GetOffsetRequestedDays, undefined fromDate or toDate",
    );
    return;
  }
  const inferredDays = getDateDiffInclusive({ start: fromDate, end: toDate });
  return inferredDays > 0 ? inferredDays : 1;
}

// --
export function pad(n: number): string | number {
  return n < 10 ? "0" + n : "" + n;
}

// DOES NOT EXPORT
function normalizeDateString(value: DateInput) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// --
function parseApprovedDates(
  raw: string | string[] | null | undefined,
): (string | null)[] {
  if (!raw) return [];

  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => normalizeDateString(item)).filter(Boolean);
}
