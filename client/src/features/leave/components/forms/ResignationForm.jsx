import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

const resignationReasonOptions = [
  "Family and/or personal reasons",
  "Better career opportunity",
  "Pregnancy",
  "Poor health / physical disability",
  "Relocation to another city/country",
  "Termination",
  "Dissatisfaction with salary/allowances",
  "Dissatisfaction with type of work",
  "Conflict with employees/supervisor/manager",
  "Others",
];

const exitInterviewQuestions = [
  "What caused you to start looking for a new job?",
  "Why have you decided to leave the company?",
  "Was a single event responsible for your decision to leave?",
  "What does your new company offer that influenced your decision?",
  "What do you value about this company?",
  "What did you dislike about the company?",
  "How was your relationship with your manager?",
  "What could your supervisor improve in their management style?",
  "What did you like most about your job?",
  "What did you dislike about your job? What would you change?",
  "Did you have the resources and support needed to do your job? If not, what was missing?",
  "Were your goals clear and expectations well defined?",
  "Did you receive adequate feedback on your performance?",
  "Did you feel aligned with the company’s mission and goals?",
  "Any recommendations regarding compensation, benefits, or recognition?",
  "What would make you consider returning? Would you recommend this company to others?",
];

const resignationStepLabels = [
  "Resignation Letter",
  "Employee Resignation Form",
  "Exit Interview Form",
  "Endorsement Form",
  "Submit Application",
];

function safeText(value) {
  const text = String(value || "").trim();
  const lowered = text.toLowerCase();
  if (!text) return "";
  if (
    lowered === "undefined" ||
    lowered === "null" ||
    lowered === "undefined undefined" ||
    lowered === "null null"
  ) {
    return "";
  }
  return text;
}

function toDateInputValue(value) {
  const normalized = safeText(value);
  if (!normalized) return "";
  return normalized.slice(0, 10);
}

function buildEmployeeDisplayName(currentUser) {
  const name = safeText(currentUser?.name);
  if (name) return name;
  return safeText(
    `${safeText(currentUser?.first_name)} ${safeText(currentUser?.last_name)}`,
  );
}

function getDefaultResignationWizardState(currentUser) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    resignation_letter: "",
    request_date: today,
    recipient_name: "Supervisor",
    recipient_emp_id: "",
    employee_name: buildEmployeeDisplayName(currentUser) || "Employee",
    position: safeText(currentUser?.position) || "N/A",
    designation: safeText(currentUser?.designation) || "N/A",
    hired_date: toDateInputValue(currentUser?.hired_date),
    resignation_date: "",
    last_working_day: "",
    leaving_reasons: [],
    leaving_reason_other: "",
    interview_answers: Array(16).fill(""),
    endorsement_file_key: "",
    endorsement_file_name: "",
  };
}

export default function ResignationForm({
  resignationForm,
  setResignationForm,
  setApplicationModalOpen,
  fileResignationMutation,
  currentUser: currentUserProp,
}) {
  const { showToast } = useToast();
  const currentUser = useMemo(
    () =>
      currentUserProp || JSON.parse(localStorage.getItem("wah_user") || "{}"),
    [currentUserProp],
  );

  const [internalForm, setInternalForm] = useState(() =>
    getDefaultResignationWizardState(currentUser),
  );
  const form = resignationForm || internalForm;
  const setForm = setResignationForm || setInternalForm;

  const [resignationStep, setResignationStep] = useState(1);
  const [resignationInterviewPart, setResignationInterviewPart] = useState(1);
  const [resignationWizardError, setResignationWizardError] = useState("");
  const [isUploadingEndorsement, setIsUploadingEndorsement] = useState(false);
  const [isEndorsementActionsOpen, setIsEndorsementActionsOpen] =
    useState(false);
  const [hasLoadedResignationDraft, setHasLoadedResignationDraft] =
    useState(false);
  const lastSavedResignationDraftRef = useRef("");
  const endorsementObjectUrlRef = useRef("");

  const revokeEndorsementObjectUrl = () => {
    if (endorsementObjectUrlRef.current) {
      window.URL.revokeObjectURL(endorsementObjectUrlRef.current);
      endorsementObjectUrlRef.current = "";
    }
  };

  useEffect(() => {
    return () => revokeEndorsementObjectUrl();
  }, []);

  useEffect(() => {
    setForm((prev) => {
      const base = getDefaultResignationWizardState(currentUser);
      return {
        ...base,
        ...(prev || {}),
        interview_answers: Array.isArray(prev?.interview_answers)
          ? prev.interview_answers
          : base.interview_answers,
        leaving_reasons: Array.isArray(prev?.leaving_reasons)
          ? prev.leaving_reasons
          : base.leaving_reasons,
      };
    });
  }, [currentUser, setForm]);

  const { data: resignationRecipient = null } = useQuery({
    queryKey: ["resignation-recipient", currentUser?.emp_id],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/resignations/recipient");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(currentUser?.emp_id),
  });

  const { data: resignationDraftData = null } = useQuery({
    queryKey: ["resignation-draft", currentUser?.emp_id],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/resignations/draft");
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.message || "Failed to load resignation draft");
      }
      return result?.draft || null;
    },
    enabled: Boolean(currentUser?.emp_id),
    refetchOnWindowFocus: false,
  });

  const saveResignationDraftMutation = useMutation({
    mutationFn: async ({ payload, step, interviewPart }) => {
      const res = await apiFetch("/api/employees/resignations/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, step, interviewPart }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.message || "Failed to save resignation draft");
      }
      return result;
    },
    onError: (err) =>
      showToast(err.message || "Failed to auto-save draft.", "error"),
  });

  useEffect(() => {
    if (!resignationRecipient) return;
    const recipientName = safeText(resignationRecipient.recipient_name);
    setForm((prev) => ({
      ...prev,
      request_date: resignationRecipient.request_date || prev.request_date,
      recipient_name: recipientName || prev.recipient_name || "Supervisor",
      recipient_emp_id:
        resignationRecipient.recipient_emp_id || prev.recipient_emp_id,
    }));
  }, [resignationRecipient, setForm]);

  useEffect(() => {
    setHasLoadedResignationDraft(false);
  }, []);

  useEffect(() => {
    if (hasLoadedResignationDraft) return;
    if (resignationDraftData?.payload) {
      const loadedStep = Number(resignationDraftData.step) || 1;
      const loadedInterviewPart =
        Number(resignationDraftData.interviewPart) || 1;

      setForm((prev) => ({
        ...prev,
        ...resignationDraftData.payload,
      }));
      setResignationStep(loadedStep);
      setResignationInterviewPart(loadedInterviewPart);
      lastSavedResignationDraftRef.current = JSON.stringify({
        payload: resignationDraftData.payload,
        step: loadedStep,
        interviewPart: loadedInterviewPart,
      });
    }

    setHasLoadedResignationDraft(true);
  }, [hasLoadedResignationDraft, resignationDraftData, setForm]);

  useEffect(() => {
    if (!hasLoadedResignationDraft) return;

    const draftPayload = {
      payload: form,
      step: resignationStep,
      interviewPart: resignationInterviewPart,
    };
    const draftSignature = JSON.stringify(draftPayload);

    if (lastSavedResignationDraftRef.current === draftSignature) return;

    const timer = setTimeout(() => {
      saveResignationDraftMutation.mutate(draftPayload, {
        onSuccess: () => {
          lastSavedResignationDraftRef.current = draftSignature;
        },
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [
    form,
    hasLoadedResignationDraft,
    resignationInterviewPart,
    resignationStep,
    saveResignationDraftMutation,
  ]);

  const uploadRequiredFile = async (file) => {
    const formData = new FormData();
    formData.append("requiredFiles", file);

    const res = await apiFetch("/api/file/upload", {
      method: "POST",
      body: formData,
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.message || "File upload failed");
    }

    const uploaded = Array.isArray(result.files) ? result.files[0] : null;
    if (!uploaded?.key) {
      throw new Error("Upload succeeded but no file key was returned");
    }

    return uploaded;
  };

  const loadUploadedEndorsementObjectUrl = async () => {
    const fileKey = String(form.endorsement_file_key || "").trim();
    if (!fileKey) {
      throw new Error("No uploaded endorsement file found.");
    }

    const res = await apiFetch(
      `/api/file/get?filename=${encodeURIComponent(fileKey)}`,
    );
    if (!res.ok) {
      throw new Error("Failed to retrieve uploaded endorsement file.");
    }

    const blob = await res.blob();
    revokeEndorsementObjectUrl();
    endorsementObjectUrlRef.current = window.URL.createObjectURL(blob);
    return endorsementObjectUrlRef.current;
  };

  const downloadUploadedEndorsement = async () => {
    try {
      const objectUrl = await loadUploadedEndorsementObjectUrl();
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = form.endorsement_file_name || "endorsement-file";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      showToast(error.message || "Unable to download uploaded file.", "error");
    }
  };

  const validateResignationStep = (step) => {
    if (step === 1) {
      if (!String(form.resignation_letter || "").trim()) {
        return "Resignation letter body is required.";
      }
      return "";
    }

    if (step === 2) {
      if (!form.resignation_date || !form.last_working_day) {
        return "Resignation date and last working day are required.";
      }
      if ((form.leaving_reasons || []).length === 0) {
        return "Select at least one reason for leaving.";
      }
      if (
        (form.leaving_reasons || []).includes("Others") &&
        !String(form.leaving_reason_other || "").trim()
      ) {
        return "Please provide details for Others.";
      }
      return "";
    }

    if (step === 3) {
      const hasBlankAnswer = (form.interview_answers || []).some(
        (answer) => !String(answer || "").trim(),
      );
      if (hasBlankAnswer) {
        return "All 16 exit interview answers are required.";
      }
      return "";
    }

    if (step === 4) {
      if (!String(form.endorsement_file_key || "").trim()) {
        return "Upload your completed endorsement form before continuing.";
      }
      return "";
    }

    return "";
  };

  const goToNextResignationStep = async () => {
    const validationError = validateResignationStep(resignationStep);
    if (validationError) {
      setResignationWizardError(validationError);
      return;
    }

    try {
      await saveResignationDraftMutation.mutateAsync({
        payload: form,
        step: resignationStep,
        interviewPart: resignationInterviewPart,
      });
      lastSavedResignationDraftRef.current = JSON.stringify({
        payload: form,
        step: resignationStep,
        interviewPart: resignationInterviewPart,
      });
    } catch {
      // Keep the wizard usable even if draft save fails.
    }

    setResignationWizardError("");
    setResignationStep((prev) => Math.min(prev + 1, 5));
  };

  const goToPreviousResignationStep = () => {
    setResignationWizardError("");
    setResignationStep((prev) => Math.max(prev - 1, 1));
  };

  const submitResignationWizard = async () => {
    const validationError =
      validateResignationStep(1) ||
      validateResignationStep(2) ||
      validateResignationStep(3) ||
      validateResignationStep(4);

    if (validationError) {
      setResignationWizardError(validationError);
      return;
    }

    const reasons = form.leaving_reasons || [];
    const reasonSummary = reasons.includes("Others")
      ? `${reasons.filter((item) => item !== "Others").join(", ")}; Others: ${String(form.leaving_reason_other || "").trim()}`
      : reasons.join(", ");

    const payload = {
      emp_id: currentUser?.emp_id,
      resignation_type: "Voluntary Resignation",
      effective_date: form.last_working_day,
      reason: reasonSummary,
      resignation_letter: form.resignation_letter,
      recipient_name: form.recipient_name,
      recipient_emp_id: form.recipient_emp_id || null,
      resignation_date: form.resignation_date,
      last_working_day: form.last_working_day,
      leaving_reasons: form.leaving_reasons,
      leaving_reason_other: form.leaving_reason_other,
      exit_interview_answers: form.interview_answers,
      endorsement_file_key: form.endorsement_file_key,
    };

    if (fileResignationMutation?.mutate) {
      fileResignationMutation.mutate(payload);
      return;
    }

    const res = await apiFetch("/api/employees/resignations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(result.message || "Failed to submit resignation", "error");
      return;
    }
    showToast("Resignation filed successfully.");
    setApplicationModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gray-500">
              Resignation Progress
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              Step {resignationStep} of {resignationStepLabels.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-500">
              {resignationStepLabels[resignationStep - 1]}
            </p>
            <p className="text-sm font-bold text-red-600">
              {Math.round(
                (resignationStep / resignationStepLabels.length) * 100,
              )}
              %
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-400 transition-all duration-300"
            style={{
              width: `${Math.max(8, (resignationStep / resignationStepLabels.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {resignationWizardError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {resignationWizardError}
        </div>
      )}

      {resignationStep === 1 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Current Date
            </label>
            <input
              type="date"
              value={form.request_date}
              disabled
              className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Recipient (Supervisor)
            </label>
            <input
              type="text"
              value={form.recipient_name}
              disabled
              className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Resignation Letter Body
            </label>
            <textarea
              rows={8}
              value={form.resignation_letter}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  resignation_letter: e.target.value,
                }))
              }
              placeholder="Write your resignation letter here..."
              className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      )}

      {resignationStep === 2 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Name
            </label>
            <input
              type="text"
              value={form.employee_name}
              disabled
              className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Position
            </label>
            <input
              type="text"
              value={form.position}
              disabled
              className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Department / Designation
            </label>
            <input
              type="text"
              value={form.designation}
              disabled
              className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Date of Joining
            </label>
            <input
              type="date"
              value={form.hired_date}
              disabled
              className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Resignation Date
            </label>
            <input
              type="date"
              value={form.resignation_date}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  resignation_date: e.target.value,
                }))
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Last Working Day
            </label>
            <input
              type="date"
              value={form.last_working_day}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  last_working_day: e.target.value,
                }))
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="md:col-span-2">
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Reason for Leaving (Select one or more)
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {resignationReasonOptions.map((reasonOption) => {
                const checked = (form.leaving_reasons || []).includes(
                  reasonOption,
                );
                return (
                  <label
                    key={reasonOption}
                    className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((prev) => {
                          const exists = (prev.leaving_reasons || []).includes(
                            reasonOption,
                          );
                          return {
                            ...prev,
                            leaving_reasons: exists
                              ? prev.leaving_reasons.filter(
                                  (item) => item !== reasonOption,
                                )
                              : [...(prev.leaving_reasons || []), reasonOption],
                          };
                        })
                      }
                    />
                    <span>{reasonOption}</span>
                  </label>
                );
              })}
            </div>
            {(form.leaving_reasons || []).includes("Others") && (
              <input
                type="text"
                value={form.leaving_reason_other}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    leaving_reason_other: e.target.value,
                  }))
                }
                placeholder="Specify other reason"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            )}
          </div>
        </div>
      )}

      {resignationStep === 3 && (
        <div className="space-y-3">
          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
            <p className="m-0 font-semibold">Instructions:</p>
            <p className="m-0 mt-1">
              Please answer each question honestly. Your responses will help
              Human Resources improve services and employee experience.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600">
            <span>Exit Interview Part {resignationInterviewPart} of 2</span>
            <span>Q{resignationInterviewPart === 1 ? "1-8" : "9-16"}</span>
          </div>

          <div className="space-y-3">
            {exitInterviewQuestions
              .slice(
                resignationInterviewPart === 1 ? 0 : 8,
                resignationInterviewPart === 1 ? 8 : 16,
              )
              .map((question, idx) => {
                const questionIndex =
                  (resignationInterviewPart === 1 ? 0 : 8) + idx;
                return (
                  <div key={question} className="space-y-1">
                    <label className="block text-xs font-bold text-gray-600">
                      {questionIndex + 1}. {question}
                    </label>
                    <textarea
                      rows={3}
                      value={form.interview_answers?.[questionIndex] || ""}
                      onChange={(e) =>
                        setForm((prev) => {
                          const nextAnswers = [
                            ...(prev.interview_answers || Array(16).fill("")),
                          ];
                          nextAnswers[questionIndex] = e.target.value;
                          return {
                            ...prev,
                            interview_answers: nextAnswers,
                          };
                        })
                      }
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                );
              })}
          </div>

          <div className="flex justify-end">
            {resignationInterviewPart === 1 ? (
              <button
                type="button"
                onClick={() => setResignationInterviewPart(2)}
                className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                Proceed to Part 2
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setResignationInterviewPart(1)}
                className="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300"
              >
                Back to Part 1
              </button>
            )}
          </div>
        </div>
      )}

      {resignationStep === 4 && (
        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Download the endorsement form, complete it offline, then upload the
            signed copy.
          </div>
          <a
            href="/forms/Resignee_Endorsement-Form.docx"
            download
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-bold text-white no-underline hover:bg-blue-700"
          >
            Download Endorsement Form (DOC)
          </a>

          <div className="rounded-md border border-gray-200 bg-white p-3">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
              Upload Completed Endorsement Form
            </label>
            <input
              type="file"
              accept=".doc,.docx,.pdf"
              disabled={isUploadingEndorsement}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setIsUploadingEndorsement(true);
                try {
                  const uploaded = await uploadRequiredFile(file);
                  setForm((prev) => ({
                    ...prev,
                    endorsement_file_key: uploaded.key,
                    endorsement_file_name: uploaded.fileName || file.name,
                  }));
                  setResignationWizardError("");
                  showToast("Endorsement form uploaded.");
                } catch (error) {
                  showToast(
                    error.message || "Failed to upload endorsement form.",
                    "error",
                  );
                } finally {
                  setIsUploadingEndorsement(false);
                  e.target.value = "";
                }
              }}
              className="block w-full text-sm"
            />
            {form.endorsement_file_key && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-medium text-emerald-700">
                  Uploaded: {form.endorsement_file_name}
                </p>
                <button
                  type="button"
                  onClick={() => setIsEndorsementActionsOpen(true)}
                  className="rounded-md border border-indigo-200 bg-indigo-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-200"
                >
                  View Uploaded File
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isEndorsementActionsOpen && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="m-0 text-sm font-bold text-gray-900">
                  Uploaded Endorsement File
                </p>
                <p className="m-0 mt-1 text-xs text-gray-600">
                  {form.endorsement_file_name || "endorsement-file"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEndorsementActionsOpen(false)}
                className="rounded-md border-0 bg-transparent px-2 py-1 text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={downloadUploadedEndorsement}
                className="rounded-md border border-blue-200 bg-blue-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 hover:bg-blue-200"
              >
                Download File
              </button>
            </div>
          </div>
        </div>
      )}

      {resignationStep === 5 && (
        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Review your details below, then click Submit Application for
            supervisor approval.
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
            <p className="m-0">
              <span className="font-semibold">Recipient:</span>{" "}
              {form.recipient_name}
            </p>
            <p className="m-0 mt-1">
              <span className="font-semibold">Resignation Date:</span>{" "}
              {form.resignation_date || "-"}
            </p>
            <p className="m-0 mt-1">
              <span className="font-semibold">Last Working Day:</span>{" "}
              {form.last_working_day || "-"}
            </p>
            <p className="m-0 mt-1">
              <span className="font-semibold">Reasons Selected:</span>{" "}
              {(form.leaving_reasons || []).join(", ") || "-"}
            </p>
            <p className="m-0 mt-1">
              <span className="font-semibold">Endorsement:</span>{" "}
              {form.endorsement_file_name || "Not uploaded"}
            </p>
          </div>
        </div>
      )}

      <div className="mt-2 flex justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (resignationStep === 1) {
              setApplicationModalOpen(false);
            } else {
              goToPreviousResignationStep();
            }
          }}
          className="cursor-pointer rounded-lg bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300"
        >
          {resignationStep === 1 ? "Cancel" : "Back"}
        </button>

        {resignationStep < 5 ? (
          <button
            type="button"
            onClick={goToNextResignationStep}
            className="cursor-pointer rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={fileResignationMutation?.isPending}
            onClick={submitResignationWizard}
            className="cursor-pointer rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            Submit Application
          </button>
        )}
      </div>
    </div>
  );
}
