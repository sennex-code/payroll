export default function LeaveForm({
  handleLeaveTypeChange,
  handleFromDateChange,
  handleToDateChange,
  getMaxToDate,
  setApplicationModalOpen,
  formData,
  setFormData,
  currentUser,
  availableLeaveTypes,
  difference,
  handleSubmitLeave,
}) {
  return (
    <form
      onSubmit={handleSubmitLeave}
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      <div className="flex flex-col gap-2 md:col-span-3">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Filing As
        </label>
        <input
          type="text"
          disabled
          value={`${currentUser.emp_id} - ${currentUser.name}`}
          className="cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-600 outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Leave Type
        </label>
        <select
          value={formData.leaveType}
          onChange={handleLeaveTypeChange}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
        >
          {availableLeaveTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          From Date
        </label>
        <input
          type="date"
          required
          value={formData.fromDate}
          onChange={handleFromDateChange}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          To Date
        </label>
        <input
          type="date"
          value={formData.toDate}
          onChange={handleToDateChange}
          disabled={formData.leaveType === "Birthday Leave"}
          max={getMaxToDate()}
          min={formData.fromDate}
          className={`rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${formData.leaveType === "Birthday Leave" ? "cursor-not-allowed bg-gray-100 text-gray-500" : ""}`}
        />
      </div>
      {difference >= 5 && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            OCP
          </label>
          <input
            type="file"
            required
            disabled={formData.leaveType === "Birthday Leave"}
            onChange={(e) => {
              if (e.target.files.length === 0) return;

              setFormData((prev) => {
                return {
                  ...prev,
                  OCP: e.target.files[0],
                };
              });
            }}
            className={`rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${formData.leaveType === "Birthday Leave" ? "cursor-not-allowed bg-gray-100 text-gray-500" : ""}`}
          />
        </div>
      )}
      {formData.leaveType !== "Offset" && (
        <div className="flex flex-col gap-2 md:col-span-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Priority Level
          </label>
          <select
            value={formData.priority}
            onChange={(e) =>
              setFormData({
                ...formData,
                priority: e.target.value,
              })
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2 md:col-span-3">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Reason / Details
        </label>
        <textarea
          rows={3}
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          className="resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="mt-1 flex justify-end gap-2 md:col-span-3">
        <button
          type="button"
          onClick={() => setApplicationModalOpen(false)}
          className="cursor-pointer rounded-lg bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-700"
        >
          Review Application
        </button>
      </div>
    </form>
  );
}
