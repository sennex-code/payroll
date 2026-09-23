import PendingApprovalTableRow from "./PendingApprovalTableRow";

export default function PendingApprovalTable({
  filteredPendingRequests,
  isHRRole,
  canHrDirectDecision,
  isPendingApprovalStatus,
  openResignationDecisionConfirm,
  openResignationReview,
  openLeaveDecisionConfirm,
  openOffsetDecisionConfirm,
  setHrNoteConfirm,
  setPendingModalOpen,
}) {
  console.log(filteredPendingRequests);
  return (
    <table className="w-full text-sm text-left">
      <thead className="sticky top-[43px] z-10 bg-white">
        <tr className="border-b border-gray-200">
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Employee
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Request Type
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Schedule
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Cancellation Reason / HR Note
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Cancel Requested At
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            OCP
          </th>
          <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Action
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {filteredPendingRequests.length === 0 ? (
          <tr>
            <td
              colSpan="6"
              className="px-4 py-8 text-center text-sm font-medium text-gray-500"
            >
              No pending requests for the selected filter.
            </td>
          </tr>
        ) : (
          filteredPendingRequests.map((item) => (
            <PendingApprovalTableRow
              key={`${item.request_group}-${item.isOffset ? "offset" : "leave"}-${item.id}`}
              item={item}
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
          ))
        )}
      </tbody>
    </table>
  );
}
