import LeaveForm from "../forms/LeaveForm";
import ResignationForm from "../forms/ResignationForm";

export default function FileApplicationModal({
  applicationModalOpen,
  currentUser,
  setApplicationModalOpen,
  applicationType,
  setApplicationType,
  formError,
  handleFromDateChange,
  handleLeaveTypeChange,
  handleToDateChange,
  getMaxToDate,
  formData,
  setFormData,
  availableLeaveTypes,
  difference,
  handleSubmitLeave,
  resignationForm,
  setResignationForm,
  resignationTypes,
  fileResignationMutation,
}) {
  return (
    <>
      {applicationModalOpen && currentUser?.role !== "Admin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="m-0 text-base font-bold text-gray-900">
                File New Application
              </h3>
              <button
                onClick={() => setApplicationModalOpen(false)}
                className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-lg text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>

            <div className="px-4 pt-3">
              <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-1">
                <button
                  onClick={() => setApplicationType("leave")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold ${applicationType === "leave" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  Leave / Offset
                </button>
                <button
                  onClick={() => setApplicationType("resignation")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold ${applicationType === "resignation" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  Resignation
                </button>
              </div>
            </div>

            <div className="max-h-[72vh] overflow-auto p-4 pt-0">
              {applicationType === "leave" ? (
                <>
                  {formError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                      {formError}
                    </div>
                  )}
                  <LeaveForm
                    handleFromDateChange={handleFromDateChange}
                    handleLeaveTypeChange={handleLeaveTypeChange}
                    handleToDateChange={handleToDateChange}
                    getMaxToDate={getMaxToDate}
                    setApplicationModalOpen={setApplicationModalOpen}
                    formData={formData}
                    setFormData={setFormData}
                    currentUser={currentUser}
                    availableLeaveTypes={availableLeaveTypes}
                    difference={difference}
                    handleSubmitLeave={handleSubmitLeave}
                  />
                </>
              ) : (
                <ResignationForm
                  resignationForm={resignationForm}
                  setResignationForm={setResignationForm}
                  resignationTypes={resignationTypes}
                  setApplicationModalOpen={setApplicationModalOpen}
                  fileResignationMutation={fileResignationMutation}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
