export default function LeaveConfirmationModalContent({ confirmAction }) {
  return (
    <div className="mb-6 space-y-3 text-sm">
      <div>
        <p className="m-0 text-gray-600 font-medium">Type:</p>
        <p className="m-0 text-purple-700 font-bold">
          {confirmAction.leaveType}
        </p>
      </div>
      <div>
        <p className="m-0 text-gray-600 font-medium">Dates:</p>
        <p className="m-0 text-gray-900 font-semibold">
          {new Date(confirmAction.fromDate).toLocaleDateString()} to{" "}
          {new Date(confirmAction.toDate).toLocaleDateString()}
        </p>
      </div>
      {confirmAction.leaveType === "Offset" && (
        <div>
          <p className="m-0 text-gray-600 font-medium">Applied Amount:</p>
          <p className="m-0 text-gray-900 font-semibold">
            {confirmAction.daysApplied} Days/Hours
          </p>
        </div>
      )}
    </div>
  );
}
