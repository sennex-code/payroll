export default function HrNoteConfirmModalFooter({
  hrNoteConfirm,
  setHrNoteConfirm,
  addHrNoteMutation,
  showToast,
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
      <button
        type="button"
        onClick={() => setHrNoteConfirm(null)}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Close
      </button>
      <button
        type="button"
        disabled={addHrNoteMutation.isPending}
        onClick={() => {
          const trimmedNote = String(hrNoteConfirm.note || "").trim();
          if (!trimmedNote) {
            showToast("HR note is required.", "error");
            return;
          }
          addHrNoteMutation.mutate({
            module: hrNoteConfirm.module,
            id: hrNoteConfirm.item.id,
            note: trimmedNote,
          });
          setHrNoteConfirm(null);
        }}
        className="rounded-md border border-indigo-700 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Save & Notify
      </button>
    </div>
  );
}
