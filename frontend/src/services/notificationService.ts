import { fetchAuthSession } from "aws-amplify/auth";
import type { NotificationResponse } from "../types/notification";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

/**
 * Get authentication token from Amplify session
 */
async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error("No authentication token available");
  }
  return token;
}

/**
 * Fetch notifications for the current user
 */
export async function getNotifications(
  limit: number = 20,
  lastKey?: string,
): Promise<NotificationResponse> {
  const token = await getAuthToken();

  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(lastKey && { lastKey }),
  });

  const response = await fetch(
    `${API_ENDPOINT}/student/notifications?${params}`,
    {
      headers: {
        Authorization: token,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  return response.json();
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_ENDPOINT}/student/notifications/unread-count`,
    {
      headers: {
        Authorization: token,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }

  const data = await response.json();
  return data.count;
}

/**
 * Mark a specific notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_ENDPOINT}/student/notifications/${notificationId}/read`,
    {
      method: "PUT",
      headers: {
        Authorization: token,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_ENDPOINT}/student/notifications/read-all`,
    {
      method: "PUT",
      headers: {
        Authorization: token,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to mark all notifications as read");
  }
}
