export default function ReviewConfirmationModalDenialReason({
  reviewConfirm,
  setReviewConfirm,
}) {
  return (
    <>
      {reviewConfirm.status === "Denied" && (
        <div className="mb-5">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
            Reason (required)
          </label>
          <textarea
            rows={3}
            value={reviewConfirm.remarks}
            onChange={(e) =>
              setReviewConfirm({
                ...reviewConfirm,
                remarks: e.target.value,
              })
            }
            className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      )}
    </>
  );
}
