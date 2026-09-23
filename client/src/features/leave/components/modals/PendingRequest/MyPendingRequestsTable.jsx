import MyPendingRequestsTableRow from "./MyPendingRequestsTableRow";

export default function MyPendingRequestsTable({
  myRequestRows,

  cancelMyPendingRequestMutation,
  setCancelPendingConfirm,
  requestCancellationApprovalMutation,
  setCancelApprovalConfirm,
}) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="sticky top-0 z-10 bg-white">
        <tr className="border-b border-gray-200">
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Request Type
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Schedule
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Status
          </th>
          <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Cancel Requested At
          </th>
          <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500">
            OCP
          </th>
          <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Action
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {myRequestRows.length === 0 ? (
          <tr>
            <td
              colSpan="5"
              className="px-4 py-8 text-center text-sm font-medium text-gray-500"
            >
              You have no active request actions.
            </td>
          </tr>
        ) : (
          myRequestRows.map((item) => (
            <MyPendingRequestsTableRow
              key={`${item.request_group}-${item.id}`}
              item={item}
              cancelMyPendingRequestMutation={cancelMyPendingRequestMutation}
              setCancelPendingConfirm={setCancelPendingConfirm}
              requestCancellationApprovalMutation={
                requestCancellationApprovalMutation
              }
              setCancelApprovalConfirm={setCancelApprovalConfirm}
            />
          ))
        )}
      </tbody>
    </table>
  );
}
