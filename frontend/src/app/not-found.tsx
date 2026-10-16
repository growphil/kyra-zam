import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F4F9FF] text-[#0B2148] flex items-center justify-center p-4">
      <div className="surface-card max-w-md w-full p-8 rounded-2xl shadow-lg border border-[#D8E8FA] text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] mx-auto">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-mono font-bold text-[#0878F9] uppercase tracking-wider">
            HTTP 404
          </span>
          <h1 className="text-2xl font-bold text-[#0B2148]">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-[#526B91]">
            The requested route, battery serial, or document does not exist or may have been moved.
          </p>
        </div>

        <div className="pt-4 border-t border-[#D8E8FA]">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Workspace</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
