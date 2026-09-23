import { useState } from "react";
import { apiFetch } from "@/lib/api";
import ReviewResigApp from "../../forms/ReviewResigApp";
import PendingApprovalFilterTabs from "./PendingApprovalFilterTabs";
import PendingApprovalModalHeader from "./PendingApprovalHeader";
import PendingApprovalTable from "./PendingApprovalTable";

export default function PendingApprovalModal({
  pendingModalOpen,
  isApprover,
  setPendingModalOpen,
  pendingTypeFilter,
  setPendingTypeFilter,
  allPendingRequests,
  pendingLeaveApprovals,
  pendingOffsetApprovals,
  pendingResignationApprovals,
  filteredPendingRequests,
  isHRRole,
  canHrDirectDecision,
  isPendingApprovalStatus,
  openResignationDecisionConfirm,
  openLeaveDecisionConfirm,
  openOffsetDecisionConfirm,
  setHrNoteConfirm,
  reviewResignationMutation,
  showToast,
}) {
  const [resignationReviewData, setResignationReviewData] = useState(null);

  const parseMaybeArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const openResignationReview = (item) => {
    setResignationReviewData({
      item,
      leavingReasons: parseMaybeArray(item.leaving_reasons_json),
      interviewAnswers: parseMaybeArray(item.exit_interview_answers_json),
    });
    setPendingModalOpen(false);
  };

  const closeResignationReview = () => setResignationReviewData(null);

  const downloadEndorsementFile = async (fileKey) => {
    if (!fileKey) return;

    try {
      const res = await apiFetch(
        `/api/file/get?filename=${encodeURIComponent(fileKey)}`,
      );

      if (!res.ok) {
        throw new Error("Failed to retrieve endorsement file.");
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${fileKey.split("_").pop() || "endorsement-file"}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      showToast?.(
        error.message || "Unable to download endorsement file.",
        "error",
      );
    }
  };

  const finalApproveResignation = () => {
    if (!resignationReviewData?.item || !reviewResignationMutation?.mutate) {
      return;
    }

    reviewResignationMutation.mutate(
      {
        id: resignationReviewData.item.id,
        item: resignationReviewData.item,
        status: "Approved",
      },
      {
        onSuccess: () => {
          closeResignationReview();
          showToast?.("Resignation application approved.");
        },
      },
    );
  };

  return (
    <>
      {pendingModalOpen && isApprover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <PendingApprovalModalHeader
              setPendingModalOpen={setPendingModalOpen}
            />
            <div className="max-h-[72vh] overflow-auto">
              <PendingApprovalFilterTabs
                pendingTypeFilter={pendingTypeFilter}
                setPendingTypeFilter={setPendingTypeFilter}
                allPendingRequests={allPendingRequests}
                pendingLeaveApprovals={pendingLeaveApprovals}
                pendingOffsetApprovals={pendingOffsetApprovals}
                pendingResignationApprovals={pendingResignationApprovals}
              />
              <PendingApprovalTable
                filteredPendingRequests={filteredPendingRequests}
                isHRRole={isHRRole}
                canHrDirectDecision={canHrDirectDecision}
                isPendingApprovalStatus={isPendingApprovalStatus}
                openResignationDecisionConfirm={openResignationDecisionConfirm}
                openResignationReview={openResignationReview}
                openLeaveDecisionConfirm={openLeaveDecisionConfirm}
                openOffsetDecisionConfirm={openOffsetDecisionConfirm}
                setHrNoteConfirm={setHrNoteConfirm}
                setPendingModalOpen={setPendingModalOpen}
              />
            </div>
          </div>
        </div>
      )}

      <ReviewResigApp
        reviewData={resignationReviewData}
        onClose={closeResignationReview}
        onKeepPending={closeResignationReview}
        onFinalApprove={finalApproveResignation}
        isApproving={Boolean(reviewResignationMutation?.isPending)}
        onPreviewEndorsement={downloadEndorsementFile}
      />
    </>
  );
}
