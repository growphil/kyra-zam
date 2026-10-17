"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";

function SessionTokenSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (typeof window !== "undefined" && session) {
      const accessToken = (session as any)?.accessToken;
      const refreshToken = (session as any)?.refreshToken;
      const user = session?.user;

      if (accessToken && localStorage.getItem("token") !== accessToken) {
        localStorage.setItem("token", accessToken);
      }
      if (refreshToken && localStorage.getItem("refreshToken") !== refreshToken) {
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
        retry: 1,
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
