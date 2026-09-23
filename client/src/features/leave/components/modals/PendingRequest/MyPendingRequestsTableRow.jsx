import { Button } from "@/components/ui/button";
import { badgeClass } from "@/features/leave/leaveConstants";

export default function MyPendingRequestsTableRow({
  item,

  cancelMyPendingRequestMutation,
  setCancelPendingConfirm,
  requestCancellationApprovalMutation,
  setCancelApprovalConfirm,
}) {
  console.log(item);
  return (
    <tr className="transition-colors hover:bg-gray-50/50">
      <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">
        {item.request_group === "resignation"
          ? `Resignation - ${item.unified_type}`
          : item.request_group === "offset"
            ? Number(item.days_applied || 0) > 0
              ? `Offset (${Number(item.days_applied || 0).toFixed(2)} days)`
              : "Offset"
            : item.unified_type}
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-700">
        {item.request_group === "resignation"
          ? item.effective_date
            ? new Date(item.effective_date).toLocaleDateString()
            : "N/A"
          : `${new Date(item.date_from).toLocaleDateString()} - ${new Date(item.date_to).toLocaleDateString()}`}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${badgeClass[item.row_status] || "bg-yellow-100 text-yellow-800"}`}
        >
          {item.row_status}
        </span>
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
        {item.row_action === "cancel_pending" && (
          <button
            type="button"
            disabled={cancelMyPendingRequestMutation.isPending}
            onClick={() => setCancelPendingConfirm(item)}
            className="rounded-md border border-red-200 bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel Request
          </button>
        )}
        {item.row_action === "request_cancel_approval" && (
          <button
            type="button"
            disabled={requestCancellationApprovalMutation.isPending}
            onClick={() => {
              setCancelApprovalConfirm({
                item,
                reason: "",
              });
            }}
            className="rounded-md border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Request Cancellation Approval
          </button>
        )}
        {item.row_action === "cancel_waiting_approval" && (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
            Awaiting Approval
          </span>
        )}
      </td>
    </tr>
  );
}
