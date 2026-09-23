export default function PendingApprovalFilterTabs({
  pendingTypeFilter,
  setPendingTypeFilter,
  allPendingRequests,
  pendingLeaveApprovals,
  pendingOffsetApprovals,
  pendingResignationApprovals,
}) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap gap-1.5 border-b border-gray-200 bg-white px-4 py-2">
      <button
        type="button"
        onClick={() => setPendingTypeFilter("all")}
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${pendingTypeFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
      >
        All ({allPendingRequests.length})
      </button>
      <button
        type="button"
        onClick={() => setPendingTypeFilter("leave")}
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${pendingTypeFilter === "leave" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
      >
        Leave ({pendingLeaveApprovals.length})
      </button>
      <button
        type="button"
        onClick={() => setPendingTypeFilter("offset")}
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${pendingTypeFilter === "offset" ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-700 hover:bg-sky-100"}`}
      >
        Offset ({pendingOffsetApprovals.length})
      </button>
      <button
        type="button"
        onClick={() => setPendingTypeFilter("resignation")}
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${pendingTypeFilter === "resignation" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
      >
        Resignation ({pendingResignationApprovals.length})
      </button>
    </div>
  );
}
