"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";

function SessionTokenSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (typeof window !== "undefined" && session) {
      if (window.location.pathname.startsWith("/login")) {
        return;
      }

      const accessToken = (session as any)?.accessToken;
      const refreshToken = (session as any)?.refreshToken;
      const user = session?.user;

      // Do not resurrect stale tokens if local tokens were explicitly cleared by a 401 handler
      const currentToken = localStorage.getItem("token");
      const currentRefresh = localStorage.getItem("refreshToken");
      if (!currentToken && !currentRefresh) {
        return;
      }

      if (accessToken && currentToken !== accessToken) {
        localStorage.setItem("token", accessToken);
      }
      if (refreshToken && currentRefresh !== refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }
    }
  }, [session]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: (failureCount, error: any) => {
          if (error?.response?.status === 401 || error?.response?.status === 403) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  }));

  return (
    <SessionProvider>
      <SessionTokenSync />
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
