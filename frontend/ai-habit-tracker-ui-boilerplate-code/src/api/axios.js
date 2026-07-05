import axios from "axios";

// Build the base URL: if the env var is set, use it; otherwise fallback to localhost:8000/api
let baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// Ensure it ends with "/api" (so that requests go to /api/...)
if (!baseURL.endsWith("/api")) {
  baseURL = `${baseURL}/api`;
}

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;