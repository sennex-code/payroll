import { useQuery } from "@tanstack/react-query";
import Toast from "../components/Toast";
import {
  parseDateOnly,
  getDateDiffInclusive,
  calculateBusinessDays,
  getDateRangeInclusive,
} from "@/features/leave/utils/date.utils";
import { getOffsetRequestedDays } from "@/features/leave/utils/leave.utils";
import {
  leaveTypes,
  resignationTypes,
  leavePolicy,
} from "@/features/leave/leaveConstants";

import LeaveCalendar from "@/features/leave/components/LeaveCalendar";
import ActionButtons from "@/features/leave/components/ActionButtons";
import OffsetBalanceCard from "@/features/leave/components/OffsetBalanceCard";
import RequestHistoryTable from "@/features/leave/components/RequestHistoryTable";
import ModalsContainer from "@/features/leave/components/modals/ModalsContainer";
import { useFormData } from "@/features/leave/hooks/useFormData";
import { useRoleComputation } from "@/features/leave/hooks/useRoleComputation";
import { useComputedValues } from "@/features/leave/hooks/useLeaveComputedValues";
import {
  leavesQueryOptions,
  myAttendanceQueryOptions,
  offsetApplicationsQueryOptions,
  offsetBalanceQueryOptions,
  resignationQueryOptions,
} from "@/features/leave/utils/query.utils";
import { useRequestMutation } from "@/features/leave/utils/mutation.utils";
import { useHandleSubmiisions } from "@/features/leave/hooks/useHandleSubmissions";

export default function Leave() {
  const formDataState = useFormData();

  const {
    user: { currentUser },
    form: {
      data: formData,
      setData: setFormData,
      error: formError,
      setError: setFormError,
      resignation: resignationForm,
      setResignation: setResignationForm,
    },
    modals: {
      application: {
        isOpen: applicationModalOpen,
        setOpen: setApplicationModalOpen,
        type: applicationType,
        setType: setApplicationType,
      },
      myPending: { isOpen: myPendingModalOpen, setOpen: setMyPendingModalOpen },
      pending: {
        isOpen: pendingModalOpen,
        setOpen: setPendingModalOpen,
        typeFilter: pendingTypeFilter,
        setTypeFilter: setPendingTypeFilter,
      },
    },
    confirmations: {
      action: confirmAction,
      setAction: setConfirmAction,
      review: reviewConfirm,
      setReview: setReviewConfirm,
      cancelApproval: cancelApprovalConfirm,
      setCancelApproval: setCancelApprovalConfirm,
      cancelPending: cancelPendingConfirm,
      setCancelPending: setCancelPendingConfirm,
      hrNote: hrNoteConfirm,
      setHrNote: setHrNoteConfirm,
    },
    toast: { instance: toast, show: showToast, clear: clearToast },
    computed: { dateDifference: difference },
  } = formDataState;

  const roleComputationState = useRoleComputation(currentUser);
  const {
    roles: { isAdminRole, isHRRole, isSupervisorRole, isApprover },
    calendar: { calendarScope, setCalendarScope },
  } = roleComputationState;

  const normalizedEmploymentStatus = String(currentUser?.status || "")
    .trim()
    .toLowerCase();
  const isJobOrderEmployee = normalizedEmploymentStatus === "job order";

  const isPendingApprovalStatus = (status) => {
    const normalized = String(status || "")
      .trim()
      .toLowerCase();
    return normalized === "pending" || normalized === "pending approval";
  };

  const availableLeaveTypes = isJobOrderEmployee
    ? leaveTypes.filter((type) => type !== "PGT Leave")
    : leaveTypes;

  const { data: leaves = [], isLoading: isLoadingLeaves } =
    useQuery(leavesQueryOptions);

  const { data: myAttendance = [] } = useQuery(
    myAttendanceQueryOptions(currentUser?.emp_id || ""),
  );

  const { data: offsetApplications = [], isLoading: isLoadingOffsets } =
    useQuery(offsetApplicationsQueryOptions);

  const { data: offsetBalance = {} } = useQuery(
    offsetBalanceQueryOptions(currentUser?.emp_id || ""),
  );

  const { data: myResignations = [], isLoading: isLoadingResignations } =
    useQuery(resignationQueryOptions);

  const {
    user: {
      requests: { rows: myRequestRows, history: myRequestHistory },
    },
    calendar: { options: calendarScopeOptions, filtered: calendarLeaves },
    approvals: {
      pending: {
        leaves: pendingLeaveApprovals,
        offsets: pendingOffsetApprovals,
        resignations: pendingResignationApprovals,
      },
      all: allPendingRequests,
      filtered: filteredPendingRequests,
      total: totalPendingCount,
    },
  } = useComputedValues({
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
  });

  const {
    submitLeaveMutation,
    fileOffsetMutation,
    fileResignationMutation,
    reviewLeaveMutation,
    reviewOffsetMutation,
    cancelMyPendingRequestMutation,
    requestCancellationApprovalMutation,
    addHrNoteMutation,
    reviewResignationMutation,
  } = useRequestMutation({
    showToast,
    setApplicationModalOpen,
    setResignationForm,
    setFormData,
    formData,
  });

  const canHrDirectDecision = (item) => {
    const roleValue = String(item?.requester_role || "")
      .trim()
      .toLowerCase();
    return roleValue === "supervisor";
  };

  const { handleSubmitLeave } = useHandleSubmiisions({
    formData,
    setFormError,
    setConfirmAction,
  });

  const handleLeaveTypeChange = (e) => {
    const newLeaveType = e.target.value;
    const newToDate =
      newLeaveType === "Birthday Leave" && formData.fromDate
        ? formData.fromDate
        : "";
    setFormData({
      ...formData,
      leaveType: newLeaveType,
      toDate: newToDate,
      daysApplied: "",
    });
    setFormError("");
  };

  const submitCancellationRequest = (item, cancellationReason) => {
    const trimmedReason = String(cancellationReason || "").trim();
    if (!trimmedReason) {
      showToast("Cancellation reason is required.", "error");
      return;
    }

    requestCancellationApprovalMutation.mutate({
      item,
      cancellationReason: trimmedReason,
    });
  };

  const handleFromDateChange = (e) => {
    const newFromDate = e.target.value;
    const newToDate =
      formData.leaveType === "Birthday Leave" ? newFromDate : "";
    setFormData({ ...formData, fromDate: newFromDate, toDate: newToDate });
    setFormError("");
  };

  const handleToDateChange = (e) => {
    const toDate = e.target.value;
    if (!toDate) {
      setFormData({ ...formData, toDate: "" });
      setFormError("");
      return;
    }

    if (formData.leaveType !== "Offset") {
      const policy = leavePolicy[formData.leaveType];
      if (formData.fromDate && toDate && policy) {
        const businessDays = calculateBusinessDays(
          new Date(formData.fromDate),
          new Date(toDate),
        );
        if (businessDays > policy.maxDays) {
          setFormError(
            `Maximum ${policy.maxDays} business day(s) allowed for ${formData.leaveType}`,
          );
          return;
        }
      }
    }
    setFormData({ ...formData, toDate });
    setFormError("");
  };

  const getMaxToDate = () => {
    if (!formData.fromDate || formData.leaveType === "Offset") return "";
    const policy = leavePolicy[formData.leaveType];
    const startDate = new Date(formData.fromDate);
    let daysAdded = 0;
    const maxDays = policy.maxDays;
    while (daysAdded < maxDays) {
      startDate.setDate(startDate.getDate() + 1);
      if (startDate.getDay() !== 0 && startDate.getDay() !== 6) daysAdded++;
    }
    return startDate.toISOString().split("T")[0];
  };

  const openLeaveDecisionConfirm = (
    item,
    status,
    decisionMode = "application",
  ) => {
    const totalDays = getDateDiffInclusive(item.date_from, item.date_to);
    const requestedDates = getDateRangeInclusive(item.date_from, item.date_to);
    const isMultiDay = totalDays > 1;

    setReviewConfirm({
      module: "leave",
      status,
      decisionMode,
      item,
      isMultiDay,
      totalDays,
      selectedDates: status === "Approved" ? requestedDates : [],
      remarks: "",
    });
  };

  const openOffsetDecisionConfirm = (
    item,
    status,
    decisionMode = "application",
  ) => {
    const totalDays = getOffsetRequestedDays(item);
    const isMultiDay = totalDays > 1;

    setReviewConfirm({
      module: "offset",
      status,
      decisionMode,
      item,
      isMultiDay,
      isPartial: false,
      approvedDays: totalDays,
      remarks: "",
    });
  };

  const openResignationDecisionConfirm = (
    item,
    status,
    decisionMode = "application",
  ) => {
    setReviewConfirm({
      module: "resignation",
      status,
      decisionMode,
      item,
      remarks: "",
    });
  };

  const toggleLeaveApprovedDate = (date) => {
    if (!reviewConfirm || reviewConfirm.module !== "leave") return;
    const selected = new Set(reviewConfirm.selectedDates || []);
    if (selected.has(date)) selected.delete(date);
    else selected.add(date);
    setReviewConfirm({
      ...reviewConfirm,
      selectedDates: Array.from(selected).sort(),
    });
  };

  const submitReviewDecision = () => {
    if (!reviewConfirm) return;

    const trimmedRemarks = String(reviewConfirm.remarks || "").trim();
    const isDenyDecision = reviewConfirm.status === "Denied";

    if (isDenyDecision && !trimmedRemarks) {
      showToast("Reason is required for denial.", "error");
      return;
    }

    if (reviewConfirm.module === "leave") {
      if (reviewConfirm.decisionMode === "cancellation") {
        reviewLeaveMutation.mutate({
          id: reviewConfirm.item.id,
          item: reviewConfirm.item,
          status: reviewConfirm.status,
          decision_mode: "cancellation",
          supervisor_remarks: isDenyDecision ? trimmedRemarks : undefined,
        });
        setReviewConfirm(null);
        return;
      }

      const requestedDates = getDateRangeInclusive(
        reviewConfirm.item.date_from,
        reviewConfirm.item.date_to,
      );
      const selectedDates = reviewConfirm.selectedDates || [];

      if (
        reviewConfirm.status === "Approved" &&
        reviewConfirm.isMultiDay &&
        selectedDates.length === 0
      ) {
        showToast("Select at least one day to approve.", "error");
        return;
      }

      const isPartialApproval =
        reviewConfirm.status === "Approved" &&
        reviewConfirm.isMultiDay &&
        selectedDates.length < requestedDates.length;

      const payload = {
        id: reviewConfirm.item.id,
        item: reviewConfirm.item,
        status:
          reviewConfirm.status === "Denied"
            ? "Denied"
            : isPartialApproval
              ? "Partially Approved"
              : "Approved",
      };

      if (isPartialApproval) {
        payload.approved_days = selectedDates.length;
        payload.approved_dates = selectedDates;
      }

      if (isDenyDecision) {
        payload.supervisor_remarks = trimmedRemarks;
      }

      reviewLeaveMutation.mutate(payload);
      setReviewConfirm(null);
      return;
    }

    if (reviewConfirm.module === "offset") {
      if (reviewConfirm.decisionMode === "cancellation") {
        reviewOffsetMutation.mutate({
          id: reviewConfirm.item.id,
          item: reviewConfirm.item,
          status: reviewConfirm.status,
          decision_mode: "cancellation",
          supervisor_remarks: isDenyDecision ? trimmedRemarks : undefined,
        });
        setReviewConfirm(null);
        return;
      }

      if (reviewConfirm.status === "Approved") {
        const approvedDays = Number(reviewConfirm.approvedDays || 0);
        const totalDays = getOffsetRequestedDays(reviewConfirm.item);

        if (!approvedDays || approvedDays <= 0 || approvedDays > totalDays) {
          showToast(
            "Approved days must be between 0 and requested days.",
            "error",
          );
          return;
        }

        const isPartial = approvedDays < totalDays;

        const payload = {
          id: reviewConfirm.item.id,
          item: reviewConfirm.item,
          status: isPartial ? "Partially Approved" : "Approved",
        };

        if (isPartial) {
          payload.approved_days = approvedDays;
        }

        reviewOffsetMutation.mutate(payload);
      } else {
        reviewOffsetMutation.mutate({
          id: reviewConfirm.item.id,
          item: reviewConfirm.item,
          status: "Denied",
          supervisor_remarks: trimmedRemarks,
        });
      }
      setReviewConfirm(null);
      return;
    }

    if (reviewConfirm.module === "resignation") {
      reviewResignationMutation.mutate({
        id: reviewConfirm.item.id,
        item: reviewConfirm.item,
        status: reviewConfirm.status === "Denied" ? "Rejected" : "Approved",
        review_remarks: isDenyDecision ? trimmedRemarks : undefined,
        decision_mode:
          reviewConfirm.decisionMode === "cancellation"
            ? "cancellation"
            : undefined,
      });
      setReviewConfirm(null);
    }
  };

  if (isLoadingLeaves || isLoadingOffsets || isLoadingResignations) {
    return (
      <div className="p-6 font-bold text-gray-800">Loading your data...</div>
    );
  }

  return (
    <div className="max-w-full">
      <ActionButtons
        currentUser={currentUser}
        isAdminRole={isAdminRole}
        isApprover={isApprover}
        myRequestRows={myRequestRows}
        totalPendingCount={totalPendingCount}
        onFileNewApplication={() => {
          setApplicationType("leave");
          setApplicationModalOpen(true);
        }}
        onShowMyPending={() => setMyPendingModalOpen(true)}
        onShowPendingApproval={() => setPendingModalOpen(true)}
      />

      <LeaveCalendar
        leaves={calendarLeaves}
        attendance={isAdminRole ? [] : myAttendance}
        scopeOptions={calendarScopeOptions}
        activeScope={calendarScope}
        onScopeChange={setCalendarScope}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OffsetBalanceCard offsetBalance={offsetBalance} />
        <RequestHistoryTable myRequestHistory={myRequestHistory} />
      </div>

      <ModalsContainer
        applicationModalOpen={applicationModalOpen}
        currentUser={currentUser}
        setApplicationModalOpen={setApplicationModalOpen}
        applicationType={applicationType}
        setApplicationType={setApplicationType}
        formError={formError}
        handleFromDateChange={handleFromDateChange}
        handleLeaveTypeChange={handleLeaveTypeChange}
        handleToDateChange={handleToDateChange}
        getMaxToDate={getMaxToDate}
        formData={formData}
        setFormData={setFormData}
        availableLeaveTypes={availableLeaveTypes}
        difference={difference}
        handleSubmitLeave={handleSubmitLeave}
        resignationForm={resignationForm}
        setResignationForm={setResignationForm}
        resignationTypes={resignationTypes}
        fileResignationMutation={fileResignationMutation}
        pendingModalOpen={pendingModalOpen}
        isApprover={isApprover}
        setPendingModalOpen={setPendingModalOpen}
        pendingTypeFilter={pendingTypeFilter}
        setPendingTypeFilter={setPendingTypeFilter}
        allPendingRequests={allPendingRequests}
        pendingLeaveApprovals={pendingLeaveApprovals}
        pendingOffsetApprovals={pendingOffsetApprovals}
        pendingResignationApprovals={pendingResignationApprovals}
        filteredPendingRequests={filteredPendingRequests}
        isHRRole={isHRRole}
        canHrDirectDecision={canHrDirectDecision}
        isPendingApprovalStatus={isPendingApprovalStatus}
        openResignationDecisionConfirm={openResignationDecisionConfirm}
        openLeaveDecisionConfirm={openLeaveDecisionConfirm}
        openOffsetDecisionConfirm={openOffsetDecisionConfirm}
        setHrNoteConfirm={setHrNoteConfirm}
        myPendingModalOpen={myPendingModalOpen}
        setMyPendingModalOpen={setMyPendingModalOpen}
        myRequestRows={myRequestRows}
        cancelMyPendingRequestMutation={cancelMyPendingRequestMutation}
        setCancelPendingConfirm={setCancelPendingConfirm}
        requestCancellationApprovalMutation={
          requestCancellationApprovalMutation
        }
        setCancelApprovalConfirm={setCancelApprovalConfirm}
        confirmAction={confirmAction}
        setConfirmAction={setConfirmAction}
        fileOffsetMutation={fileOffsetMutation}
        submitLeaveMutation={submitLeaveMutation}
        reviewConfirm={reviewConfirm}
        setReviewConfirm={setReviewConfirm}
        getDateRangeInclusive={getDateRangeInclusive}
        toggleLeaveApprovedDate={toggleLeaveApprovedDate}
        parseDateOnly={parseDateOnly}
        getOffsetRequestedDays={getOffsetRequestedDays}
        submitReviewDecision={submitReviewDecision}
        cancelApprovalConfirm={cancelApprovalConfirm}
        cancelPendingConfirm={cancelPendingConfirm}
        hrNoteConfirm={hrNoteConfirm}
        addHrNoteMutation={addHrNoteMutation}
        reviewResignationMutation={reviewResignationMutation}
        showToast={showToast}
        submitCancellationRequest={submitCancellationRequest}
      />

      <Toast toast={toast} onClose={clearToast} />
    </div>
  );
}
