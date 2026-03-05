import type { Notification } from "../../types/notification";

export const getNotificationTargetPath = (
  notification: Notification,
): string => {
  const caseId = notification.metadata?.caseId;

  if (!caseId) {
    return "/";
  }

  switch (notification.type) {
    case "feedback":
      return `/case/${caseId}/feedback`;
    case "summary_complete":
      return `/case/${caseId}/summaries`;
    case "transcript_complete":
      return `/case/${caseId}/transcriptions`;
    case "case_submission":
    default:
      return `/case/${caseId}/overview`;
  }
};
