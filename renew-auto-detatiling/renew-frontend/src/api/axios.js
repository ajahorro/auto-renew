import axios from "axios";
import toast from "react-hot-toast";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

// Attach token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Handle expired tokens - but don't show error toast for specific operations
API.interceptors.response.use(
  (response) => response,

  (error) => {
    // Only show global toast for non-operation errors
    // Operations (status updates, assign staff) will handle their own errors
    const isOperationError = error.config?.url?.includes('/status') || 
                             error.config?.url?.includes('/cancel') ||
                             error.config?.url?.includes('/assign') ||
                             error.config?.url?.includes('/availability');
    
    if (!isOperationError) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Something went wrong";

      // 🔥 GLOBAL ERROR TOAST
      toast.error(message);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default API;