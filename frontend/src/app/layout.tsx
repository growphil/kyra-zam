import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import BatteryPreloader from "@/components/layout/BatteryPreloader";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "KYRA ZAM 2.0 | Battery Pack Management System",
  description: "Advanced Battery Pack Management & Manufacturing ERP for industrial efficiency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${dmSans.variable} font-sans bg-[#F4F9FF] text-[#0B2148] antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <BatteryPreloader />
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
          <Toaster position="top-right" richColors theme="light" />
        </Providers>
      </body>
    </html>
  );
}
