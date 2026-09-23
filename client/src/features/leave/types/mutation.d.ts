type useRequestMutation = {
  showToast: (message: any, type?: string, duration?: number) => void;
  setResignationForm: Dispatch<
    SetStateAction<{
      resignation_type: string;
      effective_date: string;
      reason: string;
    }>
  >;
  setFormData: Dispatch<
    SetStateAction<{
      emp_id: any;
      leaveType: string;
      fromDate: string;
      toDate: string;
      daysApplied: string;
      reason: string;
      priority: string;
      OCP: undefined;
    }>
  >;
  setApplicationModalOpen: Dispatch<SetStateAction<boolean>>;
  formData?: {
    emp_id: any;
    leaveType: string;
    fromDate: string;
    toDate: string;
    daysApplied: string;
    reason: string;
    priority: string;
    OCP: undefined;
  };
};

type RequestGroup = "leave" | "offset" | "resignation";
