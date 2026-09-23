import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import Sidebar from "./Sidebar";
import { apiFetch } from "../lib/api";
import axiosInterceptor from "../hooks/interceptor";

const STORAGE_TOKEN_KEY = "wah_token";
const STORAGE_USER_KEY = "wah_user";

export default function MainLayout({ role }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationPanelRef = useRef(null);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- NOTIFICATIONS LOGIC ---
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiFetch("/api/employees/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => n.status === "Unread").length;

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiFetch(`/api/employees/notifications/${id}/read`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries(["notifications"]),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/employees/notifications/read-all", {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to mark all notifications as read");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries(["notifications"]),
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiFetch(`/api/employees/notifications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries(["notifications"]),
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/employees/notifications", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete notifications");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries(["notifications"]),
  });

  const handleNotificationClick = (item) => {
    const referenceType = String(item?.reference_type || "").toLowerCase();
    const tabByReference = {
      leave: "leave",
      offset: "offset",
      resignation: "resignation",
    };

    const tab = tabByReference[referenceType] || "leave";
    const params = new URLSearchParams({ tab });

    if (item?.reference_id !== null && item?.reference_id !== undefined) {
      params.set("requestId", String(item.reference_id));
    }

    if (item.status === "Unread") {
      markReadMutation.mutate(item.id);
    }

    navigate(`/leave?${params.toString()}`);
    setOpenNotifications(false);
  };

  const processLogout = async () => {
    try {
      await axiosInterceptor.post("/api/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
      window.location.href = "/";
    }
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirmation(false);
    processLogout();
  };

  useEffect(() => {
    if (!openNotifications) return;

    const handlePointerDownOutside = (event) => {
      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(event.target)
      ) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
    };
  }, [openNotifications]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#f7f4ff] to-[#f5f6fb]">
      <header className="sticky top-0 z-20 border-b border-white/15 bg-gradient-to-r from-[#3e0d75] via-[#4d128f] to-[#5a1ea2] px-4 py-3 text-white shadow-sm backdrop-blur md:px-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20 md:flex"
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <h2 className="m-0 flex items-baseline gap-2">
              <span className="text-[0.95rem] font-extrabold uppercase tracking-[0.13em] text-white">
                Wireless Access For Health
              </span>
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/75">
                Payroll
              </span>
            </h2>
          </div>
          <div
            ref={notificationPanelRef}
            className="relative flex items-center gap-3"
          >
            <button
              type="button"
              onClick={() => setOpenNotifications((prev) => !prev)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {openNotifications && (
              <div className="absolute right-0 top-11 z-30 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="m-0 text-sm font-bold text-slate-900">
                    Notifications
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => markAllReadMutation.mutate()}
                      className="inline-flex items-center gap-1 bg-transparent text-xs font-semibold text-violet-700 border-0 cursor-pointer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all read
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Delete all notifications?",
                        );
                        if (!confirmed) return;
                        deleteAllNotificationsMutation.mutate();
                      }}
                      className="inline-flex items-center gap-1 bg-transparent text-xs font-semibold text-red-700 border-0 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete all
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="m-0 px-4 py-4 text-sm text-slate-500">
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 ${item.status === "Unread" ? "bg-violet-50/45" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(item)}
                          className="flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                        >
                          <p className="m-0 text-sm font-semibold text-slate-900">
                            {item.title}
                          </p>
                          <p className="m-0 mt-1 text-xs text-slate-600">
                            {item.message}
                          </p>
                          <p className="m-0 mt-1 text-[11px] text-slate-400">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotificationMutation.mutate(item.id);
                          }}
                          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                          title="Delete notification"
                          aria-label="Delete notification"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white">
              {role}
            </span>
          </div>
        </div>
      </header>

      <div
        className={`grid h-[calc(100vh-65px)] overflow-hidden grid-cols-1 ${isSidebarCollapsed ? "md:grid-cols-[84px_1fr]" : "md:grid-cols-[248px_1fr]"}`}
      >
        {/* We pass a function to the Sidebar to open the logout modal instead of logging out instantly */}
        <Sidebar
          role={role}
          isCollapsed={isSidebarCollapsed}
          onLogout={() => setShowLogoutConfirmation(true)}
        />
        <main className="h-full overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirmation && (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-0 w-full max-w-[400px] overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <h2 className="m-0 text-lg font-semibold text-white">
                Confirm Logout
              </h2>
              <button
                onClick={() => setShowLogoutConfirmation(false)}
                className="bg-transparent border-0 text-2xl cursor-pointer text-white/80 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="m-0 text-gray-700">
                Are you sure you want to log out?
              </p>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirmation(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold cursor-pointer hover:bg-gray-200 transition-colors border-0"
                >
                  No
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold cursor-pointer hover:bg-red-700 transition-colors border-0"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
