import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowDownToLine,
  ChevronRight,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  Search,
  Shield,
  Upload,
  Users,
  X,
} from "lucide-react";
import { URL as API_BASE_URL } from "../assets/constant";
import { apiFetch } from "../lib/api";
import Toast from "../components/Toast";
import NDADocument from "../components/pdfTemps/NDADocument.jsx";
import ResignationFormDocument from "../components/pdfTemps/ResignationFormDoc.jsx";
import ExitClearanceFormDocument from "../components/pdfTemps/ExitClearanceForm.jsx";
import ExitInterviewFormDocument from "../components/pdfTemps/ExitInterviewForm.jsx";
import ResignationLetterDoc from "../components/pdfTemps/ResignationLetterDoc.jsx";

const roleLabels = {
  Admin: "Admin Portal",
  HR: "HR Portal",
  Supervisor: "Supervisor Portal",
  RankAndFile: "Employee Portal",
};

const RESIGNATION_REASON_OPTIONS = [
  "Family and/or personal reasons",
  "Better career opportunity",
  "Pregnancy",
  "Poor Health/Physical Disability",
  "Relocation to another City/Country",
  "Termination",
  "Dissatisfaction with salary/allowances",
  "Dissatisfaction with the type of work",
  "Conflict with other employees/Supervisor/Manager",
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("default", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDisplayName(employee) {
  const firstName = String(employee?.first_name || "").trim();
  const lastName = String(employee?.last_name || "").trim();
  return `${firstName} ${lastName}`.trim() || employee?.emp_id || "Employee";
}

function normalizeString(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildDownloadBlobUrl(file, blob) {
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = file.file_name || file.file_type || "download";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}

export default function FileManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [isReplacingTemplate, setIsReplacingTemplate] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [templateReplaceTarget, setTemplateReplaceTarget] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [modalSourceFilter, setModalSourceFilter] = useState("all");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const templateInputRef = useRef(null);
  const templateReplaceInputRef = useRef(null);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("wah_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const role = currentUser?.role || "RankAndFile";
  const isCardLayout = ["Admin", "HR", "Supervisor"].includes(role);
  const canManageTemplates = role === "Admin" || role === "HR";
  const isSupervisorRole = role === "Supervisor";
  const filterAttributeKey = isSupervisorRole ? "position" : "designation";
  const filterAttributeLabel = isSupervisorRole ? "Position" : "Designation";

  const {
    data: inventory = { employees: [], files: [] },
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["file-management", role],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/file-management");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to load file inventory");
      }
      return payload;
    },
  });

  const {
    data: uploadedTemplates = [],
    refetch: refetchTemplates,
    isLoading: isLoadingTemplates,
  } = useQuery({
    queryKey: ["file-templates", role],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/file-templates");
      const payload = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(payload.message || "Failed to load templates");
      }
      return Array.isArray(payload) ? payload : [];
    },
  });

  const files = useMemo(
    () =>
      (inventory.files || []).filter(
        (file) => normalizeString(file.source) !== "profile",
      ),
    [inventory.files],
  );
  const employees = useMemo(
    () =>
      (inventory.employees || []).filter((employee) => {
        const normalizedRole = normalizeString(employee.role);
        const normalizedDesignation = normalizeString(employee.designation);
        return (
          normalizedRole !== "admin" && normalizedDesignation !== "admin system"
        );
      }),
    [inventory.employees],
  );
  const designationOptions = useMemo(() => {
    const optionsMap = new Map();

    employees.forEach((employee) => {
      const rawValue = String(employee[filterAttributeKey] || "").trim();
      if (!rawValue) return;
      const normalizedValue = normalizeString(rawValue);
      if (!optionsMap.has(normalizedValue)) {
        optionsMap.set(normalizedValue, rawValue);
      }
    });

    return [
      { value: "all", label: `All ${filterAttributeLabel}s` },
      ...Array.from(optionsMap.entries()).map(([value, label]) => ({
        value,
        label,
      })),
    ];
  }, [employees, filterAttributeKey, filterAttributeLabel]);

  const filteredEmployees = useMemo(() => {
    const search = normalizeString(searchTerm);

    return employees.filter((employee) => {
      const employeeName =
        String(employee.employee_name || "").trim() ||
        employee.display_name ||
        getDisplayName(employee);
      const employeePosition = String(employee.position || "").trim();
      const employeeDesignation = String(employee.designation || "").trim();
      const employeeFilterValue = normalizeString(employee[filterAttributeKey]);

      const matchesSearch =
        !search ||
        [employeeName, employeePosition, employeeDesignation, employee.emp_id]
          .join(" ")
          .toLowerCase()
          .includes(search);

      const matchesDesignation =
        designationFilter === "all" ||
        employeeFilterValue === designationFilter;

      return matchesSearch && matchesDesignation;
    });
  }, [designationFilter, employees, filterAttributeKey, searchTerm]);

  const filteredFiles = useMemo(() => {
    const search = normalizeString(searchTerm);
    return files.filter((file) => {
      const fileDesignation = String(file.designation || "").trim();
      const filePosition = String(file.position || "").trim();
      const matchesSearch =
        !search ||
        [
          file.employee_name,
          file.file_type,
          file.file_name,
          file.designation,
          file.position,
          file.request_type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);

      const matchesDesignation =
        designationFilter === "all" ||
        normalizeString(
          filterAttributeKey === "position" ? filePosition : fileDesignation,
        ) === designationFilter;

      return matchesSearch && matchesDesignation;
    });
  }, [designationFilter, files, filterAttributeKey, searchTerm]);

  const employeeCards = useMemo(() => {
    return filteredEmployees.map((employee) => ({
      employee,
      files: filteredFiles.filter((file) => file.emp_id === employee.emp_id),
    }));
  }, [filteredEmployees, filteredFiles]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.emp_id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );

  const selectedEmployeeFiles = useMemo(
    () => files.filter((file) => file.emp_id === selectedEmployeeId),
    [files, selectedEmployeeId],
  );

  const modalSourceCounts = useMemo(() => {
    const generated = selectedEmployeeFiles.filter(
      (file) => file.source === "generated",
    ).length;
    const resignation = selectedEmployeeFiles.filter(
      (file) => file.source === "resignation",
    ).length;
    return {
      all: selectedEmployeeFiles.length,
      generated,
      resignation,
    };
  }, [selectedEmployeeFiles]);

  const modalVisibleFiles = useMemo(() => {
    if (modalSourceFilter === "all") return selectedEmployeeFiles;
    return selectedEmployeeFiles.filter(
      (file) => file.source === modalSourceFilter,
    );
  }, [modalSourceFilter, selectedEmployeeFiles]);

  const modalFileGroups = useMemo(() => {
    const groups = new Map();

    modalVisibleFiles.forEach((file) => {
      const groupId = file.application_id || file.record_id || file.id;
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          requestType: file.request_type || "Resignation",
          requestStatus: file.request_status || "Pending Approval",
          files: [],
        });
      }
      groups.get(groupId).files.push(file);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aNewest = a.files.reduce(
        (latest, file) => Math.max(latest, new Date(file.uploaded_at || 0).getTime()),
        0,
      );
      const bNewest = b.files.reduce(
        (latest, file) => Math.max(latest, new Date(file.uploaded_at || 0).getTime()),
        0,
      );
      return bNewest - aNewest;
    });
  }, [modalVisibleFiles]);

  const stats = useMemo(
    () => [
      { label: "Visible employees", value: filteredEmployees.length },
      { label: "Visible files", value: filteredFiles.length },
      {
        label: "Templates",
        value: uploadedTemplates.length,
      },
    ],
    [filteredEmployees.length, filteredFiles.length, uploadedTemplates.length],
  );

  const showToast = (message, type = "success") => {
    setToast({ message, type, createdAt: Date.now() });
  };

  const formatDocDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  };

  const buildGeneratedDocument = (file) => {
    const data = file.document_data || {};
    const employeeName =
      String(data.employee_name || "").trim() || file.employee_name || "Employee";
    const interviewAnswers = Array.isArray(data.exit_interview_answers)
      ? data.exit_interview_answers
      : [];
    const checkedReasons = (Array.isArray(data.leaving_reasons)
      ? data.leaving_reasons
      : []
    )
      .map((reason) =>
        RESIGNATION_REASON_OPTIONS.findIndex(
          (option) => normalizeString(option) === normalizeString(reason),
        ),
      )
      .filter((index) => index >= 0);

    switch (file.template_type) {
      case "resignation_letter":
        return (
          <ResignationLetterDoc
            employeeName={employeeName}
            recipientName={data.recipient_name || ""}
            resignationDate={data.resignation_date || data.generated_at || ""}
            lastWorkingDay={data.last_working_day || ""}
            letterBody={data.resignation_letter || ""}
            position={data.position || ""}
          />
        );
      case "resignation_form":
        return (
          <ResignationFormDocument
            name={employeeName}
            position={data.position || ""}
            department={data.designation || ""}
            dateOfJoining={formatDocDate(data.hired_date)}
            resignationDate={formatDocDate(data.resignation_date)}
            lastWorkingDay={formatDocDate(data.last_working_day)}
            checkedReasons={checkedReasons}
            otherReason={data.leaving_reason_other || ""}
            employeeSignDate={formatDocDate(data.resignation_date)}
            employeeSignName={employeeName}
            supervisorSignDate=""
            supervisorSignName={data.recipient_name || ""}
          />
        );
      case "exit_interview":
        return (
          <ExitInterviewFormDocument
            answers={interviewAnswers}
            name={employeeName}
            position={data.position || ""}
            date={formatDocDate(data.resignation_date)}
          />
        );
      case "exit_clearance":
        return (
          <ExitClearanceFormDocument
            employeeNumber={data.emp_id || file.emp_id || ""}
            employeeName={employeeName}
            supervisorName={data.recipient_name || ""}
            department={data.designation || ""}
            dateOfHire={formatDocDate(data.hired_date)}
            lastWorkingDay={formatDocDate(data.last_working_day)}
            effectivityDate={formatDocDate(data.effective_date)}
          />
        );
      case "nda":
        return (
          <NDADocument
            employeeName={employeeName}
            employeeId={data.emp_id || file.emp_id || ""}
            employeeAddress={data.employee_address || ""}
            witness1Name="Ms. Jhuvy C. Dizon"
            witness1Title="Admin & Operations Officer"
            witness2Name="Robert Michael Martinez"
            witness2Title="Supervising Partner for Network and System"
          />
        );
      default:
        return null;
    }
  };

  const handlePreview = async (file) => {
    try {
      if (file.source === "generated") {
        const documentNode = buildGeneratedDocument(file);
        if (!documentNode) {
          throw new Error("Document preview is not available");
        }
        const blob = await pdf(documentNode).toBlob();
        const previewUrl = window.URL.createObjectURL(blob);
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (file.download_url) {
        window.open(file.download_url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      showToast(error.message || "Failed to preview file", "error");
    }
  };

  const handleDownload = async (file) => {
    try {
      if (file.source === "generated") {
        const documentNode = buildGeneratedDocument(file);
        if (!documentNode) {
          throw new Error("Document generation failed");
        }
        const blob = await pdf(documentNode).toBlob();
        buildDownloadBlobUrl(file, blob);
        return;
      }

      const res = await apiFetch(file.download_url);

      if (!res.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await res.blob();
      buildDownloadBlobUrl(file, blob);
    } catch (error) {
      showToast(error.message || "Failed to download file", "error");
    }
  };

  const openReplacePicker = (file) => {
    setReplaceTarget(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const openEmployeeModal = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setModalSourceFilter("all");
  };

  const closeEmployeeModal = () => {
    setSelectedEmployeeId(null);
    setModalSourceFilter("all");
  };

  useEffect(() => {
    if (!selectedEmployee) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeEmployeeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEmployee]);

  const downloadUploadedTemplate = async (template) => {
    try {
      const res = await apiFetch(
        `/api/employees/file-templates/${template.id}/download`,
      );
      if (!res.ok) {
        throw new Error("Failed to download template");
      }
      const blob = await res.blob();
      buildDownloadBlobUrl(
        {
          file_name: template.original_name || template.title || "template",
          file_type: "Template",
        },
        blob,
      );
    } catch (error) {
      showToast(error.message || "Failed to download template", "error");
    }
  };

  const deleteUploadedTemplate = async (template) => {
    try {
      const res = await apiFetch(
        `/api/employees/file-templates/${template.id}`,
        {
          method: "DELETE",
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to delete template");
      }
      showToast("Template deleted successfully.");
      await refetchTemplates();
    } catch (error) {
      showToast(error.message || "Failed to delete template", "error");
    }
  };

  const openTemplateReplacePicker = (template) => {
    setTemplateReplaceTarget(template);
    if (templateReplaceInputRef.current) {
      templateReplaceInputRef.current.value = "";
      templateReplaceInputRef.current.click();
    }
  };

  const handleTemplateReplaceChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !templateReplaceTarget) return;

    setIsReplacingTemplate(true);
    try {
      const uploadPayload = new FormData();
      uploadPayload.append("template_file", file);
      uploadPayload.append("title", templateReplaceTarget.title || "");
      uploadPayload.append("category", templateReplaceTarget.category || "");

      const uploadRes = await apiFetch("/api/employees/file-templates", {
        method: "POST",
        body: uploadPayload,
      });
      const uploadResult = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(
          uploadResult.message || "Failed to upload replacement template",
        );
      }

      const deleteRes = await apiFetch(
        `/api/employees/file-templates/${templateReplaceTarget.id}`,
        {
          method: "DELETE",
        },
      );
      const deleteResult = await deleteRes.json().catch(() => ({}));
      if (!deleteRes.ok) {
        throw new Error(
          deleteResult.message ||
            "Replacement uploaded but old template could not be removed",
        );
      }

      showToast("Template replaced successfully.");
      await refetchTemplates();
    } catch (error) {
      showToast(error.message || "Failed to replace template", "error");
    } finally {
      setIsReplacingTemplate(false);
      setTemplateReplaceTarget(null);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleTemplateUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingTemplate(true);
    try {
      const payload = new FormData();
      payload.append("template_file", file);
      payload.append("title", templateTitle);
      payload.append("category", templateCategory);

      const res = await apiFetch("/api/employees/file-templates", {
        method: "POST",
        body: payload,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.message || "Failed to upload template");
      }

      setTemplateTitle("");
      setTemplateCategory("");
      showToast("Template uploaded successfully.");
      await refetchTemplates();
    } catch (error) {
      showToast(error.message || "Failed to upload template", "error");
    } finally {
      setIsUploadingTemplate(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleReplaceChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !replaceTarget) return;

    setIsReplacing(true);
    try {
      if (replaceTarget.source === "profile") {
        const payload = new FormData();
        payload.append("profile_photo", file);

        const res = await apiFetch(
          `/api/employees/${replaceTarget.emp_id}/photo`,
          {
            method: "POST",
            body: payload,
          },
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(result.message || "Failed to replace profile photo");
        }
      } else {
        const uploadPayload = new FormData();
        uploadPayload.append("requiredFiles", file);

        const uploadRes = await apiFetch("/api/file/upload", {
          method: "POST",
          body: uploadPayload,
        });
        const uploadResult = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(uploadResult.message || "File upload failed");
        }

        const uploaded = Array.isArray(uploadResult.files)
          ? uploadResult.files[0]
          : null;

        if (!uploaded?.key) {
          throw new Error("Upload succeeded but no file key was returned");
        }

        const replaceRes = await apiFetch(
          `/api/employees/resignations/${replaceTarget.record_id}/file`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_field: replaceTarget.file_field,
              file_key: uploaded.key,
              old_file_key: replaceTarget.file_key,
            }),
          },
        );
        const replaceResult = await replaceRes.json().catch(() => ({}));
        if (!replaceRes.ok) {
          throw new Error(replaceResult.message || "Failed to replace file");
        }
      }

      showToast("File replaced successfully.");
      await refetch();
    } catch (error) {
      showToast(error.message || "Failed to replace file", "error");
    } finally {
      setIsReplacing(false);
      setReplaceTarget(null);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const renderTemplateModal = () => {
    if (!isTemplatesOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setIsTemplatesOpen(false);
          }
        }}
      >
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.24em] text-gray-500">
                Templates
              </p>
              <h2 className="m-0 mt-1 text-lg font-bold text-gray-900">
                Downloadable Templates
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsTemplatesOpen(false)}
              className="rounded-md border-0 bg-transparent px-2 py-1 text-lg text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>

          <div className="max-h-[72vh] overflow-auto p-5">
            {canManageTemplates && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="m-0 text-sm font-bold text-slate-900">
                  Manage Uploaded Templates
                </p>
                <p className="m-0 mt-1 text-sm text-slate-600">
                  Upload shared templates for all users in the file management
                  portal.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={templateTitle}
                    onChange={(event) => setTemplateTitle(event.target.value)}
                    placeholder="Template title"
                    className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="text"
                    value={templateCategory}
                    onChange={(event) =>
                      setTemplateCategory(event.target.value)
                    }
                    placeholder="Category (optional)"
                    className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    disabled={isUploadingTemplate}
                    onClick={() => {
                      if (templateInputRef.current) {
                        templateInputRef.current.click();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Upload className="h-4 w-4" />
                    {isUploadingTemplate ? "Uploading..." : "Upload Template"}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Resignation documents are generated dynamically per application in
              File Management. This section is for uploaded shared templates.
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="m-0 text-sm font-bold text-slate-900">
                Uploaded Templates
              </p>
              <p className="m-0 mt-1 text-sm text-slate-600">
                Download shared templates uploaded by Admin/HR.
              </p>

              {isLoadingTemplates ? (
                <p className="m-0 mt-3 text-sm text-slate-500">
                  Loading templates...
                </p>
              ) : uploadedTemplates.length === 0 ? (
                <p className="m-0 mt-3 text-sm text-slate-500">
                  No uploaded templates yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {uploadedTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-slate-900">
                          {template.title}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-slate-500">
                          {template.category || "General"} •{" "}
                          {template.original_name} •{" "}
                          {formatDate(template.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => downloadUploadedTemplate(template)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                        {canManageTemplates && (
                          <button
                            type="button"
                            disabled={isReplacingTemplate}
                            onClick={() => openTemplateReplacePicker(template)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {isReplacingTemplate &&
                            templateReplaceTarget?.id === template.id
                              ? "Replacing..."
                              : "Replace"}
                          </button>
                        )}
                        {canManageTemplates && (
                          <button
                            type="button"
                            onClick={() => deleteUploadedTemplate(template)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmployeeFilesModal = () => {
    if (!selectedEmployee) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
        <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                Employee Files
              </p>
              <h2 className="m-0 mt-1 text-lg font-bold text-slate-900">
                {selectedEmployee.display_name ||
                  getDisplayName(selectedEmployee)}
              </h2>
              <p className="m-0 mt-1 text-sm text-slate-600">
                {selectedEmployee.position || "-"} •{" "}
                {selectedEmployee.designation || "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeEmployeeModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-h-0 overflow-auto">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All", count: modalSourceCounts.all },
                    {
                      key: "generated",
                      label: "Generated",
                      count: modalSourceCounts.generated,
                    },
                    {
                      key: "resignation",
                      label: "Resignation",
                      count: modalSourceCounts.resignation,
                    },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setModalSourceFilter(option.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                        modalSourceFilter === option.key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {option.label} ({option.count})
                    </button>
                  ))}
                </div>
              </div>

              {modalFileGroups.length === 0 ? (
                <div className="p-8 text-center text-slate-600">
                  <p className="m-0 text-sm font-semibold text-slate-800">
                    No files in this source filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {modalFileGroups.map((group) => (
                    <section
                      key={group.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-700">
                          {group.requestType} Application #{group.id}
                        </p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {group.requestStatus}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {group.files.map((file) => (
                          <div
                            key={file.id}
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="m-0 truncate text-sm font-bold text-slate-900">
                                  {file.file_type}
                                </p>
                                <p className="m-0 mt-1 truncate text-xs text-slate-600">
                                  {file.file_name || file.file_key || "Generated document"}
                                </p>
                                <p className="m-0 mt-1 text-[11px] text-slate-500">
                                  {formatDate(file.uploaded_at)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  {file.source}
                                </span>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                  {file.file_status || (file.source === "generated" ? "generated" : "uploaded")}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handlePreview(file)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownload(file)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                              >
                                <ArrowDownToLine className="h-3.5 w-3.5" />
                                Download
                              </button>
                              {file.replaceable && (
                                <button
                                  type="button"
                                  onClick={() => openReplacePicker(file)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  Replace
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 font-bold text-gray-800">
        Loading file inventory...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 font-bold text-red-600">
        Failed to load file inventory.
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-4 text-white md:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.28em] text-white/55">
                File Management
              </p>
              <h1 className="m-0 mt-1 text-xl font-bold tracking-tight md:text-2xl">
                {roleLabels[role] || "File Portal"}
              </h1>
              <p className="m-0 mt-1 max-w-xl text-xs text-white/70 md:text-sm">
                Manage resignation document groups per application, including
                generated forms and uploaded files, with quick preview,
                download, and status tracking.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 backdrop-blur"
                >
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-white/55">
                    {stat.label}
                  </p>
                  <p className="m-0 mt-1 text-lg font-bold text-white md:text-xl">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search employee, position, designation, or file name"
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Users className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="flex flex-wrap gap-2">
                  {designationOptions.map((option) => {
                    const isActive = designationFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDesignationFilter(option.value)}
                        aria-pressed={isActive}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setIsTemplatesOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Shield className="h-4 w-4" />
                Templates
              </button>
            </div>
          </div>
        </div>
      </div>

      {isCardLayout && employeeCards.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 shadow-sm">
          <p className="m-0 text-lg font-semibold text-slate-800">
            No employees are available in this scope.
          </p>
        </div>
      ) : !isCardLayout && filteredFiles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 shadow-sm">
          <p className="m-0 text-lg font-semibold text-slate-800">
            No files match your filters.
          </p>
          <p className="m-0 mt-2 text-sm">
            Try a different employee name or {filterAttributeLabel.toLowerCase()}.
          </p>
        </div>
      ) : isCardLayout ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {employeeCards.map(({ employee, files: employeeFiles }) => {
            const profilePhoto = String(employee.profile_photo || "").trim();
            const employeeName =
              String(employee.employee_name || "").trim() ||
              employee.display_name ||
              getDisplayName(employee);
            const employeePosition =
              String(employee.position || "").trim() || "Unassigned position";
            const employeeDesignation =
              String(employee.designation || "").trim() || "No designation";

            return (
              <button
                key={employee.emp_id}
                type="button"
                onClick={() => openEmployeeModal(employee.emp_id)}
                aria-label={`Open files for ${employeeName}, ${employeePosition}`}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-slate-500">
                    {profilePhoto ? (
                      <img
                        src={`${API_BASE_URL}/${String(profilePhoto).replace(/^\/+/, "")}`}
                        alt={employee.employee_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Users className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-sm font-bold text-slate-900">
                      {employeeName}
                    </h2>
                    <p className="m-0 mt-0.5 truncate text-xs text-slate-600">
                      {employeePosition}
                    </p>
                    <p className="m-0 mt-1 truncate text-[11px] text-slate-500">
                      {employeeDesignation} • {employee.emp_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      <Eye className="h-3 w-3" />
                      {employeeFiles.length} file
                      {employeeFiles.length === 1 ? "" : "s"}
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-slate-500">
                      View Files
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">File Type</th>
                  <th className="px-5 py-3">File Name</th>
                  <th className="px-5 py-3">Uploaded</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {file.employee_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {file.position || "-"} • {file.designation || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-800">
                      {file.file_type}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {file.file_name || file.file_key}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(file.uploaded_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(file)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => openReplacePicker(file)}
                          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Replace
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {renderTemplateModal()}
      {renderEmployeeFilesModal()}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleReplaceChange}
      />
      <input
        ref={templateInputRef}
        type="file"
        className="hidden"
        onChange={handleTemplateUpload}
      />
      <input
        ref={templateReplaceInputRef}
        type="file"
        className="hidden"
        onChange={handleTemplateReplaceChange}
      />

      <Toast
        toast={toast}
        onClose={() => {
          setToast(null);
        }}
      />

      {isReplacing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
          <div className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-lg">
            Replacing file...
          </div>
        </div>
      )}
    </div>
  );
}
