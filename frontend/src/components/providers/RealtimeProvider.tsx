"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getWsBaseUrl } from "@/lib/api";

export type WebSocketStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

interface RealtimeContextType {
  isConnected: boolean;
  status: WebSocketStatus;
  lastEvent: { event: string; data: any; timestamp: string } | null;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  status: "disconnected",
  lastEvent: null,
  reconnect: () => {}
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WebSocketStatus>("connecting");
  const [lastEvent, setLastEvent] = useState<{ event: string; data: any; timestamp: string } | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    // Clean up any existing connection
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      socketRef.current.onopen = null;
      socketRef.current.close();
      socketRef.current = null;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const wsBase = getWsBaseUrl();
    const wsUrl = `${wsBase}/ws`;

    setStatus(prev => (prev === "disconnected" ? "reconnecting" : "connecting"));

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("⚡ [WebSocket] Connected to KYRA ZAM Realtime Server");
        if (token) {
          ws.send(JSON.stringify({ type: "auth", token }));
        }
        setStatus("connected");
        backoffRef.current = 1000;

        // Start Heartbeat Ping every 25 seconds
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          }
        }, 25000);
      };

      ws.onmessage = (messageEvent) => {
        try {
          const parsed = JSON.parse(messageEvent.data);
          const { event, data, timestamp } = parsed;

          if (event === "pong") return; // Heartbeat response

          const eventTimestamp = timestamp || new Date().toISOString();
          setLastEvent({ event, data, timestamp: eventTimestamp });
          console.log(`⚡ [WS Live Update] Event: ${event}`, data);

          // ========================================================
          // COMPREHENSIVE LIVE INVALIDATION MATRIX FOR ENTIRE PROJECT
          // ========================================================

          // 1. BOM & Kit Recipes
          if (event === "bom:update" || event.startsWith("bom_")) {
            queryClient.invalidateQueries({ queryKey: ["admin-boms"] });
            queryClient.invalidateQueries({ queryKey: ["boms"] });
            queryClient.invalidateQueries({ queryKey: ["boms-list"] });
            queryClient.invalidateQueries({ queryKey: ["boms-dropdown"] });
            queryClient.invalidateQueries({ queryKey: ["materials-for-bom"] });
            queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
          }

          // 2. Admin & Factory Settings
          if (event === "admin:factory:update" || event.startsWith("pax_type_") || event.startsWith("pax_production_")) {
            queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-cells"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-categories"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-financial"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-defaults"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
          }

          // 3. Inventory & Raw Materials
          if (event === "inventory:update" || event === "materials:update" || event === "inventory_consumed") {
            queryClient.invalidateQueries({ queryKey: ["materials"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
            queryClient.invalidateQueries({ queryKey: ["materials-for-bom"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
            queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-materials"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
          }

          // 4. Testing & Cell QC
          if (
            event === "testing:update" || 
            event === "cell:status_change" || 
            event === "cell_qc_alert" || 
            event === "batch_alert" ||
            event === "production_cell_requirement_completed"
          ) {
            queryClient.invalidateQueries({ queryKey: ["cells-list"] });
            queryClient.invalidateQueries({ queryKey: ["hold-cells-list"] });
            queryClient.invalidateQueries({ queryKey: ["hold-cell-detail"] });
            queryClient.invalidateQueries({ queryKey: ["qc-retest-list"] });
            queryClient.invalidateQueries({ queryKey: ["batch-analytics"] });
            queryClient.invalidateQueries({ queryKey: ["cell-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["grading-summary"] });
            queryClient.invalidateQueries({ queryKey: ["cluster-batches"] });
            queryClient.invalidateQueries({ queryKey: ["testing-overview"] });
            queryClient.invalidateQueries({ queryKey: ["admin-factory-cells"] });

            if (event === "cell_qc_alert" && data) {
              toast.warning(`[QC Hold Alert] Cell ${data.cellSerial} placed on HOLD (AH: ${data.ahValue}, IR: ${data.irValue})`, {
                description: `Retest Attempts: ${data.retestCount}`,
                duration: 7000
              });
            }
            if (event === "batch_alert" && data?.message) {
              toast.error(`[Batch Quality Alert] ${data.message}`, { duration: 9000 });
            }
          }

          // 5. Production, Plans & Work Orders
          if (
            event === "production:update" || 
            event === "workorder:update" || 
            event === "plan:update"
          ) {
            queryClient.invalidateQueries({ queryKey: ["work-orders"] });
            queryClient.invalidateQueries({ queryKey: ["work-order-detail"] });
            queryClient.invalidateQueries({ queryKey: ["production-overview"] });
            queryClient.invalidateQueries({ queryKey: ["production-plans"] });
            queryClient.invalidateQueries({ queryKey: ["scheduler-work-orders"] });
            queryClient.invalidateQueries({ queryKey: ["production-requirements"] });
            queryClient.invalidateQueries({ queryKey: ["station-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["assembly-tasks"] });
          }

          // 6. PAX Battery Packs
          if (
            event === "pax:status_change" || 
            event === "pax:created" || 
            event === "pax:disassembled" || 
            event === "pax:deleted"
          ) {
            queryClient.invalidateQueries({ queryKey: ["pax-list"] });
            queryClient.invalidateQueries({ queryKey: ["pax-detail"] });
            queryClient.invalidateQueries({ queryKey: ["pax-supervisor-list"] });
            queryClient.invalidateQueries({ queryKey: ["pax-types"] });
            queryClient.invalidateQueries({ queryKey: ["ready-pax-list"] });
            queryClient.invalidateQueries({ queryKey: ["pax-analytics"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-list"] });

            if (event === "pax:status_change" && data?.paxSerial && data?.status) {
              toast.info(`[PAX Update] Pack ${data.paxSerial} is now ${data.status.replace(/_/g, " ")}`);
            }
          }

          // 7. CRM & Customers
          if (event === "crm:update" || event === "customer:update" || event === "lead:update") {
            queryClient.invalidateQueries({ queryKey: ["customers-list"] });
            queryClient.invalidateQueries({ queryKey: ["customer-detail"] });
            queryClient.invalidateQueries({ queryKey: ["leads-list"] });
            queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
            queryClient.invalidateQueries({ queryKey: ["crm-search"] });
          }

          // 8. Sales, Quotations & Orders
          if (event === "sales:update" || event === "quotation:update" || event === "order:update") {
            queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
            queryClient.invalidateQueries({ queryKey: ["quotation-detail"] });
            queryClient.invalidateQueries({ queryKey: ["sales-orders-list"] });
            queryClient.invalidateQueries({ queryKey: ["sales-order-detail"] });
            queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
          }

          // 9. Finance & Accounts
          if (event === "finance:update" || event === "invoice:update" || event === "payment:update") {
            queryClient.invalidateQueries({ queryKey: ["invoices-list"] });
            queryClient.invalidateQueries({ queryKey: ["invoice-detail"] });
            queryClient.invalidateQueries({ queryKey: ["payments-list"] });
            queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
            queryClient.invalidateQueries({ queryKey: ["ledger-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
          }

          // 10. Procurement
          if (event === "procurement:update" || event === "purchase_request:update" || event === "po:update") {
            queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
            queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            queryClient.invalidateQueries({ queryKey: ["vendor-list"] });
            queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
          }

          // 11. Service, Repair & RMA
          if (event === "service:update" || event === "repair:update" || event === "warranty:update") {
            queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
            queryClient.invalidateQueries({ queryKey: ["repair-list"] });
            queryClient.invalidateQueries({ queryKey: ["service-battery-list"] });
            queryClient.invalidateQueries({ queryKey: ["service-battery-detail"] });
            queryClient.invalidateQueries({ queryKey: ["service-timeline"] });
            queryClient.invalidateQueries({ queryKey: ["warranty-claims"] });
          }

          // 12. Scrap & Disassembly
          if (event === "scrap:update") {
            queryClient.invalidateQueries({ queryKey: ["scrap-list"] });
            queryClient.invalidateQueries({ queryKey: ["scrap-stats"] });
            queryClient.invalidateQueries({ queryKey: ["disassembly-logs"] });
          }

          // 13. Dispatch
          if (event === "dispatch:update") {
            queryClient.invalidateQueries({ queryKey: ["dispatch-orders"] });
            queryClient.invalidateQueries({ queryKey: ["shipments-list"] });
            queryClient.invalidateQueries({ queryKey: ["dispatch-stats"] });
          }

          // 14. Global System Reset / Clear
          if (event === "system:reset") {
            queryClient.invalidateQueries();
            toast.info("System data refreshed in real-time.");
          }

          // 15. General Notification
          if (event === "notification" && data?.message) {
            toast.info(`[Notification] ${data.message}`, { duration: 6000 });
          }

        } catch (err) {
          console.error("Error processing WebSocket event:", err);
        }
      };

      ws.onclose = (closeEvent) => {
        setStatus("disconnected");
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        // Exponential backoff reconnect
        const timeout = Math.min(backoffRef.current, 10000);
        backoffRef.current = Math.min(backoffRef.current * 1.5, 10000);
        console.log(`⚡ [WebSocket] Disconnected (${closeEvent.code}). Reconnecting in ${timeout}ms...`);
        reconnectTimeoutRef.current = setTimeout(connect, timeout);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setStatus("disconnected");
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [queryClient]);

  useEffect(() => {
    connect();

    // Reconnect on tab visibility or network online
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };

    const handleOnline = () => {
      connect();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [connect]);

  return (
    <RealtimeContext.Provider 
      value={{
        isConnected: status === "connected",
        status,
        lastEvent,
        reconnect: connect
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
