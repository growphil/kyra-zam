"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useLayoutStore } from "@/store/layoutStore";
import { useEffect } from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { 
    isMobileSidebarOpen, 
    setMobileSidebar, 
    setSidebarCollapsed,
    sidebarPosition,
    setSidebarPosition,
    setSidebarWidth,
    setSidebarFontSize,
    setGroupOrder,
    setItemOrderMap,
    setRecentOpenedItems
  } = useLayoutStore();

  // Close mobile sidebar on page navigation
  useEffect(() => {
    setMobileSidebar(false);
  }, [pathname, setMobileSidebar]);

  // Load sidebar settings on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCollapsed = localStorage.getItem("sidebar-collapsed");
      if (savedCollapsed === "true") {
        setSidebarCollapsed(true);
      }

      const savedPos = localStorage.getItem("sidebar-position");
      if (savedPos === "left" || savedPos === "right") {
        setSidebarPosition(savedPos);
      }

      const savedWidth = localStorage.getItem("sidebar-width");
      if (savedWidth === "compact" || savedWidth === "standard" || savedWidth === "wide") {
        setSidebarWidth(savedWidth);
      }

      const savedFontSize = localStorage.getItem("sidebar-font-size");
      if (savedFontSize === "standard" || savedFontSize === "medium" || savedFontSize === "large") {
        setSidebarFontSize(savedFontSize);
      }

      try {
        const savedOrder = JSON.parse(localStorage.getItem("sidebar-group-order") || "[]");
        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
          setGroupOrder(savedOrder);
        }
      } catch {}

      try {
        const savedItemOrder = JSON.parse(localStorage.getItem("sidebar-item-order") || "{}");
        if (savedItemOrder && typeof savedItemOrder === "object" && !Array.isArray(savedItemOrder)) {
          setItemOrderMap(savedItemOrder);
        }
      } catch {}

      try {
        const savedRecent = JSON.parse(localStorage.getItem("sidebar-recent-openings") || "[]");
        if (Array.isArray(savedRecent) && savedRecent.length > 0) {
          setRecentOpenedItems(savedRecent);
        }
      } catch {}
    }
  }, [setSidebarCollapsed, setSidebarPosition, setSidebarWidth, setSidebarFontSize, setGroupOrder, setItemOrderMap, setRecentOpenedItems]);

  if (isLoginPage) {
    return <main className="min-h-screen bg-[#F4F9FF] text-[#0B2148]">{children}</main>;
  }

  const isRightAligned = sidebarPosition === "right";

  return (
    <div className={`flex min-h-screen bg-[#F4F9FF] text-[#0B2148] transition-all duration-300 ${
      isRightAligned ? "flex-row-reverse" : "flex-row"
    }`}>
      {/* Sidebar Container */}
      <Sidebar />
      
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#061B3A]/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      )}

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-8 sm:pb-12 overflow-auto max-w-[1700px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
