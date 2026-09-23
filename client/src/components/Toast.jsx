import { useEffect, useState } from "react";

const TOAST_DURATION_FALLBACK = 3000;
const EXIT_ANIMATION_MS = 180;

const TOAST_THEME = {
  success: {
    title: "Success",
    icon: "check",
    tone: "text-emerald-700",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    progress: "bg-emerald-500",
  },
  error: {
    title: "Error",
    icon: "x",
    tone: "text-rose-700",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    progress: "bg-rose-500",
  },
  warning: {
    title: "Warning",
    icon: "warning",
    tone: "text-amber-700",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    progress: "bg-amber-500",
  },
  info: {
    title: "Info",
    icon: "info",
    tone: "text-sky-700",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
    progress: "bg-sky-500",
  },
};

function ToastIcon({ kind }) {
  if (kind === "check") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path
          d="M5 12.5l4.2 4.2L19 7.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "x") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path
          d="M7 7l10 10M17 7L7 17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "warning") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          d="M12 4l8 14H4L12 4z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 9v4" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v5" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Toast({ toast, onClose }) {
  const [renderedToast, setRenderedToast] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setRenderedToast(toast);
      setTimeout(() => setIsVisible(true), 10);
      return;
    }

    if (renderedToast) {
      setIsVisible(false);
      const clearId = setTimeout(() => {
        setRenderedToast(null);
      }, EXIT_ANIMATION_MS);
      return () => clearTimeout(clearId);
    }
  }, [toast, renderedToast]);

  const payload = renderedToast || toast;
  const type = payload?.type || "success";
  const liveRole = type === "error" ? "alert" : "status";

  if (!payload) return null;

  const theme = TOAST_THEME[type] || TOAST_THEME.info;
  const duration = Math.max(
    800,
    Number(payload.duration || TOAST_DURATION_FALLBACK),
  );

  return (
    <div
      className={`pointer-events-auto fixed right-4 top-4 z-[80] w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.18)] transition-all duration-200 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0"
      }`}
      role={liveRole}
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${theme.iconBg} ${theme.iconColor}`}
        >
          <ToastIcon kind={theme.icon} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`m-0 text-sm font-bold tracking-tight ${theme.tone}`}>
            {theme.title}
          </p>
          <p className="m-0 mt-0.5 break-words text-[13px] leading-5 text-slate-700">
            {payload.message}
          </p>
        </div>

        {typeof onClose === "function" && (
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="h-1 w-full bg-slate-100" aria-hidden="true">
        <div
          key={`${payload.message}-${payload.type}-${payload.createdAt || "now"}`}
          className={`h-full ${theme.progress}`}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>

      <style>{`@keyframes toast-progress { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
}
