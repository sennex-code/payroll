export default function ReviewConfirmationModalFooter({
  reviewConfirm,
  setReviewConfirm,
  submitReviewDecision,
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => setReviewConfirm(null)}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={submitReviewDecision}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${reviewConfirm.status === "Denied" ? "bg-red-600" : "bg-green-600"}`}
      >
        Confirm
      </button>
    </div>
  );
}
