import { getDateDiffInclusive } from "./date.utils";

export const handleSubmitLeave = ({
  e,
  formData,
  setFormError,
  setConfirmAction,
}: SubmitLeave) => {
  e.preventDefault();

  if (!formData.emp_id || !formData.fromDate) {
    setFormError("Please fill all required fields.");
    return;
  }

  const effectiveToDate = formData.toDate || formData.fromDate;

  // Automatically calculate the days for Offset since the manual input was removed
  let computedDays = formData.daysApplied;
  if (formData.leaveType === "Offset") {
    computedDays = Math.max(
      getDateDiffInclusive({ start: formData.fromDate, end: effectiveToDate }),
      1,
    );
  }

  setConfirmAction({
    type: "leave",
    leaveType: formData.leaveType,
    fromDate: formData.fromDate,
    toDate: effectiveToDate,
    daysApplied: computedDays,
  });
};
