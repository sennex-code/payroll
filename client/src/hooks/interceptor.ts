import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const getAccessToken = () => localStorage.getItem("wah_token") || "";
const setAccessToken = (token: string) =>
  localStorage.setItem("wah_token", token);
const axiosInterceptor = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: true,

  headers: {
    "ngrok-skip-browser-warning": "69420",
  },
});

axiosInterceptor.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInterceptor.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        const refreshResponse =
          await axiosInterceptor.post("/api/auth/refresh");
        const newToken = refreshResponse.data.token;

        setAccessToken(newToken);
        console.log("intercepted!");

        console.log("New Token: ", newToken);
        console.log(
          "response error:",
          error.response?.status,
          originalRequest?.url,
        );
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return axiosInterceptor(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("wah_token");
        localStorage.removeItem("wah_user");
        window.location.href = "/";
      }
    }
    console.log("reject");
    return Promise.reject(error);
  },
);

export default axiosInterceptor;
