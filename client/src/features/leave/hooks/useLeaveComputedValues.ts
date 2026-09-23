import { useMemo } from "react";
import {
  canApproverReviewRecord,
  isPendingApprovalStatus,
  isSupervisorTeamMember,
} from "../utils/computation.utils";
import { isFutureDateString } from "../utils/date.utils";

type UseComputedValues = {
  leaves: any[];
  offsetApplications: any[];
  myResignations: any[];
  isAdminRole: boolean;
  isHRRole: boolean;
  isSupervisorRole: boolean;
  calendarScope: string;
  isApprover: boolean;
  pendingTypeFilter: string;
  currentUser: any;
};

export const useComputedValues = ({
  leaves,
  offsetApplications,
  myResignations,
  isAdminRole,
  isHRRole,
  isSupervisorRole,
  isApprover,
  calendarScope,
  pendingTypeFilter,
  currentUser,
}: UseComputedValues) => {
  // Non-memoized values
  const myOwnResignations = myResignations.filter(
    (r) => String(r.emp_id) === String(currentUser?.emp_id),
  );
  const myLeaves = leaves.filter(
    (leave) => leave.emp_id === currentUser?.emp_id,
  );
  const myOffsets = offsetApplications.filter(
    (offP) => offP.emp_id === currentUser?.emp_id,
  );

  const calendarScopeOptions = isAdminRole
    ? [{ value: "overall", label: "Overall Calendar" }]
    : isHRRole
      ? [
          { value: "own", label: "Own Calendar" },
          { value: "overall", label: "Overall Calendar" },
        ]
      : isSupervisorRole
        ? [
            { value: "own", label: "Own Calendar" },
            { value: "team", label: "Team Calendar" },
          ]
        : [{ value: "own", label: "Own Calendar" }];

  const myPendingRequests = useMemo(
    () =>
      [
        ...myLeaves
          .filter((l) => isPendingApprovalStatus(l.status))
          .map((l) => ({
            ...l,
            request_group: "leave",
            unified_type: l.leave_type,
          })),
        ...myOffsets
          .filter((o) => isPendingApprovalStatus(o.status))
          .map((o) => ({
            ...o,
            request_group: "offset",
            unified_type: "Offset",
          })),
        ...myOwnResignations
          .filter((r) => isPendingApprovalStatus(r.status))
          .map((r) => ({
            ...r,
            request_group: "resignation",
            unified_type: r.resignation_type || "Resignation",
          })),
      ].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      ),
    [myLeaves, myOffsets, myOwnResignations],
  );

  const myApprovedFutureRequests = useMemo(
    () =>
      [
        ...myLeaves
          .filter(
            (l) =>
              ["Approved", "Partially Approved"].includes(l.status) &&
              !l.cancellation_requested_at &&
              isFutureDateString(l.date_from),
          )
          .map((l) => ({
            ...l,
            request_group: "leave",
            unified_type: l.leave_type,
          })),
        ...myOffsets
          .filter(
            (o) =>
              ["Approved", "Partially Approved"].includes(o.status) &&
              !o.cancellation_requested_at &&
              isFutureDateString(o.date_from),
          )
          .map((o) => ({
            ...o,
            request_group: "offset",
            unified_type: "Offset",
          })),
        ...myOwnResignations
          .filter(
            (r) =>
              r.status === "Approved" &&
              !r.cancellation_requested_at &&
              isFutureDateString(r.effective_date),
          )
          .map((r) => ({
            ...r,
            request_group: "resignation",
            unified_type: r.resignation_type || "Resignation",
          })),
      ].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      ),
    [myLeaves, myOffsets, myOwnResignations],
  );

  const myCancellationRequestsPending = useMemo(
    () =>
      [
        ...myLeaves
          .filter((l) => Boolean(l.cancellation_requested_at))
          .map((l) => ({
            ...l,
            request_group: "leave",
            unified_type: l.leave_type,
          })),
        ...myOffsets
          .filter((o) => Boolean(o.cancellation_requested_at))
          .map((o) => ({
            ...o,
            request_group: "offset",
            unified_type: "Offset",
          })),
        ...myOwnResignations
          .filter((r) => Boolean(r.cancellation_requested_at))
          .map((r) => ({
            ...r,
            request_group: "resignation",
            unified_type: r.resignation_type || "Resignation",
          })),
      ].sort(
        (a, b) =>
          new Date(b.cancellation_requested_at || b.created_at || 0).getTime() -
          new Date(a.cancellation_requested_at || a.created_at || 0).getTime(),
      ),
    [myLeaves, myOffsets, myOwnResignations],
  );

  const myRequestRows = useMemo(
    () =>
      [
        ...myPendingRequests.map((item) => ({
          ...item,
          row_action: "cancel_pending",
          row_status: item.status,
        })),
        ...myApprovedFutureRequests.map((item) => ({
          ...item,
          row_action: "request_cancel_approval",
          row_status: item.status,
        })),
        ...myCancellationRequestsPending.map((item) => ({
          ...item,
          row_action: "cancel_waiting_approval",
          row_status: "Cancellation Requested",
        })),
      ].sort(
        (a, b) =>
          new Date(
            b.cancellation_requested_at || b.updated_at || b.created_at || 0,
          ).getTime() -
          new Date(
            a.cancellation_requested_at || a.updated_at || a.created_at || 0,
          ).getTime(),
      ),
    [
      myPendingRequests,
      myApprovedFutureRequests,
      myCancellationRequestsPending,
    ],
  );

  const myRequestHistory = useMemo(
    () =>
      [
        ...myLeaves.map((l) => ({
          id: `leave-${l.id}`,
          request_type: l.leave_type,
          schedule: `${new Date(l.date_from).toLocaleDateString()} - ${new Date(l.date_to).toLocaleDateString()}`,
          filed_at: l.created_at,
          final_status: l.cancellation_requested_at
            ? "Cancellation Requested"
            : l.status,
        })),
        ...myOffsets.map((o) => ({
          id: `offset-${o.id}`,
          request_type:
            Number(o.days_applied || 0) > 0
              ? `Offset (${Number(o.days_applied || 0).toFixed(2)} days)`
              : "Offset",
          schedule: `${new Date(o.date_from).toLocaleDateString()} - ${new Date(o.date_to).toLocaleDateString()}`,
          filed_at: o.created_at,
          final_status: o.cancellation_requested_at
            ? "Cancellation Requested"
            : o.status,
        })),
        ...myOwnResignations.map((r) => ({
          id: `resignation-${r.id}`,
          request_type: `Resignation - ${r.resignation_type || "Resignation"}`,
          schedule: r.effective_date
            ? new Date(r.effective_date).toLocaleDateString()
            : "N/A",
          filed_at: r.created_at,
          final_status: r.cancellation_requested_at
            ? "Cancellation Requested"
            : r.status,
        })),
      ].sort(
        (a, b) =>
          new Date(b.filed_at || 0).getTime() -
          new Date(a.filed_at || 0).getTime(),
      ),
    // ✅ FIX: Add dependencies
    [myLeaves, myOffsets, myOwnResignations],
  );

  const unifiedMyLeaves = useMemo(
    () => [
      ...myLeaves,
      ...myOffsets.map((o) => ({
        ...o,
        leave_type: "Offset",
        first_name: currentUser?.name || currentUser?.first_name,
        last_name: "",
      })),
    ],
    // ✅ FIX: Add currentUser to dependencies
    [myLeaves, myOffsets, currentUser?.name, currentUser?.first_name],
  );

  const unifiedAllLeaves = useMemo(
    () => [
      ...leaves,
      ...offsetApplications.map((o) => ({ ...o, leave_type: "Offset" })),
    ],
    [leaves, offsetApplications],
  );

  const unifiedTeamLeaves = useMemo(
    () =>
      unifiedAllLeaves.filter((item) =>
        isSupervisorTeamMember(item, currentUser?.emp_id),
      ),
    // ✅ FIX: Add currentUser?.emp_id to dependencies
    [unifiedAllLeaves, currentUser?.emp_id],
  );

  const calendarLeaves =
    calendarScope === "overall"
      ? unifiedAllLeaves
      : calendarScope === "team"
        ? unifiedTeamLeaves
        : unifiedMyLeaves;

  const pendingLeaveApprovals = useMemo(
    () =>
      isApprover
        ? leaves.filter(
            (l) =>
              (isPendingApprovalStatus(l.status) ||
                (l.cancellation_requested_at &&
                  ["Approved", "Partially Approved"].includes(l.status))) &&
              canApproverReviewRecord(
                l,
                isHRRole,
                isAdminRole,
                isSupervisorRole,
                currentUser?.emp_id,
              ),
          )
        : [],
    // ✅ FIX: Add all dependencies
    [
      leaves,
      isApprover,
      isHRRole,
      isAdminRole,
      isSupervisorRole,
      currentUser?.emp_id,
    ],
  );

  const pendingOffsetApprovals = useMemo(
    () =>
      isApprover
        ? offsetApplications.filter(
            (oa) =>
              (isPendingApprovalStatus(oa.status) ||
                (oa.cancellation_requested_at &&
                  ["Approved", "Partially Approved"].includes(oa.status))) &&
              canApproverReviewRecord(
                oa,
                isHRRole,
                isAdminRole,
                isSupervisorRole,
                currentUser?.emp_id,
              ),
          )
        : [],
    // ✅ FIX: Add all dependencies
    [
      offsetApplications,
      isApprover,
      isHRRole,
      isAdminRole,
      isSupervisorRole,
      currentUser?.emp_id,
    ],
  );

  const unifiedPending = useMemo(
    () =>
      [
        ...pendingLeaveApprovals.map((l) => ({
          ...l,
          unified_type: l.leave_type,
          isOffset: false,
        })),
        ...pendingOffsetApprovals.map((o) => ({
          ...o,
          unified_type: "Offset",
          isOffset: true,
        })),
      ].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      ),
    [pendingLeaveApprovals, pendingOffsetApprovals],
  );

  const pendingResignationApprovals = useMemo(
    () =>
      isApprover
        ? myResignations.filter(
            (r) =>
              (isPendingApprovalStatus(r.status) ||
                (r.cancellation_requested_at && r.status === "Approved")) &&
              canApproverReviewRecord(
                r,
                isHRRole,
                isAdminRole,
                isSupervisorRole,
                currentUser?.emp_id,
              ),
          )
        : [],
    // ✅ FIX: Add dependencies
    [
      myResignations,
      isApprover,
      isHRRole,
      isAdminRole,
      isSupervisorRole,
      currentUser?.emp_id,
    ],
  );

  const allPendingRequests = useMemo(
    () =>
      [
        ...unifiedPending.map((item) => ({
          ...item,
          request_group: "leave_offset",
        })),
        ...pendingResignationApprovals.map((item) => ({
          ...item,
          request_group: "resignation",
          unified_type: item.resignation_type || "Resignation",
          isOffset: false,
        })),
      ].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      ),
    [unifiedPending, pendingResignationApprovals],
  );

  const totalPendingCount = allPendingRequests.length;

  const filteredPendingRequests = useMemo(
    () =>
      allPendingRequests.filter((item) => {
        if (pendingTypeFilter === "all") return true;
        if (pendingTypeFilter === "resignation") {
          return item.request_group === "resignation";
        }
        if (pendingTypeFilter === "offset") {
          return item.request_group === "leave_offset" && item.isOffset;
        }
        if (pendingTypeFilter === "leave") {
          return item.request_group === "leave_offset" && !item.isOffset;
        }
        return true;
      }),
    [allPendingRequests, pendingTypeFilter],
  );

  return {
    user: {
      own: {
        leaves: myLeaves,
        offsets: myOffsets,
        resignations: myOwnResignations,
      },
      requests: {
        pending: myPendingRequests,
        approvedFuture: myApprovedFutureRequests,
        cancellationsPending: myCancellationRequestsPending,
        rows: myRequestRows,
        history: myRequestHistory,
      },
    },
    calendar: {
      options: calendarScopeOptions,
      unified: {
        my: unifiedMyLeaves,
        all: unifiedAllLeaves,
        team: unifiedTeamLeaves,
      },
      filtered: calendarLeaves,
    },
    approvals: {
      pending: {
        leaves: pendingLeaveApprovals,
        offsets: pendingOffsetApprovals,
        resignations: pendingResignationApprovals,
        unified: unifiedPending,
      },
      all: allPendingRequests,
      filtered: filteredPendingRequests,
      total: allPendingRequests.length,
    },
    totalPendingCount,
  };
};
