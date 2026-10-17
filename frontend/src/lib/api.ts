import axios from "axios";

/**
 * Dynamically resolves the Backend API base URL.
 * Supports:
 *  1. Explicit NEXT_PUBLIC_API_URL if configured.
 *  2. Auto-detection for VS Code Dev Tunnels (translates -3000 to -8000).
 *  3. Auto-detection for LAN IP / Wi-Fi sharing (e.g., http://192.168.x.x:3000 -> :8000).
 *  4. Fallback to http://localhost:8000 for standard local development.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  // If NEXT_PUBLIC_API_URL is explicitly configured, always honor it
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  // Client-side dynamic host detection for local/staging development
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    // A. VS Code / Microsoft Dev Tunnels auto-mapping
    // e.g. https://l19zlb3p-3000.inc1.devtunnels.ms -> https://l19zlb3p-8000.inc1.devtunnels.ms
    if (hostname.includes("devtunnels.ms") && hostname.includes("-3000")) {
      const backendHostname = hostname.replace("-3000", "-8000");
      return `${protocol}//${backendHostname}`;
    }

    // B. Local LAN IPv4 sharing (e.g., 192.168.0.7:3000 -> 192.168.0.7:8000)
    // Only apply for private LAN ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isPrivateLan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
    if (isPrivateLan) {
      return `${protocol}//${hostname}:8000`;
    }
  }

  return "http://localhost:8000";
}

/**
 * Dynamically resolves the WebSocket URL for live realtime telemetry/sync.
 */
export function getWsBaseUrl(): string {
  const envWs = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (envWs) {
    return envWs.replace(/\/+$/, "");
  }

  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith("https://")) {
    return apiBase.replace(/^https:\/\//, "wss://");
  } else if (apiBase.startsWith("http://")) {
    return apiBase.replace(/^http:\/\//, "ws://");
  }
  return apiBase.replace(/^http/, "ws");
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to ensure token and baseURL are fresh on every client request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (typeof window === "undefined") {
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post(`${getApiBaseUrl()}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = refreshRes.data;
        if (accessToken) {
          localStorage.setItem("token", accessToken);
        }
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export async function downloadAuthenticatedFile(urlPath: string, filename?: string) {
  const fullUrl = urlPath.startsWith("http")
    ? urlPath
    : `${getApiBaseUrl().replace(/\/+$/, "")}/${urlPath.replace(/^\/+/, "")}`;
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const response = await axios.get(fullUrl, {
    responseType: "blob",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const blob = new Blob([response.data], { type: (response.headers["content-type"] as string) || "application/pdf" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  if (filename) {
    link.download = filename;
  } else {
    link.target = "_blank";
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 10000);
}

export const getMediaUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  const backendBase = getApiBaseUrl();
  return `${backendBase.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
};

export default api;
