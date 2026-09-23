import CancelApprovalConfirmModalContent from "./CancelApprovalConfirmModalContent ";
import CancelApprovalConfirmModalFooter from "./CancelApprovalConfirmModalFooter";
import CancelApprovalConfirmModalHeader from "./CancelApprovalConfirmModalHeader";

export default function CancelApprovalConfirmModal({
  cancelApprovalConfirm,
  setCancelApprovalConfirm,
  requestCancellationApprovalMutation,
  submitCancellationRequest,
}) {
  return (
    <>
      {cancelApprovalConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <CancelApprovalConfirmModalHeader />
            <CancelApprovalConfirmModalContent
              cancelApprovalConfirm={cancelApprovalConfirm}
              setCancelApprovalConfirm={setCancelApprovalConfirm}
            />
            <CancelApprovalConfirmModalFooter
              cancelApprovalConfirm={cancelApprovalConfirm}
              setCancelApprovalConfirm={setCancelApprovalConfirm}
              requestCancellationApprovalMutation={
                requestCancellationApprovalMutation
              }
              submitCancellationRequest={submitCancellationRequest}
            />
          </div>
        </div>
      )}
    </>
  );
}
