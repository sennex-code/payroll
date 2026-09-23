type ConfirmAction = {
  type: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  daysApplied: string;
  reason: string;
};
type FormSubmit = {
  emp_id: number;
  fromDate: string;
  toDate: string;
  daysApplied: string;
  leaveType: string;
};

type SubmitLeave = {
  e: FormDataEvent;
  formData: FormDataType;
  setFormError: Dispatch<SetStateAction<string>>;
  setConfirmAction: Dispatch<SetStateAction<ConfirmAction>>;
};

type LeaveStatus =
  | "Approved"
  | "Denied"
  | "Pending"
  | "Pending Approval"
  | "Cancellation Requested"
  | "Rejected"
  | "Partially Approved";

type Leave = {
  date_from: string;
  date_to: string;
  status?: LeaveStatus;
  approved_dates?: string | string[];
  days_applied?: number | string;
};
