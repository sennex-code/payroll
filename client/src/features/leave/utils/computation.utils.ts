export const isPendingApprovalStatus = (status: string) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  return normalized === "pending" || normalized === "pending approval";
};
export const isSupervisorTeamMember = (
  item: any,
  currentUserId: number | string,
) => {
  return String(item?.emp_id) !== String(currentUserId);
};
export const canApproverReviewRecord = (
  item: any,
  isHRRole: boolean,
  isAdminRole: boolean,
  isSupervisorRole: boolean,
  currentUserId: number | string,
) => {
  if (!item) return false;
  if (String(item.emp_id) === String(currentUserId)) return false;

  const roleValue = String(item.requester_role || "")
    .trim()
    .toLowerCase();

  if (isHRRole) {
    return true;
  }

  if (isAdminRole) {
    return roleValue !== "admin";
  }

  if (isSupervisorRole) {
    return isSupervisorTeamMember(item, currentUserId);
  }

  return false;
};
