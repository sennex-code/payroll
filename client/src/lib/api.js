import axiosInterceptor from "../hooks/interceptor";

export const getStoredToken = () => localStorage.getItem("wah_token") || "";

const toResponse = (status, statusText, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  json: async () => {
    const text = await payload.text();
    return text ? JSON.parse(text) : {};
  },
  blob: async () => payload,
});

export const apiFetch = async (path, options = {}) => {
  const { method = "GET", headers = {}, body } = options;

  try {
    const response = await axiosInterceptor.request({
      url: path,
      method,
      headers,
      data: body,
      responseType: "blob",
    });

    return toResponse(response.status, response.statusText, response.data);
  } catch (error) {
    if (error?.response) {
      const { data, status, statusText } = error.response;
      const payload = data instanceof Blob ? data : new Blob([data]);
      return toResponse(status, statusText, payload);
    }

    throw error;
  }
};