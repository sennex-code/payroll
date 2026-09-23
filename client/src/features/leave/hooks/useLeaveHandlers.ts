import { Dispatch, SetStateAction } from "react";

export const useLeaveHandlers = ({
  formData,
  setFormData,
  setFormError,
  setReviewConfirm,
  setConfirmAction,
  showToast,
}: LeaveHandlers) => {
  const handleSubmitLeave = (e: FormDataEvent) => {
    e.preventDefault();
    if (!formData.emp_id || !formData.fromDate) {
      setFormError("Please fill all required fields.");
      return;
    }
  };

  const handleLeaveTypeChange = (e: any) => {
    const newLeaveType = e.target.value;
    const newToDate =
      newLeaveType === "Birthday Leave" && formData.fromDate
        ? formData.fromDate
        : "";
    setFormData({
      ...formData,
      leaveType: newLeaveType,
      toDate: newToDate,
      daysApplied: "",
    });
    setFormError("");

    const submitCancellationRequest = (cancellationReason: any) => {
      const trimmedReason = String(cancellationReason || "").trim();
      if (!trimmedReason) {
        showToast("Cancellation reason is required.", "error");
        return;
      }

      return true;
      //   requestCancellationApprovalMutation.mutate({
      //     item,
      //     cancellationReason: trimmedReason,
      //   });
    };
  };
};
