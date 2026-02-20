// Import existing Notification type 
import type { Notification } from './notification';

/**
 * WebSocket message interface covering all message types
 * Used for incoming messages from the WebSocket connection
 */
export interface WebSocketMessage {
  // Type field for streaming messages
  type?: "start" | "chunk" | "complete" | "error" | "pong" | "feedback" | "summary_complete" | "transcript_complete" | "case_submission";
  
  // Optional fields - presence depends on message type
  requestId?: string;
  action?: string;
  content?: string;
  data?: Record<string, unknown>;
  message?: string;
  sources?: string[];
  
  // Notification-specific fields (reuses existing Notification type)
  notification?: Notification;
  timestamp?: string;
}

/**
 * Validation result returned by validation functions
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}
