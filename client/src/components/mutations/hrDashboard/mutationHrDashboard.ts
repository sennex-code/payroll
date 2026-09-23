import axiosInterceptor from "@/hooks/interceptor";
import { mutationOptions, useQueryClient } from "@tanstack/react-query";

export const updateMutationDoc = mutationOptions({
  mutationFn: async (data: { emp_id: number; missing_docs: string[] }) => {
    const res = await axiosInterceptor.post("/api/employees/missing-docs", {
      emp_id: data.emp_id,
      missing_docs: data.missing_docs.join(", "),
    });

    return res.data;
  },
});

export const updateResignationMutationOptions = mutationOptions({
  mutationFn: async ({
    id,
    status,
    review_remarks,
  }: {
    id: number;
    status: string;
    review_remarks?: string;
  }) => {
    const res = await axiosInterceptor.put(
      `/api/employees/resignations/${id}`,
      {
        status,
        ...(review_remarks ? { review_remarks } : {}),
      },
    );
    return res.data;
  },
  onError: () => alert("Error updating resignation"),
});

export const updateLeaveMutationOptions = mutationOptions({
  mutationFn: async ({
    id,
    ...payload
  }: {
    id: number;
    status: string;
    approved_days?: number | null;
    approved_dates?: string[] | null;
    supervisor_remarks?: string;
  }) => {
    const res = await axiosInterceptor.put(`/api/employees/leaves/${id}`, payload);
    return res.data;
  },
  onError: () => alert("Error updating leave request"),
});
