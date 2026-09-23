import HrNoteConfirmModalContent from "./HrNoteConfirmModalContent";
import HrNoteConfirmModalFooter from "./HrNoteConfirmModalFooter";
import HrNoteConfirmModalHeader from "./HrNoteConfirmModalHeader";

export default function HrNoteConfirmModal({
  hrNoteConfirm,
  setHrNoteConfirm,
  addHrNoteMutation,
  showToast,
}) {
  return (
    <>
      {hrNoteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <HrNoteConfirmModalHeader />
            <HrNoteConfirmModalContent
              hrNoteConfirm={hrNoteConfirm}
              setHrNoteConfirm={setHrNoteConfirm}
            />
            <HrNoteConfirmModalFooter
              hrNoteConfirm={hrNoteConfirm}
              setHrNoteConfirm={setHrNoteConfirm}
              addHrNoteMutation={addHrNoteMutation}
              showToast={showToast}
            />
          </div>
        </div>
      )}
    </>
  );
}
