export default function ReviewConfirmationModalNotes({ reviewConfirm }) {
  return (
    <>
      {reviewConfirm.decisionMode === "cancellation" && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Submitted Cancellation Reason
          </p>
          <p className="m-0 mt-1 text-sm text-amber-900">
            {reviewConfirm.item.cancellation_reason || "No reason provided."}
          </p>
        </div>
      )}

      {reviewConfirm.item.hr_note && (
        <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-indigo-800">
            HR Note
          </p>
          <p className="m-0 mt-1 text-sm text-indigo-900">
            {reviewConfirm.item.hr_note}
          </p>
        </div>
      )}
    </>
  );
}
