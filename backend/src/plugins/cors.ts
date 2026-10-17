import fp from "fastify-plugin";
import fastifyCors from "@fastify/cors";
import { FastifyInstance } from "fastify";

export function getApprovedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Configured origins from environment variables
  const envOrigins = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.CORS_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((val) => (val as string).split(","))
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  for (const origin of envOrigins) {
    origins.add(origin);
  }

  // Explicitly approved production origins
  origins.add("https://kyra-zam.vercel.app");

  // Default local development origins
  if (process.env.NODE_ENV !== "production" || origins.size <= 1) {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://localhost:8000");
    origins.add("http://127.0.0.1:8000");
  }

  return origins;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Non-browser or same-origin requests do not include an Origin header
    return true;
  }

  const cleanOrigin = origin.trim().replace(/\/+$/, "");
  const approved = getApprovedOrigins();

  if (approved.has(cleanOrigin)) {
    return true;
  }

  // Also support secure Vercel deployment origins for kyra-zam
  try {
    const parsed = new URL(cleanOrigin);
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "kyra-zam.vercel.app" ||
        (parsed.hostname.endsWith(".vercel.app") && parsed.hostname.startsWith("kyra-zam")))
    ) {
      return true;
    }
  } catch {}

  // In non-production environments, also support local LAN IPs and dev tunnels
  if (process.env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(cleanOrigin);
      const host = parsed.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        return true;
      }
      if (host.endsWith(".devtunnels.ms")) {
        return true;
      }
      // LAN IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host)) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

export const corsPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  });
});
