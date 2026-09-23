const exitInterviewQuestions = [
  "What caused you to start looking for a new job?",
  "Why have you decided to leave the company?",
  "Was a single event responsible for your decision to leave?",
  "What does your new company offer that influenced your decision?",
  "What do you value about this company?",
  "What did you dislike about the company?",
  "How was your relationship with your manager?",
  "What could your supervisor improve in their management style?",
  "What did you like most about your job?",
  "What did you dislike about your job? What would you change?",
  "Did you have the resources and support needed to do your job? If not, what was missing?",
  "Were your goals clear and expectations well defined?",
  "Did you receive adequate feedback on your performance?",
  "Did you feel aligned with the company’s mission and goals?",
  "Any recommendations regarding compensation, benefits, or recognition?",
  "What would make you consider returning? Would you recommend this company to others?",
];

const reviewBadgeClass = {
  Approved: "bg-green-100 text-green-800",
  Denied: "bg-red-100 text-red-800",
  Pending: "bg-yellow-100 text-yellow-800",
  "Pending Approval": "bg-yellow-100 text-yellow-800",
  "Cancellation Requested": "bg-amber-100 text-amber-800",
  Rejected: "bg-red-100 text-red-800",
  "Partially Approved": "bg-amber-100 text-amber-800",
};

function getResignationProgressPercent(item) {
  const totalSteps = 5;
  const step = Math.max(
    1,
    Math.min(Number(item?.current_step || totalSteps), totalSteps),
  );
  return {
    step,
    percent: Math.round((step / totalSteps) * 100),
    totalSteps,
  };
}

export default function ReviewResigApp({
  reviewData,
  onClose,
  onKeepPending,
  onFinalApprove,
  isApproving,
  onPreviewEndorsement,
}) {
  if (!reviewData) return null;

  const progress = getResignationProgressPercent(reviewData.item);

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/55 p-4">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
          <div>
            <h3 className="m-0 text-base font-bold text-gray-900">
              Resignation Supervisor Review
            </h3>
            <p className="m-0 mt-1 text-xs font-medium text-gray-600">
              {reviewData.item.first_name} {reviewData.item.last_name} •{" "}
              {reviewData.item.resignation_type || "Resignation"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-lg text-gray-500 hover:text-gray-700"
          >
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-sm font-semibold text-gray-800">
                Current Progress: Step {progress.step} of {progress.totalSteps}
              </p>
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${reviewBadgeClass[reviewData.item.status] || "bg-gray-100 text-gray-700"}`}
              >
                {reviewData.item.status || "Pending Approval"}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="m-0 text-xs font-bold uppercase tracking-wider text-gray-500">
              Step 1 • Resignation Letter
            </p>
            <p className="m-0 mt-2 whitespace-pre-wrap text-sm text-gray-800">
              {reviewData.item.resignation_letter ||
                "No resignation letter provided."}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="m-0 text-xs font-bold uppercase tracking-wider text-gray-500">
              Step 2 • Employee Resignation Form
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-800 md:grid-cols-2">
              <p className="m-0">
                <span className="font-semibold">Recipient:</span>{" "}
                {reviewData.item.recipient_name || "-"}
              </p>
              <p className="m-0">
                <span className="font-semibold">Resignation Date:</span>{" "}
                {reviewData.item.resignation_date
                  ? new Date(
                      reviewData.item.resignation_date,
                    ).toLocaleDateString()
                  : "-"}
              </p>
              <p className="m-0">
                <span className="font-semibold">Last Working Day:</span>{" "}
                {reviewData.item.last_working_day
                  ? new Date(
                      reviewData.item.last_working_day,
                    ).toLocaleDateString()
                  : "-"}
              </p>
              <p className="m-0">
                <span className="font-semibold">Effective Date:</span>{" "}
                {reviewData.item.effective_date
                  ? new Date(
                      reviewData.item.effective_date,
                    ).toLocaleDateString()
                  : "-"}
              </p>
            </div>

            <div className="mt-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Reasons for Leaving
              </p>
              {reviewData.leavingReasons.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reviewData.leavingReasons.map((reason) => (
                    <span
                      key={reason}
                      className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="m-0 mt-2 text-sm text-gray-600">-</p>
              )}
              {reviewData.item.leaving_reason_other && (
                <p className="m-0 mt-2 text-sm text-gray-700">
                  <span className="font-semibold">Others:</span>{" "}
                  {reviewData.item.leaving_reason_other}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="m-0 text-xs font-bold uppercase tracking-wider text-gray-500">
              Step 3 • Exit Interview Responses
            </p>
            <p className="m-0 mt-2 text-sm text-gray-700">
              Completed answers:{" "}
              {
                reviewData.interviewAnswers.filter((answer) =>
                  String(answer || "").trim(),
                ).length
              }
              /16
            </p>
            <div className="mt-3 space-y-2">
              {exitInterviewQuestions.map((question, index) => (
                <div
                  key={question}
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <p className="m-0 text-xs font-semibold text-gray-700">
                    {index + 1}. {question}
                  </p>
                  <p className="m-0 mt-1 whitespace-pre-wrap text-sm text-gray-800">
                    {reviewData.interviewAnswers[index] || "No response."}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="m-0 text-xs font-bold uppercase tracking-wider text-gray-500">
              Step 4 • Endorsement Form Submission
            </p>
            <p className="m-0 mt-2 text-sm text-gray-800">
              <span className="font-semibold">File Key:</span>{" "}
              {reviewData.item.endorsement_file_key || "Not uploaded"}
            </p>
            {reviewData.item.endorsement_file_key && (
              <button
                type="button"
                onClick={() =>
                  onPreviewEndorsement(reviewData.item.endorsement_file_key)
                }
                className="mt-2 rounded-md border border-indigo-200 bg-indigo-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-200"
              >
                Download Endorsement File
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onKeepPending}
            className="rounded-md border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-200"
          >
            Keep Pending (Under Review)
          </button>
          <button
            type="button"
            disabled={isApproving}
            onClick={onFinalApprove}
            className="rounded-md border border-emerald-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Final Approve
          </button>
        </div>
      </div>
    </div>
  );
}
