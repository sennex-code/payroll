export default function CancelPendingConfirmModalContent() {
  return (
    <div className="space-y-2 px-4 py-3">
      <p className="m-0 text-sm text-gray-700">
        Are you sure you want to cancel this pending request?
      </p>
      <p className="m-0 text-xs text-gray-500">
        This action will remove the pending request.
      </p>
    </div>
  );
}
