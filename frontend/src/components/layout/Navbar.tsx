"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, Search, User, LogOut, X, Loader2, Menu, PanelLeftClose, PanelRightClose } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useLayoutStore } from "@/store/layoutStore";
import { useRealtime } from "@/components/providers/RealtimeProvider";

export default function Navbar() {
  const { status: wsStatus, reconnect } = useRealtime();
  const { data: session } = useSession();
  const router = useRouter();
  const { toggleMobileSidebar, sidebarPosition, toggleSidebarPosition } = useLayoutStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userName = session?.user?.name || "User";
  const userRoles = (session?.user as any)?.roles || [];
  const rolesDisplay = userRoles.map((r: string) => r.replace('_', ' ')).join(', ') || "No Role";
  const primaryRole = userRoles[0] || "SUPERADMIN";
  const roleSlug = primaryRole.toLowerCase().replace(/_/g, "-");

  // Search State
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Autofocus search input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setResults(null);
      setError("");
    }
  }, [isOpen]);

  // Debounced search logic
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults(null);
      setError("");
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/crm/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Search request failed");
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const hasResults = results && Object.values(results).some((arr: any) => arr && arr.length > 0);

  return (
    <header className="h-16 border-b border-[#D8E8FA] flex items-center justify-between px-4 sm:px-8 bg-white/95 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={toggleMobileSidebar}
          className="p-2 -ml-2 rounded-lg hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] md:hidden transition-colors"
          aria-label="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1.5 pl-3.5 pr-2.5 text-[#526B91] text-xs sm:text-sm hover:border-[#0878F9]/50 hover:bg-white transition-all duration-150"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
            <span className="truncate">Search serials, orders, or documents...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white text-[10px] text-[#64748B] font-mono border border-[#D8E8FA] shrink-0 ml-2">
            Ctrl + K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* System Realtime WebSocket Status */}
        {wsStatus === "connected" ? (
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold tracking-tight"
            title="Real-time WebSocket Live Sync Active"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="hidden sm:inline">Live Sync</span>
          </div>
        ) : wsStatus === "connecting" || wsStatus === "reconnecting" ? (
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold tracking-tight"
            title="Connecting to Real-time WebSocket Server..."
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
            <span className="hidden sm:inline">Syncing...</span>
          </div>
        ) : (
          <button 
            onClick={reconnect}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 text-[11px] font-semibold tracking-tight group cursor-pointer transition-colors"
            title="WebSocket Disconnected. Click to Reconnect Now"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            <span className="group-hover:underline">Offline • Retry</span>
          </button>
        )}

        {/* Quick Sidebar Dock Alignment Toggle */}
        <button
          type="button"
          onClick={toggleSidebarPosition}
          className="hidden md:flex items-center gap-1.5 p-2 rounded-lg hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0878F9] transition-colors cursor-pointer"
          title={`Dock Sidebar to ${sidebarPosition === "left" ? "Right" : "Left"} of screen`}
          aria-label="Toggle Sidebar Side Alignment"
        >
          {sidebarPosition === "left" ? (
            <PanelRightClose className="w-4 h-4 text-[#526B91] hover:text-[#0878F9]" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-[#526B91] hover:text-[#0878F9]" />
          )}
        </button>

        <button className="relative p-2 rounded-lg hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2.5 pl-3 border-l border-[#D8E8FA]">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-[#0B2148] truncate max-w-[140px]">
              {mounted ? userName : "User"}
            </p>
            <p className="text-[10px] text-[#64748B] font-bold uppercase truncate max-w-[140px]">
              {mounted ? rolesDisplay : "No Role"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] font-bold text-xs">
            {(mounted ? userName : "User").charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            signOut({ callbackUrl: "/login" });
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors border border-rose-200 text-xs font-semibold cursor-pointer"
          title="Logout"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Logout</span>
        </button>
      </div>

      {/* Global Search Dialog Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/50 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4">
          <div className="bg-white border border-[#D8E8FA] w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150 text-[#0B2148]">
            
            {/* Input Bar */}
            <div className="relative p-4 sm:p-5 border-b border-[#D8E8FA] flex items-center gap-3 bg-[#F4F9FF]">
              <Search className="w-5 h-5 text-[#64748B] shrink-0" />
              <input 
                ref={inputRef}
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type serial number, sales order code, or invoice ID..." 
                className="w-full bg-transparent border-0 text-[#0B2148] text-base placeholder-[#64748B] focus:outline-none focus:ring-0"
              />
              {loading && <Loader2 className="w-5 h-5 text-[#0878F9] animate-spin shrink-0" />}
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white text-[#64748B] hover:text-[#0B2148] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[60vh]">
              {query.trim().length < 3 ? (
                <div className="text-center py-10 space-y-1">
                  <p className="text-[#526B91] text-sm">Please type at least 3 characters to search.</p>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Searchable across all cells, battery packs, sales orders, and invoices</p>
                </div>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-7 h-7 text-[#0878F9] animate-spin" />
                  <p className="text-xs text-[#526B91]">Searching enterprise database...</p>
                </div>
              ) : error ? (
                <div className="text-center py-10 text-rose-700 text-sm font-medium">{error}</div>
              ) : !hasResults ? (
                <div className="text-center py-10 space-y-1">
                  <p className="text-[#0B2148] text-sm font-semibold">No records found matching "{query}"</p>
                  <p className="text-xs text-[#64748B]">Try searching with standard prefixes (e.g. CELL-123, SO-1234, WO-1234).</p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Cells Results */}
                  {results.cells && results.cells.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] border-b border-[#D8E8FA] pb-1">Cells</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.cells.map((item: any) => (
                          <div 
                            key={item.serialNumber} 
                            onClick={() => handleNavigate(`/${roleSlug}/cells`)}
                            className="p-3 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg cursor-pointer transition-colors flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs font-mono font-semibold text-[#0B2148]">{item.serialNumber}</p>
                              <p className="text-[10px] text-[#64748B] uppercase font-semibold mt-0.5">Category: {item.category}</p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 uppercase">{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PaxPacks Results */}
                  {results.packs && results.packs.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 border-b border-[#D8E8FA] pb-1">PaxPacks</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.packs.map((item: any) => (
                          <div 
                            key={item.paxSerial} 
                            onClick={() => handleNavigate(`/${roleSlug}/pax/all`)}
                            className="p-3 bg-[#F4F9FF] hover:bg-purple-50/60 border border-[#D8E8FA] rounded-lg cursor-pointer transition-colors flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs font-mono font-semibold text-[#0B2148]">{item.paxSerial}</p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 uppercase">{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SalesOrders Results */}
                  {results.salesOrders && results.salesOrders.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 border-b border-[#D8E8FA] pb-1">Sales Orders</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.salesOrders.map((item: any) => (
                          <div 
                            key={item.id} 
                            onClick={() => handleNavigate(`/${roleSlug}/sales/orders/${item.id}`)}
                            className="p-3 bg-[#F4F9FF] hover:bg-emerald-50/60 border border-[#D8E8FA] rounded-lg cursor-pointer transition-colors flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs font-mono font-semibold text-[#0B2148]">{item.salesOrderNumber}</p>
                              <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">₹{parseFloat(item.grandTotal).toLocaleString()}</p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 uppercase">{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* WorkOrders Results */}
                  {results.workOrders && results.workOrders.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 border-b border-[#D8E8FA] pb-1">Work Orders</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.workOrders.map((item: any) => (
                          <div 
                            key={item.id} 
                            onClick={() => handleNavigate(`/${roleSlug}/production/work-orders/${item.id}`)}
                            className="p-3 bg-[#F4F9FF] hover:bg-amber-50/60 border border-[#D8E8FA] rounded-lg cursor-pointer transition-colors flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs font-mono font-semibold text-[#0B2148]">{item.workOrderNumber}</p>
                              <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">Qty: {item.plannedQuantity}</p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 uppercase">{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ServiceBatteries Results */}
                  {results.serviceBatteries && results.serviceBatteries.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sky-700 border-b border-[#D8E8FA] pb-1">Service Intakes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.serviceBatteries.map((item: any) => (
                          <div 
                            key={item.id} 
                            onClick={() => handleNavigate(`/${roleSlug}/service`)}
                            className="p-3 bg-[#F4F9FF] hover:bg-sky-50/60 border border-[#D8E8FA] rounded-lg cursor-pointer transition-colors flex justify-between items-center"
                          >
                            <div>
                              <p className="text-xs font-mono font-semibold text-[#0B2148]">{item.serviceId}</p>
                              <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">Serial: {item.serialNumber}</p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 uppercase">{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
            
            {/* Footer hints */}
            <div className="p-3 bg-[#F4F9FF] border-t border-[#D8E8FA] text-right flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="font-semibold text-[#0B2148]">KYRA ZAM 2.0 GLOBAL LOOKUP</span>
              <div className="flex items-center gap-3">
                <span><kbd className="px-1.5 py-0.5 rounded bg-white text-[#0B2148] font-mono border border-[#D8E8FA]">Esc</kbd> Close</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-white text-[#0B2148] font-mono border border-[#D8E8FA]">Enter</kbd> Open Item</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
