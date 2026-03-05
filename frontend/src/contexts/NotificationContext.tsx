import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";
import NotificationSnackbar from "../components/Notifications/NotificationSnackbar";
import { getNotificationTargetPath } from "../components/Notifications/notificationNavigation";
import type {
  Notification,
  WebSocketNotificationMessage,
} from "../types/notification";
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markNotificationAsUnread,
  deleteNotification as deleteNotificationService,
} from "../services/notificationService";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAsUnread: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notificationSnackbarQueue, setNotificationSnackbarQueue] = useState<
    Notification[]
  >([]);
  const [activeSnackbarNotification, setActiveSnackbarNotification] =
    useState<Notification | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!activeSnackbarNotification && notificationSnackbarQueue.length > 0) {
      const [nextNotification, ...remainingQueue] = notificationSnackbarQueue;
      setActiveSnackbarNotification(nextNotification);
      setNotificationSnackbarQueue(remainingQueue);
    }
  }, [activeSnackbarNotification, notificationSnackbarQueue]);

  // Fetch notifications from REST API
  const refreshNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [notificationResponse, count] = await Promise.all([
        getNotifications(20),
        getUnreadCount(),
      ]);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(count);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark a single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      const previousNotifications = [...notifications];
      const previousUnreadCount = unreadCount;

      // Find the notification and check if it's already read
      const notification = notifications.find(
        (n) => n.notificationId === notificationId,
      );
      if (!notification || notification.isRead) {
        return; // Already read, no need to update
      }

      // Update local state immediately
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, isRead: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        // Call API in background
        await markNotificationAsRead(notificationId);
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
        // Revert optimistic update on error
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
      }
    },
    [notifications, unreadCount],
  );

  const handleSnackbarClick = useCallback(() => {
    if (!activeSnackbarNotification) {
      return;
    }

    if (!activeSnackbarNotification.isRead) {
      markAsRead(activeSnackbarNotification.notificationId);
    }

    navigate(getNotificationTargetPath(activeSnackbarNotification));
    setActiveSnackbarNotification(null);
  }, [activeSnackbarNotification, markAsRead, navigate]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    // Update local state immediately
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      // Call API in background
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
      // Revert optimistic update on error
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  }, [notifications, unreadCount]);

  // Mark a single notification as unread
  const markAsUnread = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      const previousNotifications = [...notifications];
      const previousUnreadCount = unreadCount;

      // Find the notification and check if it's already unread
      const notification = notifications.find(
        (n) => n.notificationId === notificationId,
      );
      if (!notification || !notification.isRead) {
        return; // Already unread, no need to update
      }

      // Update local state immediately
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, isRead: false } : n,
        ),
      );
      setUnreadCount((prev) => prev + 1);

      try {
        // Call API in background
        await markNotificationAsUnread(notificationId);
      } catch (err) {
        console.error("Failed to mark notification as unread:", err);
        // Revert optimistic update on error
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
      }
    },
    [notifications, unreadCount],
  );

  // Delete a notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      const previousNotifications = [...notifications];
      const previousUnreadCount = unreadCount;

      // Find the notification to check if it was unread
      const notification = notifications.find(
        (n) => n.notificationId === notificationId,
      );
      const wasUnread = notification && !notification.isRead;

      // Update local state immediately
      setNotifications((prev) =>
        prev.filter((n) => n.notificationId !== notificationId),
      );
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      try {
        // Call API in background
        await deleteNotificationService(notificationId);
      } catch (err) {
        console.error("Failed to delete notification:", err);
        // Revert optimistic update on error
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
      }
    },
    [notifications, unreadCount],
  );

  // Handle incoming WebSocket notification
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Check if this is a notification delivery message
      if (data.action === "notification_delivery") {
        const wsMessage = data as WebSocketNotificationMessage;
        console.log(
          "[Notifications] Received real-time notification:",
          wsMessage,
        );

        // Add new notification to the beginning of the list
        setNotifications((prev) => [wsMessage.notification, ...prev]);

        // Increment unread count
        setUnreadCount((prev) => prev + 1);

        // Queue a notification-style snackbar for new deliveries
        setNotificationSnackbarQueue((prev) => [...prev, wsMessage.notification]);
      }
    } catch (err) {
      console.error("[Notifications] Error parsing WebSocket message:", err);
    }
  }, []);

  // Set up WebSocket connection - defined before scheduleReconnect to avoid circular dep
  const connectWebSocket = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token || !import.meta.env.VITE_WEBSOCKET_URL) {
        console.warn("[Notifications] Missing token or WebSocket URL");
        return;
      }

      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const wsUrl = import.meta.env.VITE_WEBSOCKET_URL;
      console.log("[Notifications] Connecting to WebSocket...");

      wsRef.current = new WebSocket(wsUrl, [token]);

      wsRef.current.onopen = () => {
        console.log("[Notifications] WebSocket connected");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = handleWebSocketMessage;

      wsRef.current.onclose = (event) => {
        console.log("[Notifications] WebSocket disconnected:", event.code);
        setIsConnected(false);

        // Attempt reconnection for abnormal closures (handled in useEffect)
      };

      wsRef.current.onerror = (wsError) => {
        console.error("[Notifications] WebSocket error:", wsError);
        setIsConnected(false);
      };
    } catch (err) {
      console.error("[Notifications] Failed to connect WebSocket:", err);
    }
  }, [handleWebSocketMessage]);

  // Initial setup and reconnection logic
  useEffect(() => {
    refreshNotifications();
    connectWebSocket();

    // Handle reconnection on disconnect
    const handleReconnect = () => {
      if (reconnectAttemptsRef.current >= 5) {
        console.log("[Notifications] Max reconnection attempts reached");
        return;
      }

      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current),
        30000,
      );
      console.log(`[Notifications] Scheduling reconnect in ${delay}ms`);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectAttemptsRef.current++;
        connectWebSocket();
      }, delay);
    };

    // Set up interval to check connection status
    const checkInterval = window.setInterval(() => {
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.CLOSED &&
        reconnectAttemptsRef.current < 5
      ) {
        handleReconnect();
      }
    }, 5000);

    return () => {
      // Cleanup
      window.clearInterval(checkInterval);
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [refreshNotifications, connectWebSocket]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error,
    isConnected,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    markAsUnread,
    deleteNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationSnackbar
        notification={activeSnackbarNotification}
        open={Boolean(activeSnackbarNotification)}
        onClose={() => setActiveSnackbarNotification(null)}
        onClick={handleSnackbarClick}
      />
    </NotificationContext.Provider>
  );
}
