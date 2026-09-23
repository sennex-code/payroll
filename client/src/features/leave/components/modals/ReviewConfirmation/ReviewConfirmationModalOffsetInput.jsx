export default function ReviewConfirmationModalOffsetInput({
  reviewConfirm,
  setReviewConfirm,
  getOffsetRequestedDays,
}) {
  return (
    <>
      {reviewConfirm.module === "offset" &&
        reviewConfirm.decisionMode !== "cancellation" &&
        reviewConfirm.status === "Approved" &&
        reviewConfirm.isMultiDay && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="m-0 mb-2 text-xs font-bold uppercase tracking-wider text-amber-800">
              Set approved offset days
            </p>
            <input
              type="number"
              min="0.5"
              step="0.5"
              max={getOffsetRequestedDays(reviewConfirm.item)}
              value={reviewConfirm.approvedDays}
              onChange={(e) =>
                setReviewConfirm({
                  ...reviewConfirm,
                  approvedDays: e.target.value,
                })
              }
              className="w-full rounded-md border border-amber-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}
    </>
  );
}
