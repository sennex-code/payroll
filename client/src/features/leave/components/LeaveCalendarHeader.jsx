import React from "react";

const LeaveCalendarHeader = ({
  scopeOptions,
  onScopeChange,
  monthName,
  prevMonth,
  nextMonth,
  activeScope,
}) => {
  return (
    <div className="bg-linear-to-r from-indigo-700 via-indigo-600 to-sky-600 px-4 py-3 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="m-0 text-base font-bold">Applications Calendar</h4>
          <p className="m-0 mt-1 text-xs text-white/90">
            View leave applications and attendance logs by day.
          </p>
        </div>
        {scopeOptions.length > 1 && (
          <div className="inline-flex rounded-lg border border-white/25 bg-white/10 p-1">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onScopeChange?.(option.value)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  activeScope === option.value
                    ? "bg-white text-indigo-700"
                    : "text-white hover:bg-white/15"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          onClick={prevMonth}
        >
          ◀ Prev
        </button>
        <h3 className="m-0 text-white font-bold text-slate-800">{monthName}</h3>
        <button
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          onClick={nextMonth}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
};

export default React.memo(LeaveCalendarHeader);
