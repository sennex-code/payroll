import { useState } from "react";
import { useFormData } from "./useFormData";

export const useRoleComputation = (injectedCurrentUser?: any) => {
  const {
    user: { currentUser },
  } = useFormData();
  const activeUser = injectedCurrentUser || currentUser;

  const normalizedRole = String(activeUser?.role || "")
    .trim()
    .toLowerCase();
  const isAdminRole = normalizedRole === "admin";
  const isHRRole = normalizedRole === "hr";
  const isSupervisorRole =
    normalizedRole === "supervisor" || normalizedRole.includes("supervisor");
  const isApprover = isHRRole || isSupervisorRole;

  const [calendarScope, setCalendarScope] = useState(
    isHRRole || isAdminRole ? "overall" : isSupervisorRole ? "team" : "own",
  );

  return {
    roles: {
      isAdminRole,
      isHRRole,
      isApprover,
      isSupervisorRole,
    },
    calendar: {
      calendarScope,
      setCalendarScope,
    },
  };
};
