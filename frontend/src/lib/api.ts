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

  // If user explicitly configured an external or non-localhost API URL in .env, honor it
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/+$/, "");
  }

  // Client-side dynamic host detection
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    // A. VS Code / Microsoft Dev Tunnels auto-mapping
    // e.g. https://l19zlb3p-3000.inc1.devtunnels.ms -> https://l19zlb3p-8000.inc1.devtunnels.ms
    if (hostname.includes("devtunnels.ms") && hostname.includes("-3000")) {
      const backendHostname = hostname.replace("-3000", "-8000");
      return `${protocol}//${backendHostname}`;
    }

    // B. Local LAN IPv4 sharing (e.g., 192.168.0.7:3000 -> 192.168.0.7:8000)
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIpAddress && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }
  }

  return (envUrl || "http://localhost:8000").replace(/\/+$/, "");
}

/**
 * Dynamically resolves the WebSocket URL for live realtime telemetry/sync.
 */
export function getWsBaseUrl(): string {
  const envWs = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (envWs && !envWs.includes("localhost") && !envWs.includes("127.0.0.1")) {
    return envWs.replace(/\/+$/, "");
  }

  const apiBase = getApiBaseUrl();
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

export const getMediaUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  const backendBase = getApiBaseUrl();
  return `${backendBase.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
};

export default api;
