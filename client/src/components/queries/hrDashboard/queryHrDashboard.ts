import axiosInterceptor from "@/hooks/interceptor";
import { queryOptions } from "@tanstack/react-query";

export const dashboardSummary = queryOptions({
  queryKey: ["dashboardSummary"],
  queryFn: async () => {
    const res = await axiosInterceptor.get("/api/employees/dashboard-summary");

    const information = res.data;

    const stats = [
      {
        label: "Pending Leave Approval",
        value: information?.pendingLeaves?.length || 0,
        borderColor: "#d4a017",
        modalKey: "pending-leave-approval",
      },
      {
        label: "Pending Resignation Approval",
        value: information?.resignations?.length || 0,
        borderColor: "#1a8f3c",
        modalKey: "pending-resignation-approval",
      },
      {
        label: "On Leave",
        value: information?.onLeave?.length || 0,
        borderColor: "#d4a017",
        modalKey: "on-leave",
      },
      {
        label: "Absent",
        value: information?.absents?.length || 0,
        borderColor: "#c0392b",
        modalKey: "absent",
      },
    ];

    return { stats, information };
  },
});

export const employees = queryOptions({
  queryKey: ["employees"],
  queryFn: async () => {
    const res = await axiosInterceptor.get("/api/employees");
    return res.data;
  },
});
