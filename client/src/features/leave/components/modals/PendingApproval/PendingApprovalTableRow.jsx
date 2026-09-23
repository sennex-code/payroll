export default function PendingApprovalTableRow({
  item,
  isHRRole,
  canHrDirectDecision,
  isPendingApprovalStatus,
  openResignationDecisionConfirm,
  openResignationReview,
  openLeaveDecisionConfirm,
  openOffsetDecisionConfirm,
  setHrNoteConfirm,
  setPendingModalOpen,
}) {
  const isCancellationRequest =
    Boolean(item.cancellation_requested_at) &&
    !isPendingApprovalStatus(item.status);
  const canDirectDecision = !isHRRole || canHrDirectDecision(item);

  return (
    <tr className="transition-colors hover:bg-gray-50/50">
      <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">
        {item.first_name} {item.last_name}
      </td>
      <td className="px-4 py-2.5 text-sm font-bold text-indigo-700">
        {item.request_group === "resignation"
          ? `${isCancellationRequest ? "Cancellation • " : "Resignation • "}${item.unified_type}`
          : `${isCancellationRequest ? "Cancellation • " : ""}${item.unified_type}${item.isOffset && Number(item.days_applied || 0) > 0 ? ` (${Number(item.days_applied || 0).toFixed(2)} days)` : ""}`}
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-700">
        {item.request_group === "resignation"
          ? item.effective_date
            ? new Date(item.effective_date).toLocaleDateString()
            : "N/A"
          : `${new Date(item.date_from).toLocaleDateString()} - ${new Date(item.date_to).toLocaleDateString()}`}
      </td>
      <td className="max-w-65 px-4 py-2.5 text-xs text-gray-700">
        {isCancellationRequest
          ? item.cancellation_reason || "-"
          : item.hr_note || "-"}
      </td>
      <td className="px-4 py-2.5 text-xs font-medium text-gray-600">
        {item.cancellation_requested_at
          ? new Date(item.cancellation_requested_at).toLocaleString()
          : "-"}
      </td>
      <td className="px-4 py-2.5 text-xs font-medium text-gray-600">
        {item.ocp ? (
          <a
            download
            href={`${item.ocp}`}
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download
          </a>
        ) : (
          "N/A"
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {canDirectDecision ? (
          item.request_group === "resignation" && !isCancellationRequest ? (
            <button
              type="button"
              onClick={() => openResignationReview(item)}
              className="rounded-md border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-200"
            >
              Review Application
            </button>
          ) : (
            <div className="inline-flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const decisionMode = isCancellationRequest
                    ? "cancellation"
                    : "application";
                  if (item.request_group === "resignation") {
                    openResignationDecisionConfirm(
                      item,
                      "Approved",
                      decisionMode,
                    );
                    setPendingModalOpen(false);
                    return;
                  }
                  item.isOffset
                    ? openOffsetDecisionConfirm(item, "Approved", decisionMode)
                    : openLeaveDecisionConfirm(item, "Approved", decisionMode);
                  setPendingModalOpen(false);
                }}
                className="rounded-md border border-green-200 bg-green-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700 hover:bg-green-200"
              >
                {isCancellationRequest ? "Approve Cancel" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const decisionMode = isCancellationRequest
                    ? "cancellation"
                    : "application";
                  if (item.request_group === "resignation") {
                    openResignationDecisionConfirm(
                      item,
                      "Denied",
                      decisionMode,
                    );
                    setPendingModalOpen(false);
                    return;
                  }
                  item.isOffset
                    ? openOffsetDecisionConfirm(item, "Denied", decisionMode)
                    : openLeaveDecisionConfirm(item, "Denied", decisionMode);
                  setPendingModalOpen(false);
                }}
                className="rounded-md border border-red-200 bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-700 hover:bg-red-200"
              >
                {isCancellationRequest ? "Keep Request" : "Deny"}
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={() =>
              setHrNoteConfirm({
                item,
                note: item.hr_note || "",
                module:
                  item.request_group === "resignation"
                    ? "resignation"
                    : item.isOffset
                      ? "offset"
                      : "leave",
              })
            }
            className="rounded-md border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-200"
          >
            Add HR Note
          </button>
        )}
      </td>
    </tr>
  );
}
