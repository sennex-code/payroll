export default function CancelApprovalConfirmModalContent({
  cancelApprovalConfirm,
  setCancelApprovalConfirm,
}) {
  return (
    <div className="space-y-3 px-4 py-3">
      <p className="m-0 text-sm text-gray-700">
        Submit this cancellation request for approver review?
      </p>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
          Reason (required)
        </label>
        <textarea
          rows={3}
          value={cancelApprovalConfirm.reason}
          onChange={(e) =>
            setCancelApprovalConfirm({
              ...cancelApprovalConfirm,
              reason: e.target.value,
            })
          }
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
          placeholder="Enter cancellation reason"
        />
      </div>
    </div>
  );
}
