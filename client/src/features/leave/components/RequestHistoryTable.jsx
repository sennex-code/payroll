import { badgeClass } from "../leaveConstants";

export default function RequestHistoryTable({ myRequestHistory }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h3 className="m-0 text-sm font-bold text-gray-900">
          History of Leave / Offset / Resignation123123
        </h3>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Request Type
              </th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Schedule / Effective Date
              </th>
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Date Filed
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {myRequestHistory.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  className="px-4 py-6 text-center text-sm font-medium text-gray-500"
                >
                  No request history records.
                </td>
              </tr>
            ) : (
              myRequestHistory.map((entry) => (
                <tr
                  key={entry.id}
                  className="transition-colors hover:bg-gray-50/50"
                >
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">
                    {entry.request_type}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-700">
                    {entry.schedule}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-700">
                    {entry.filed_at
                      ? new Date(entry.filed_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${badgeClass[entry.final_status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {entry.final_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
