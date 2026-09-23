import { URL } from "../assets/constant";

export const getStoredToken = () => localStorage.getItem("wah_token") || "";

export const apiFetch = async (path, options = {}) => {
  const token = getStoredToken();

  const headers = {
    "ngrok-skip-browser-warning": "69420",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${URL}${path}`, {
    ...options,
    headers,
  });
};
