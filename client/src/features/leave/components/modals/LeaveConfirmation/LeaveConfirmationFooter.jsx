export default function LeaveConfirmationModalFooter({
  confirmAction,
  setConfirmAction,
  fileOffsetMutation,
  submitLeaveMutation,
  formData,
}) {
  return (
    <div className="flex gap-3 justify-end">
      <button
        type="button"
        onClick={() => setConfirmAction(null)}
        className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-50 shadow-sm"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirmAction.leaveType === "Offset") {
            console.log(confirmAction);
            fileOffsetMutation.mutate({
              date_from: confirmAction.fromDate,
              date_to: confirmAction.toDate,
              days_applied: parseFloat(confirmAction.daysApplied),
              reason: confirmAction.reason,
            });
          } else {
            submitLeaveMutation.mutate({
              Ocp: formData.OCP,
              emp_id: formData.emp_id,
              leave_type: formData.leaveType,
              date_from: formData.fromDate,
              date_to: formData.toDate,
              priority: formData.priority,
              supervisor_remarks: formData.reason,
            });
          }
          setConfirmAction(null);
        }}
        className="px-4 py-2.5 rounded-lg bg-green-600 border-0 text-white text-sm font-medium cursor-pointer hover:bg-green-700 shadow-sm"
      >
        Submit Application
      </button>
    </div>
  );
}
