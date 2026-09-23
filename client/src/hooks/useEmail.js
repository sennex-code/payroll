import emailjs from "@emailjs/browser";

export const useEmail = () => {
  const sendLeaveStatusEmail = async (item, status, message = "") => {
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    const formatDate = (dateStr) => {
      if (!dateStr) return "N/A";
      return new Date(dateStr).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formattedStart = formatDate(item.date_from);
    const formattedEnd = formatDate(item.date_to);

    const templateParams = {
      email: item.email,
      employee_name: `${item.first_name} ${item.last_name}`,
      leave_dates: `${formattedStart} to ${formattedEnd}`,
      status: status,
      reason: item.reason || "No reason provided",
      leave_type: item.leave_type,

      message: message,
    };

    try {
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      console.log("Email sent successfully!");
    } catch (error) {
      console.error("EmailJS Error:", error);
    }
  };

  return { sendLeaveStatusEmail };
};
