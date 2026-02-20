import { useEffect, useRef, useCallback, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  validateBasicStructure,
  validateMessageType,
  validateTypeSpecificFields,
  validateActionSpecificData,
} from "./useWebSocket.validation";
import type { WebSocketMessage } from "../types/websocket";

interface PendingRequest {
  action: string;
  onStart?: () => void;
  onChunk?: (content: string) => void;
  onComplete?: (data: Record<string, unknown>) => void;
  onError?: (message: string) => void;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  protocols?: string | string[];
}

export const useWebSocket = (
  url: string | null,
  options: UseWebSocketOptions = {},
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  // Request tracking for streaming responses - must be after useState to maintain hook order
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());

  // Generate unique request ID
  const generateRequestId = () =>
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
          console.log("[WebSocket] Sent ping");
        } catch (error) {
          console.error("[WebSocket] Error sending ping:", error);
        }
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Ref to store connect function to avoid circular dependencies
  const connectRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    if (isManualDisconnectRef.current) {
      console.log("[WebSocket] Manual disconnect, not reconnecting");
      return;
    }

    if (reconnectAttemptsRef.current >= 10) {
      console.log("[WebSocket] Max reconnection attempts reached");
      setConnectionState("error");
      return;
    }

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttemptsRef.current),
      30000,
    );
    console.log(
      `[WebSocket] Scheduling reconnect attempt ${
        reconnectAttemptsRef.current + 1
      }/10 in ${delay}ms`,
    );

    reconnectTimeoutRef.current = window.setTimeout(async () => {
      reconnectAttemptsRef.current++;
      
      // Refresh token before reconnecting 
      if (callbacksRef.current.protocols) {
        try {
          console.log("[WebSocket] Refreshing auth token before reconnect");
          const session = await fetchAuthSession();
          const freshToken = session.tokens?.idToken?.toString();
          
          if (freshToken) {
            // Update protocols with fresh token
            callbacksRef.current.protocols = Array.isArray(callbacksRef.current.protocols)
              ? [freshToken, ...callbacksRef.current.protocols.slice(1)]
              : [freshToken];
            console.log("[WebSocket] Token refreshed successfully");
          } else {
            console.error("[WebSocket] No token available - cannot reconnect");
            setConnectionState("error");
            return; // Abort reconnection - user needs to re-authenticate
          }
        } catch (error) {
          console.error("[WebSocket] Failed to refresh token:", error);
          setConnectionState("error");
          return; // Abort reconnection - auth is broken
        }
      }
      
      if (connectRef.current) {
        connectRef.current();
      }
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (
      !url ||
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    console.log(
      `[WebSocket] Connecting to: ${url} (attempt ${
        reconnectAttemptsRef.current + 1
      })`,
    );
    setConnectionState("connecting");

    try {
      // Use protocols from the current options ref if available
      const protocols = callbacksRef.current.protocols;
      wsRef.current = protocols
        ? new WebSocket(url, protocols)
        : new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log("[WebSocket] Connected successfully");
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
        callbacksRef.current.onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log("[WebSocket] Received message:", message);

          // Validation pipeline - Step 1: Basic structure validation
          const basicValidation = validateBasicStructure(message);
          if (!basicValidation.valid) {
            console.error(
              "[WebSocket] Basic structure validation failed:",
              basicValidation.error
            );
            // Try to extract requestId to provide error feedback
            const requestId = 'requestId' in message ? (message as Record<string, unknown>).requestId : undefined;
            
            if (requestId && typeof requestId === 'string') {
              const pending = pendingRequestsRef.current.get(requestId);
              if (pending) {
                pending.onError?.("An error occurred");
                pendingRequestsRef.current.delete(requestId);
              }
            }
            return;
          }

          // Validation pipeline - Step 2: Message type validation
          const typeValidation = validateMessageType(message.type || "");
          if (!typeValidation.valid) {
            console.error(
              "[WebSocket] Message type validation failed:",
              typeValidation.error
            );
            // Try to provide error feedback if requestId exists
            const { requestId } = message;
            if (requestId) {
              const pending = pendingRequestsRef.current.get(requestId);
              if (pending) {
                pending.onError?.("An error occurred");
                pendingRequestsRef.current.delete(requestId);
              }
            }
            return;
          }

          // Validation pipeline - Step 3: Type-specific field validation
          const fieldValidation = validateTypeSpecificFields(message as unknown as Record<string, unknown>);
          if (!fieldValidation.valid) {
            console.error(
              "[WebSocket] Type-specific field validation failed:",
              fieldValidation.error
            );
            // Call onError callback if requestId exists with pending request
            const { requestId } = message;
            if (requestId) {
              const pending = pendingRequestsRef.current.get(requestId);
              if (pending) {
                pending.onError?.("An error occurred");
                pendingRequestsRef.current.delete(requestId);
              }
            }
            return;
          }

          if (message.type === "pong") {
            console.log("[WebSocket] Received pong");
            return;
          }

          // Route by requestId if present
          const { requestId, type, content, data, action } = message;
          if (requestId) {
            const pending = pendingRequestsRef.current.get(requestId);
            if (pending) {
              switch (type) {
                case "start":
                  pending.onStart?.();
                  break;
                case "chunk":
                  pending.onChunk?.(content || "");
                  break;
                case "complete":
                  // Validation pipeline - Step 4: Action-specific data validation
                  if (action && data) {
                    const dataValidation = validateActionSpecificData(
                      action,
                      data as Record<string, unknown>
                    );
                    if (!dataValidation.valid) {
                      console.error(
                        "[WebSocket] Action-specific data validation failed:",
                        dataValidation.error
                      );
                      pending.onError?.("An error occurred");
                      pendingRequestsRef.current.delete(requestId);
                      return;
                    }
                  }
                  pending.onComplete?.(data || {});
                  pendingRequestsRef.current.delete(requestId);
                  break;
                case "error":
                  pending.onError?.(content || "Unknown error");
                  pendingRequestsRef.current.delete(requestId);
                  break;
              }
              return;
            }
          }

          // Fallback to legacy callback for messages without requestId
          callbacksRef.current.onMessage?.(message);
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log(
          `[WebSocket] Disconnected - Code: ${event.code}, Reason: ${event.reason}`,
        );

        wsRef.current = null;
        setConnectionState("disconnected");
        stopHeartbeat();
        callbacksRef.current.onDisconnect?.();

        if (!isManualDisconnectRef.current) {
          if (event.code !== 1000 && event.code !== 1001) {
            console.log(
              "[WebSocket] Abnormal closure, attempting to reconnect...",
            );
            scheduleReconnect();
          } else {
            console.log("[WebSocket] Normal closure, not reconnecting");
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("[WebSocket] Connection error:", error);
        setConnectionState("error");
        callbacksRef.current.onError?.(error);
      };
    } catch (error) {
      console.error("[WebSocket] Error creating WebSocket:", error);
      setConnectionState("error");
      scheduleReconnect();
    }
  }, [url, startHeartbeat, stopHeartbeat, scheduleReconnect]);

  // Update connectRef whenever connect changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    console.log("[WebSocket] Manual disconnect requested");
    isManualDisconnectRef.current = true;

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setConnectionState("disconnected");
    reconnectAttemptsRef.current = 0;
  }, [stopHeartbeat]);

  const sendMessage = useCallback(
    (message: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          const messageStr = JSON.stringify(message);
          console.log("[WebSocket] Sending message:", message);
          wsRef.current.send(messageStr);
          return true;
        } catch (error) {
          console.error("[WebSocket] Error sending message:", error);
          return false;
        }
      }

      console.warn(
        `[WebSocket] Cannot send message - Connection state: ${connectionState}`,
      );
      return false;
    },
    [connectionState],
  );

  const forceReconnect = useCallback(() => {
    console.log("[WebSocket] Force reconnect requested");
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;

    disconnect();

    setTimeout(() => {
      isManualDisconnectRef.current = false;
      connect();
    }, 1000);
  }, [disconnect, connect]);

  // Only depend on URL and protocols changes
  // We serialize protocols array to string for dependency checking if it's an array
  const protocolsDeps = Array.isArray(options.protocols)
    ? options.protocols.join(",")
    : options.protocols;

  useEffect(() => {
    let connectTimer: number | undefined;

    if (url) {
      isManualDisconnectRef.current = false;
      // Avoid calling setState synchronously in effect
      connectTimer = window.setTimeout(() => {
        connect();
      }, 0);
    }

    return () => {
      if (connectTimer) window.clearTimeout(connectTimer);
      isManualDisconnectRef.current = true;
      disconnect();
    };
  }, [url, protocolsDeps, connect, disconnect]); // Depend on protocols so token refresh triggers reconnect

  const sendStreamingRequest = useCallback(
    (
      action: string,
      payload: Record<string, unknown>,
      callbacks: Omit<PendingRequest, "action">,
    ): string | null => {
      const requestId = generateRequestId();
      pendingRequestsRef.current.set(requestId, { action, ...callbacks });

      const success = sendMessage({ action, requestId, ...payload });
      if (!success) {
        pendingRequestsRef.current.delete(requestId);
        return null;
      }
      return requestId;
    },
    [sendMessage],
  );

  const isConnected = connectionState === "connected";

  return {
    sendMessage,
    sendStreamingRequest,
    connect,
    disconnect,
    forceReconnect,
    isConnected,
    connectionState,
  };
};
