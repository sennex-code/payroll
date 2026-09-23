import ReviewConfirmationModalDaySelector from "./ReviewConfirmationModalDaySelector";
import ReviewConfirmationModalDenialReason from "./ReviewConfirmationModalDenialReason";
import ReviewConfirmationModalFooter from "./ReviewConfirmationModalFooter";
import ReviewConfirmationModalHeader from "./ReviewConfirmationModalHeader";
import ReviewConfirmationModalNotes from "./ReviewConfirmationModalNotes";
import ReviewConfirmationModalOffsetInput from "./ReviewConfirmationModalOffsetInput";

export default function ReviewConfirmationModal({
  reviewConfirm,
  setReviewConfirm,
  getDateRangeInclusive,
  toggleLeaveApprovedDate,
  parseDateOnly,
  getOffsetRequestedDays,
  submitReviewDecision,
}) {
  return (
    <>
      {reviewConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <ReviewConfirmationModalHeader reviewConfirm={reviewConfirm} />
            <ReviewConfirmationModalNotes reviewConfirm={reviewConfirm} />

            <ReviewConfirmationModalDaySelector
              reviewConfirm={reviewConfirm}
              getDateRangeInclusive={getDateRangeInclusive}
              toggleLeaveApprovedDate={toggleLeaveApprovedDate}
              parseDateOnly={parseDateOnly}
            />

            <ReviewConfirmationModalOffsetInput
              reviewConfirm={reviewConfirm}
              setReviewConfirm={setReviewConfirm}
              getOffsetRequestedDays={getOffsetRequestedDays}
            />

            <ReviewConfirmationModalDenialReason
              reviewConfirm={reviewConfirm}
              setReviewConfirm={setReviewConfirm}
            />

            <ReviewConfirmationModalFooter
              reviewConfirm={reviewConfirm}
              setReviewConfirm={setReviewConfirm}
              submitReviewDecision={submitReviewDecision}
            />
          </div>
        </div>
      )}
    </>
  );
}
