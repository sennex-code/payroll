import { getDateDiffInclusive } from "../utils/date.utils";

export const useHandleSubmiisions = ({
  formData,
  setFormError,
  setConfirmAction,
}: SubmitLeave) => {
  const handleSubmitLeave = (e: any) => {
    e.preventDefault();
    if (!formData.emp_id || !formData.fromDate) {
      setFormError("Please fill all required fields.");
      return;
    }

    const trimmedReason = String(formData.reason || "").trim();
    if (!trimmedReason) {
      setFormError("Reason is required.");
      return;
    }

    const effectiveToDate = formData.toDate || formData.fromDate;

    let computedDays = Number(formData.daysApplied);

    if (formData.leaveType === "Offset") {
      if (formData.fromDate && effectiveToDate) {
        const diff = getDateDiffInclusive({
          start: formData.fromDate,
          end: effectiveToDate,
        });
        computedDays = !isNaN(diff) ? Math.max(diff, 1) : 1;
      } else {
        computedDays = 0;
      }
    }

    setConfirmAction({
      OCP: formData.OCP,
      type: "leave",
      leaveType: formData.leaveType,
      fromDate: formData.fromDate,
      toDate: effectiveToDate,
      daysApplied: computedDays,
      reason: trimmedReason,
    });
  };

  return {
    handleSubmitLeave,
  };
};
