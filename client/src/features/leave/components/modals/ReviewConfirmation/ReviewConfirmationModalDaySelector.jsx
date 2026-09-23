export default function ReviewConfirmationModalDaySelector({
  reviewConfirm,
  getDateRangeInclusive,
  toggleLeaveApprovedDate,
  parseDateOnly,
}) {
  return (
    <>
      {reviewConfirm.module === "leave" &&
        reviewConfirm.decisionMode !== "cancellation" &&
        reviewConfirm.status === "Approved" &&
        reviewConfirm.isMultiDay && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="m-0 mb-2 text-xs font-bold uppercase tracking-wider text-amber-800">
              Select specific days to approve
            </p>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {getDateRangeInclusive(
                reviewConfirm.item.date_from,
                reviewConfirm.item.date_to,
              ).map((date) => (
                <label
                  key={date}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={(reviewConfirm.selectedDates || []).includes(date)}
                    onChange={() => toggleLeaveApprovedDate(date)}
                  />
                  <span>{parseDateOnly(date).toLocaleDateString()}</span>
                </label>
              ))}
            </div>
          </div>
        )}
    </>
  );
}
