type FormDataType = {
  emp_id: any;
  leaveType: string;
  fromDate: string;
  toDate: string;
  daysApplied: string;
  reason: string;
  priority: string;
  OCP: undefined;
};

type LeaveHandlers = {
  formData: FormDataType;
  setFormData: Dispatch<SetStateAction<FormData>>;
  setFormError: Dispatch<SetStateAction<string>>;
  setReviewConfirm: Dispatch<SetStateAction<null>>;
  setConfirmAction: Dispatch<SetStateAction<null>>;
  showToast: (message: any, type?: string, duration?: number) => void;
};
