export default function MyPendingRequestsModalHeader({
  setMyPendingModalOpen,
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
      <h3 className="m-0 text-base font-bold text-gray-900">
        My Pending Requests
      </h3>
      <button
        onClick={() => setMyPendingModalOpen(false)}
        className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-lg text-gray-500 hover:text-gray-700"
      >
        &times;
      </button>
    </div>
  );
}
