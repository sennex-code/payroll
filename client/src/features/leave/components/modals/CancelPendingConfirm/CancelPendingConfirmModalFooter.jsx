export default function CancelPendingConfirmModalFooter({
  cancelPendingConfirm,
  setCancelPendingConfirm,
  cancelMyPendingRequestMutation,
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
      <button
        type="button"
        onClick={() => setCancelPendingConfirm(null)}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Close
      </button>
      <button
        type="button"
        disabled={cancelMyPendingRequestMutation.isPending}
        onClick={() => {
          cancelMyPendingRequestMutation.mutate(cancelPendingConfirm);
          setCancelPendingConfirm(null);
        }}
        className="rounded-md border border-red-700 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Confirm Cancel
      </button>
    </div>
  );
}
