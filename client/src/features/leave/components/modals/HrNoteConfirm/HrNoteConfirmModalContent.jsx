export default function HrNoteConfirmModalContent({
  hrNoteConfirm,
  setHrNoteConfirm,
}) {
  return (
    <div className="space-y-3 px-4 py-3">
      <p className="m-0 text-sm text-gray-700">
        Add guidance so supervisors under this designation can review this
        request.
      </p>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
          HR Note (required)
        </label>
        <textarea
          rows={3}
          value={hrNoteConfirm.note}
          onChange={(e) =>
            setHrNoteConfirm({
              ...hrNoteConfirm,
              note: e.target.value,
            })
          }
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter HR note for supervisor review"
        />
      </div>
    </div>
  );
}
