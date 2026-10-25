import { useEffect, useRef, useState, useCallback } from "react";

export type RealTimeEvent = {
  event_type: string;
  payload: Record<string, any>;
  timestamp: string;
};

interface UseRealTimeSyncOptions {
  onEvent?: (event: RealTimeEvent) => void;
  onRefresh?: () => void;
  enabled?: boolean;
  pollingIntervalMs?: number;
}

export function useRealTimeSync(options: UseRealTimeSyncOptions = {}) {
  const {
    onEvent,
    onRefresh,
    enabled = true,
    pollingIntervalMs = 15000,
  } = options;

  const [status, setStatus] = useState<"connected" | "connecting" | "polling" | "disconnected">("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      return;
    }

    let isSubscribed = true;

    // Connect to Server-Sent Events stream
    try {
      const sseUrl = "/api/events/stream";
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isSubscribed) {
          setStatus("connected");
          // Clear any active polling timer when SSE is healthy
          if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      };

      const handleIncomingMessage = (type: string, dataStr: string) => {
        if (!isSubscribed) return;
        try {
          const parsed = JSON.parse(dataStr);
          const evt: RealTimeEvent = {
            event_type: type,
            payload: parsed.payload || parsed,
            timestamp: parsed.timestamp || new Date().toISOString(),
          };
          setLastEventAt(evt.timestamp);

          if (onEvent) {
            onEvent(evt);
          }
          // Automatically trigger data refresh when ledger changes
          handleRefresh();
        } catch {
          // ignore malformed frame
        }
      };

      // Listen for all business lifecycle events
      es.addEventListener("connected", (e) => handleIncomingMessage("connected", e.data));
      es.addEventListener("bill_created", (e) => handleIncomingMessage("bill_created", e.data));
      es.addEventListener("repayment_recorded", (e) => handleIncomingMessage("repayment_recorded", e.data));
      es.addEventListener("payment_verified", (e) => handleIncomingMessage("payment_verified", e.data));
      es.addEventListener("statement_imported", (e) => handleIncomingMessage("statement_imported", e.data));

      es.onerror = () => {
        if (isSubscribed) {
          // Fall back gracefully to polling when SSE disconnects
          setStatus("polling");
          if (!pollTimerRef.current) {
            pollTimerRef.current = window.setInterval(() => {
              handleRefresh();
            }, pollingIntervalMs);
          }
        }
      };
    } catch {
      // Direct fallback to polling if EventSource is unsupported
      setStatus("polling");
      pollTimerRef.current = window.setInterval(() => {
        handleRefresh();
      }, pollingIntervalMs);
    }

    return () => {
      isSubscribed = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, pollingIntervalMs, handleRefresh, onEvent]);

  return {
    status,
    lastEventAt,
    isRealTime: status === "connected",
  };
}
