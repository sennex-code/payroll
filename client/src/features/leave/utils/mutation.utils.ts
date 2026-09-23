import axiosInterceptor from "@/hooks/interceptor";
import {
  createMutation,
  mutationHandler,
} from "../hooks/createMutationHandler";
import { useEmailNotifications } from "../hooks/useEmailNotifications";

//T

export const useRequestMutation = ({
  showToast,
  setApplicationModalOpen,
  setResignationForm,
  setFormData,
  formData,
}: useRequestMutation) => {
  const endpoints = {
    leave: "/api/employees/leaves",
    offset: "/api/employees/offset-applications",
    resignation: "/api/employees/resignations",
  };

  const handleSendUpdate = useEmailNotifications();
  const ALL_KEYS = ["leaves", "offset-applications", "resignations"];

  const currentUser = JSON.parse(localStorage.getItem("wah_user") || "{}");

  const resetLeaveForm = () => {
    setFormData({
      ...formData,
      fromDate: "",
      toDate: "",
      reason: "",
      daysApplied: "",
      OCP: undefined,
    });
  };

  // 1
  const submitLeaveMutation = createMutation({
    mutationFn: (newLeave: any) => {
      const toFormData = new FormData();

      Object.entries(newLeave).forEach(([key, value]) => {
        // check if file
        if (value instanceof File) {
          toFormData.append(key, value);
        } else if (value !== undefined && value !== null) {
          toFormData.append(key, String(value));
        }
      });

      return mutationHandler(
        axiosInterceptor.post("/api/leaves/", toFormData),
        "Failed to submit leave",
      );
    },
    successMsg: "Leave application submitted successfully",
    showToast,
    invalidateKeys: ["leaves"],
    successExtra: () => {
      setApplicationModalOpen(false);
      resetLeaveForm();
    },
  });

  // 2
  const fileOffsetMutation = createMutation({
    mutationFn: (offsetData: any) => {
      console.log(offsetData);
      return mutationHandler(
        axiosInterceptor.post("/api/employees/offset-applications", {
          emp_id: currentUser?.emp_id,
          ...offsetData,
        }),
        "Failed to file offset",
      );
    },
    successMsg: "Offset application filed successfully",
    showToast,
    invalidateKeys: ["offset-applications"],
    successExtra: () => {
      setApplicationModalOpen(false);
      resetLeaveForm();
    },
  });

  // 3
  const fileResignationMutation = createMutation({
    mutationFn: (resignationData: any) =>
      mutationHandler(
        axiosInterceptor.post("/api/employees/resignations", {
          emp_id: currentUser?.emp_id,
          ...resignationData,
        }),
        "Failed to file resignation",
      ),
    successMsg: "Resignation filed successfully",
    showToast,
    invalidateKeys: ["resignations"],
    successExtra: () => {
      if (typeof setResignationForm === "function") {
        setResignationForm({
          resignation_type: "Voluntary Resignation",
          effective_date: "",
          reason: "",
        });
      }
      setApplicationModalOpen(false);
    },
  });

  // 4
  const reviewLeaveMutation = createMutation({
    mutationFn: ({ id, ...payload }: any) =>
      mutationHandler(
        axiosInterceptor.put(`/api/employees/leaves/${id}`, payload),
        "Failed to update leave request",
      ),
    successMsg: "Leave request updated successfully.",
    showToast,
    invalidateKeys: ["leaves"],
    callback: async (data, variables) => {
      console.log("hit!!!!");
      await handleSendUpdate(
        variables.item,
        variables.status,
        variables.supervisor_remarks,
      );
    },
  });

  // 5
  const reviewOffsetMutation = createMutation({
    mutationFn: ({ id, ...payload }: any) =>
      mutationHandler(
        axiosInterceptor.put(
          `/api/employees/offset-applications/${id}`,
          payload,
        ),
        "Failed to update offset request",
      ),
    successMsg: "Offset request updated successfully.",
    showToast,
    invalidateKeys: ["offset-applications"],
  });
  // 6
  const reviewResignationMutation = createMutation({
    mutationFn: ({ id, ...payload }: any) =>
      mutationHandler(
        axiosInterceptor.put(`/api/employees/resignations/${id}`, payload),
        "Failed to update resignation",
      ),
    successMsg: "Resignation request updated successfully.",
    showToast,
    invalidateKeys: ["resignations"],
  });

  // 7
  const cancelMyPendingRequestMutation = createMutation<
    any,
    {
      request_group: RequestGroup;
      id: number;
    }
  >({
    mutationFn: (item) => {
      const base = endpoints[item.request_group];
      if (!base) throw new Error("Unsupported request type");

      return mutationHandler(
        axiosInterceptor.delete(`${base}/${item.id}/cancel`),
        "Failed to cancel request",
      );
    },
    successMsg: "Pending request cancelled successfully.",
    showToast,
    invalidateKeys: ALL_KEYS,
  });

  // 8
  const requestCancellationApprovalMutation = createMutation<
    any,
    {
      item: {
        request_group: RequestGroup;
        id: number;
      };
      cancellationReason: string;
    }
  >({
    mutationFn: ({ item, cancellationReason }) => {
      const base = endpoints[item.request_group];
      if (!base) throw new Error("Unsupported request type");

      return mutationHandler(
        axiosInterceptor.post(`${base}/${item.id}/request-cancel`, {
          cancellation_reason: cancellationReason,
        }),
        "Failed to request cancellation approval",
      );
    },
    successMsg: "Cancellation request submitted for approval.",
    showToast,
    invalidateKeys: ALL_KEYS,
  });

  // 9
  const addHrNoteMutation = createMutation<
    any,
    {
      module: number;
      id: number;
      note: string;
    }
  >({
    mutationFn: ({ module, id, note }) =>
      mutationHandler(
        axiosInterceptor.post(
          `/api/employees/pending-requests/${module}/${id}/hr-note`,
          {
            hr_note: note,
          },
        ),
        "Failed to save HR note",
      ),
    successMsg: "HR note saved and supervisors notified.",
    showToast,
    invalidateKeys: ALL_KEYS,
  });

  return {
    fileResignationMutation,
    fileOffsetMutation,
    reviewLeaveMutation,
    reviewResignationMutation,
    submitLeaveMutation,
    reviewOffsetMutation,
    cancelMyPendingRequestMutation,
    requestCancellationApprovalMutation,
    addHrNoteMutation,
  };
};
