import { useEmail } from "@/hooks/useEmail";

export const useEmailNotifications = () => {
  const { sendLeaveStatusEmail } = useEmail();

  const handleSendUpdate = async (item: any, status: any, remarks: any) => {
    const header =
      status === "Denied"
        ? "Your leave request was not approved at this time."
        : "Your leave request has been approved. Please ensure proper task endorsement before your leave.";

    const finalContent = remarks ? `${header} \n\nReason: ${remarks}` : header;

    await sendLeaveStatusEmail(item, status, finalContent);
  };

  return handleSendUpdate;
};
