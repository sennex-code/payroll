export default function ReviewConfirmationModalHeader({ reviewConfirm }) {
  return (
    <>
      <h2 className="m-0 mb-2 text-lg font-semibold text-gray-900">
        {reviewConfirm.decisionMode === "cancellation"
          ? reviewConfirm.status === "Denied"
            ? "Decline Cancellation Request"
            : "Approve Cancellation Request"
          : reviewConfirm.status === "Denied"
            ? "Confirm Denial"
            : "Confirm Approval"}
      </h2>
      <p className="m-0 mb-4 text-sm text-gray-600">
        {reviewConfirm.item.first_name} {reviewConfirm.item.last_name}
        {reviewConfirm.module === "resignation"
          ? ` • ${reviewConfirm.item.resignation_type}`
          : ` • ${new Date(reviewConfirm.item.date_from).toLocaleDateString()} - ${new Date(reviewConfirm.item.date_to).toLocaleDateString()}`}
      </p>
    </>
  );
}
