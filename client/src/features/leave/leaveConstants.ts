export const leaveTypes = [
  "Birthday Leave",
  "Vacation Leave",
  "Sick Leave",
  "PGT Leave",
  "Offset", // ADDED: Offset as a leave type
];

export const resignationTypes = [
  "Voluntary Resignation",
  "Health Reasons",
  "Relocation",
  "Career Change",
  "Further Education",
  "Other",
];

export const leavePolicy = {
  "Birthday Leave": { maxDays: 1, excludeWeekends: true },
  "Vacation Leave": { maxDays: 20, excludeWeekends: true },
  "Sick Leave": { maxDays: 10, excludeWeekends: true },
  "PGT Leave": { maxDays: 20, excludeWeekends: true },
  "Job Order MAC Leave": { maxDays: 12, excludeWeekends: true },
  Offset: { maxDays: 999, excludeWeekends: false }, // Prevent maxDays error for offsets
};

export const badgeClass = {
  Approved: "bg-green-100 text-green-800",
  Denied: "bg-red-100 text-red-800",
  Pending: "bg-yellow-100 text-yellow-800",
  "Pending Approval": "bg-yellow-100 text-yellow-800",
  "Cancellation Requested": "bg-amber-100 text-amber-800",
  Rejected: "bg-red-100 text-red-800",
  "Partially Approved": "bg-amber-100 text-amber-800",
};

export const statusColors = {
  Approved: {
    bg: "bg-green-50",
    border: "border-l-4 border-l-green-500",
    text: "text-green-700",
  },
  Pending: {
    bg: "bg-yellow-50",
    border: "border-l-4 border-l-yellow-500",
    text: "text-yellow-700",
  },
  Denied: {
    bg: "bg-red-50",
    border: "border-l-4 border-l-red-500",
    text: "text-red-700",
  },
  "Partially Approved": {
    bg: "bg-amber-50",
    border: "border-l-4 border-l-amber-500",
    text: "text-amber-700",
  },
};

export const attendanceColors = {
  Present: "text-green-600 bg-green-50",
  Absent: "text-red-600 bg-red-50",
  Late: "text-orange-600 bg-orange-50",
  Undertime: "text-orange-600 bg-orange-50",
  "Half-Day": "text-purple-600 bg-purple-50",
};
