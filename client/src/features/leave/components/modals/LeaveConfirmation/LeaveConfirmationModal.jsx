import LeaveConfirmationModalContent from "./LeaveConfirmationContent";
import LeaveConfirmationModalFooter from "./LeaveConfirmationFooter";
import LeaveConfirmationModalHeader from "./LeaveConfirmationModalHeader";

export default function LeaveConfirmationModal({
  confirmAction,
  setConfirmAction,
  fileOffsetMutation,
  submitLeaveMutation,
  formData,
}) {
  return (
    <>
      {confirmAction && confirmAction.type === "leave" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <LeaveConfirmationModalHeader />
            <LeaveConfirmationModalContent confirmAction={confirmAction} />
            <LeaveConfirmationModalFooter
              confirmAction={confirmAction}
              setConfirmAction={setConfirmAction}
              fileOffsetMutation={fileOffsetMutation}
              submitLeaveMutation={submitLeaveMutation}
              formData={formData}
            />
          </div>
        </div>
      )}
    </>
  );
}
