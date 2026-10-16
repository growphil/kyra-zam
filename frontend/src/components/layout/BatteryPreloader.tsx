"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function BatteryPreloader() {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<"boot" | "transition">("boot");

  // Function to simulate loading duration
  const runProgressAnimation = (duration: number, onComplete: () => void) => {
    setTimeout(onComplete, duration);
  };

  // 1. Initial boot animation trigger
  useEffect(() => {
    const hasLoaded = sessionStorage.getItem("kyra_bms_loaded");
    
    if (hasLoaded === "true") {
      setIsVisible(false);
      prevPathnameRef.current = pathname;
      return;
    }

    setMode("boot");
    setIsVisible(true);
    prevPathnameRef.current = pathname;

    runProgressAnimation(1500, () => {
      sessionStorage.setItem("kyra_bms_loaded", "true");
      setIsVisible(false);
    });
  }, []);

  // 2. Page-to-Page Navigation transition trigger
  useEffect(() => {
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname;
      return;
    }

    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;

      if (isVisible && mode === "boot") return;

      setMode("transition");
      setIsVisible(true);

      runProgressAnimation(400, () => {
        setIsVisible(false);
      });
    }
  }, [pathname]);

  const isBoot = mode === "boot";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            transition: { duration: 0.25, ease: "easeInOut" } 
          }}
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none text-slate-800 ${
            isBoot ? "bg-white" : "bg-white/85 backdrop-blur-md"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Spinning Circle */}
            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            
            {/* Text */}
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#526B91] uppercase font-mono">
              {isBoot ? "Kyra Zam 2.0" : "Loading..."}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
