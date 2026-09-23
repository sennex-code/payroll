// ----
export const parseDateOnly = (value: DateInput) => {
  if (value instanceof Date)
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(raw);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};
// ----
const getDateDiffInclusiveCore = ({ start, end }: DateDiffInclusive) => {
  const from = parseDateOnly(start).getTime();
  const to = parseDateOnly(end).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
};
export const getDateDiffInclusive = (
  arg1: DateDiffInclusive | DateInput,
  arg2?: DateInput,
) => {
  if (arg1 && typeof arg1 === "object" && "start" in arg1 && "end" in arg1) {
    return getDateDiffInclusiveCore(arg1 as DateDiffInclusive);
  }
  return getDateDiffInclusiveCore({
    start: arg1 as DateInput,
    end: arg2 as DateInput,
  });
};
// Compatibility shim: supports both getDateDiffInclusive({ start, end }) and getDateDiffInclusive(start, end).
export const getDateDiffInclusiveCompat = (
  arg1: DateDiffInclusive | DateInput,
  arg2?: DateInput,
) => {
  if (arg1 && typeof arg1 === "object" && "start" in arg1 && "end" in arg1) {
    return getDateDiffInclusiveCore(arg1 as DateDiffInclusive);
  }
  return getDateDiffInclusiveCore({
    start: arg1 as DateInput,
    end: arg2 as DateInput,
  });
};
// ----
export const isInRange = ({ date, from, to }: IsInRange): boolean => {
  const d = parseDateOnly(date).getTime();
  const f = parseDateOnly(from).getTime();
  const t = parseDateOnly(to).getTime();
  return d >= f && d <= t;
};
// ----
export function getDaysInMonth({
  year,
  month,
}: {
  year: number;
  month: number;
}): number {
  return new Date(year, month + 1, 0).getDate();
}
// ----
function calculateBusinessDaysCore({
  startDate,
  endDate,
}: {
  startDate: DateInput;
  endDate: DateInput;
}) {
  if (!startDate || !endDate) return;
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}
export function calculateBusinessDays(
  arg1:
    | {
        startDate: DateInput;
        endDate: DateInput;
      }
    | DateInput,
  arg2?: DateInput,
) {
  if (arg1 && typeof arg1 === "object" && "startDate" in arg1) {
    return calculateBusinessDaysCore(arg1 as { startDate: DateInput; endDate: DateInput });
  }
  return calculateBusinessDaysCore({
    startDate: arg1 as DateInput,
    endDate: arg2 as DateInput,
  });
}
// Compatibility shim: supports both calculateBusinessDays({ startDate, endDate }) and calculateBusinessDays(startDate, endDate).
export function calculateBusinessDaysCompat(
  arg1:
    | {
        startDate: DateInput;
        endDate: DateInput;
      }
    | DateInput,
  arg2?: DateInput,
) {
  if (arg1 && typeof arg1 === "object" && "startDate" in arg1) {
    return calculateBusinessDaysCore(arg1 as { startDate: DateInput; endDate: DateInput });
  }
  return calculateBusinessDaysCore({
    startDate: arg1 as DateInput,
    endDate: arg2 as DateInput,
  });
}
// --
function getDateRangeInclusiveCore({ start, end }: DateDiffInclusive) {
  const dates = [];
  const current = parseDateOnly(start);
  const to = parseDateOnly(end);

  while (current <= to) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
export function getDateRangeInclusive(
  arg1: DateDiffInclusive | DateInput,
  arg2?: DateInput,
) {
  if (arg1 && typeof arg1 === "object" && "start" in arg1 && "end" in arg1) {
    return getDateRangeInclusiveCore(arg1 as DateDiffInclusive);
  }
  return getDateRangeInclusiveCore({
    start: arg1 as DateInput,
    end: arg2 as DateInput,
  });
}
// Compatibility shim: supports both getDateRangeInclusive({ start, end }) and getDateRangeInclusive(start, end).
export function getDateRangeInclusiveCompat(
  arg1: DateDiffInclusive | DateInput,
  arg2?: DateInput,
) {
  if (arg1 && typeof arg1 === "object" && "start" in arg1 && "end" in arg1) {
    return getDateRangeInclusiveCore(arg1 as DateDiffInclusive);
  }
  return getDateRangeInclusiveCore({
    start: arg1 as DateInput,
    end: arg2 as DateInput,
  });
}

// --

// --
export function isFutureDateString(dateValue: DateInput) {
  if (!dateValue) return false;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return false;
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return target > today;
}
