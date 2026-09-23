import MyPendingRequestsModalHeader from "./MyPendingRequestsModalHeader";
import MyPendingRequestsTable from "./MyPendingRequestsTable";

export default function MyPendingRequestsModal({
  myPendingModalOpen,
  setMyPendingModalOpen,
  myRequestRows,
  cancelMyPendingRequestMutation,
  setCancelPendingConfirm,
  requestCancellationApprovalMutation,
  setCancelApprovalConfirm,
}) {
  return (
    <>
      {myPendingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <MyPendingRequestsModalHeader
              setMyPendingModalOpen={setMyPendingModalOpen}
            />

            <div className="max-h-[72vh] overflow-auto">
              <MyPendingRequestsTable
                myRequestRows={myRequestRows}
                cancelMyPendingRequestMutation={cancelMyPendingRequestMutation}
                setCancelPendingConfirm={setCancelPendingConfirm}
                requestCancellationApprovalMutation={
                  requestCancellationApprovalMutation
                }
                setCancelApprovalConfirm={setCancelApprovalConfirm}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
