export interface Notification {
  notificationId: string;
  userId: string;
  type:
    | "feedback"
    | "summary_complete"
    | "transcript_complete"
    | "case_submission";
  title: string;
  message: string;
  metadata: {
    caseId?: string;
    caseName?: string;
    feedbackId?: string;
    summaryId?: string;
    transcriptionId?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  hasMore: boolean;
  nextKey?: string;
}

export interface WebSocketNotificationMessage {
  action: "notification_delivery";
  type: string;
  notification: Notification;
  timestamp: string;
}
