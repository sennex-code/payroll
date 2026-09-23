// hooks/queries/leaveQueries.ts
import axiosInterceptor from "@/hooks/interceptor";
import { queryOptions } from "@tanstack/react-query";
import { mutationHandler } from "../hooks/createMutationHandler";

/**
 * Query for all leaves
 */
export const leavesQueryOptions = queryOptions({
  queryKey: ["leaves"],
  queryFn: () =>
    mutationHandler(
      axiosInterceptor.get("/api/leaves"),
      "Failed to fetch leaves",
    ),
});

/**
 * Query for my attendance
 */
export const myAttendanceQueryOptions = (empId: string) =>
  queryOptions({
    queryKey: ["my-attendance", empId],
    enabled: !!empId,
    queryFn: () =>
      mutationHandler(
        axiosInterceptor.get(`/api/employees/my-attendance`),
        "Failed to fetch Attendance",
      ),
  });

/**
 * Query for offset applications
 */
export const offsetApplicationsQueryOptions = queryOptions({
  queryKey: ["offset-applications"],
  queryFn: () =>
    mutationHandler(
      axiosInterceptor.get("/api/employees/offset-applications"),
      "Failed to fetch offset applications",
    ),
});

/**
 * Query for offset balance
 */
export const offsetBalanceQueryOptions = (empId: string) =>
  queryOptions({
    queryKey: ["offset-balance", empId],
    enabled: !!empId,
    queryFn: () =>
      mutationHandler(
        axiosInterceptor.get(`/api/employees/offset-balance/${empId}`),
        "Failed to fetch offset balance",
      ),
  });

/**
 * Query for resignations
 */
export const resignationQueryOptions = queryOptions({
  queryKey: ["resignations"],
  queryFn: () =>
    mutationHandler(
      axiosInterceptor.get(`/api/employees/resignations`),
      "Failed to fetch resignations",
    ),
});
