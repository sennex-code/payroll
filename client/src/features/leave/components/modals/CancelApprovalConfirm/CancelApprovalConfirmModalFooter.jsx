export default function CancelApprovalConfirmModalFooter({
  cancelApprovalConfirm,
  setCancelApprovalConfirm,
  requestCancellationApprovalMutation,
  submitCancellationRequest,
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
      <button
        type="button"
        onClick={() => setCancelApprovalConfirm(null)}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Close
      </button>
      <button
        type="button"
        disabled={requestCancellationApprovalMutation.isPending}
        onClick={() => {
          submitCancellationRequest(
            cancelApprovalConfirm.item,
            cancelApprovalConfirm.reason,
          );
          if (String(cancelApprovalConfirm.reason || "").trim()) {
            setCancelApprovalConfirm(null);
          }
        }}
        className="rounded-md border border-amber-700 bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Confirm Submit
      </button>
    </div>
  );
}
