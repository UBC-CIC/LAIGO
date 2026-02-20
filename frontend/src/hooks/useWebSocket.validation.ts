import type { ValidationResult } from '../types/websocket';

/**
 * Type guard to check if a value is a plain object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validates the basic structure of a WebSocket message
 * Checks for required fields: type, requestId (conditional), action (conditional)
 * 
 * @param message - The message to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateBasicStructure(message: unknown): ValidationResult {
  // Check message is an object
  if (!isObject(message)) {
    return { valid: false, error: 'Message must be a valid object' };
  }

  // Check type field exists and is a string
  if (!('type' in message) || typeof message.type !== 'string') {
    return { valid: false, error: 'Message must contain a "type" field that is a string' };
  }

  // For non-pong and non-notification messages, check requestId and action
  const type = message.type;
  const action = 'action' in message ? message.action : undefined;
  
  // Pong messages and notification_delivery messages don't require requestId
  if (type !== 'pong' && action !== 'notification_delivery') {
    // Check requestId exists and is a non-empty string
    if (!('requestId' in message) || !isNonEmptyString(message.requestId)) {
      return { valid: false, error: 'Message must contain a "requestId" field that is a non-empty string' };
    }

    // Check action field exists and is a string
    if (!('action' in message) || typeof message.action !== 'string') {
      return { valid: false, error: 'Message must contain an "action" field that is a string' };
    }
  }

  return { valid: true };
}
/**
 * Validates that the message type is one of the known values
 * 
 * @param type - The message type to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateMessageType(type: string): ValidationResult {
  const validTypes = [
    'start', 'chunk', 'complete', 'error', 'pong',
    'feedback', 'summary_complete', 'transcript_complete', 'case_submission'
  ];
  
  if (!validTypes.includes(type)) {
    return { valid: false, error: `Unknown message type: ${type}` };
  }

  return { valid: true };
}

/**
 * Validates type-specific fields for WebSocket messages
 * Each message type has different required fields
 * 
 * @param message - The WebSocket message to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateTypeSpecificFields(message: Record<string, unknown>): ValidationResult {
  const type = message.type as string;
  const action = 'action' in message ? (message.action as string) : undefined;

  // Check if this is a notification message (by action field)
  if (action === 'notification_delivery') {
    return validateNotificationMessage(message);
  }

  switch (type) {
    case 'chunk':
      // Chunk messages require a content field that is a string
      if (!('content' in message) || typeof message.content !== 'string') {
        return { valid: false, error: 'Chunk message must contain a "content" field that is a string' };
      }
      break;

    case 'complete':
      // Complete messages require a data field that is an object
      if (!('data' in message) || !isObject(message.data)) {
        return { valid: false, error: 'Complete message must contain a "data" field that is an object' };
      }
      break;

    case 'error':
      // Error messages require a content field that is a string
      if (!('content' in message) || typeof message.content !== 'string') {
        return { valid: false, error: 'Error message must contain a "content" field that is a string' };
      }
      break;

    case 'start':
    case 'pong':
      // Start and pong messages don't require additional fields beyond basic structure
      break;

    default:
      // This should never happen if validateMessageType was called first
      return { valid: false, error: `Unknown message type: ${type}` };
  }

  return { valid: true };
}

/**
 * Validates notification message structure including nested notification object
 * 
 * @param message - The WebSocket message to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateNotificationMessage(message: Record<string, unknown>): ValidationResult {
  // Verify type field exists and is a string
  if (!('type' in message) || typeof message.type !== 'string') {
    return { valid: false, error: 'Notification message must contain a "type" field that is a string' };
  }

  // Verify notification field exists and is an object
  if (!('notification' in message) || !isObject(message.notification)) {
    return { valid: false, error: 'Notification message must contain a "notification" field that is an object' };
  }

  // Verify timestamp field exists and is a string
  if (!('timestamp' in message) || typeof message.timestamp !== 'string') {
    return { valid: false, error: 'Notification message must contain a "timestamp" field that is a string' };
  }

  const notification = message.notification;

  // Verify notification.notificationId is a string
  if (!('notificationId' in notification) || typeof notification.notificationId !== 'string') {
    return { valid: false, error: 'Notification object must contain a "notificationId" field that is a string' };
  }

  // Verify notification.type is a string and one of the valid types
  const validNotificationTypes = ['feedback', 'summary_complete', 'transcript_complete', 'case_submission'];
  if (!('type' in notification) || typeof notification.type !== 'string') {
    return { valid: false, error: 'Notification object must contain a "type" field that is a string' };
  }
  if (!validNotificationTypes.includes(notification.type)) {
    return { 
      valid: false, 
      error: `Notification type must be one of: ${validNotificationTypes.join(', ')}. Got: ${notification.type}` 
    };
  }

  // Verify notification.title is a string
  if (!('title' in notification) || typeof notification.title !== 'string') {
    return { valid: false, error: 'Notification object must contain a "title" field that is a string' };
  }

  // Verify notification.message is a string
  if (!('message' in notification) || typeof notification.message !== 'string') {
    return { valid: false, error: 'Notification object must contain a "message" field that is a string' };
  }

  // Verify notification.metadata is an object
  if (!('metadata' in notification) || !isObject(notification.metadata)) {
    return { valid: false, error: 'Notification object must contain a "metadata" field that is an object' };
  }

  // Verify notification.isRead is a boolean
  if (!('isRead' in notification) || typeof notification.isRead !== 'boolean') {
    return { valid: false, error: 'Notification object must contain an "isRead" field that is a boolean' };
  }

  // Verify notification.createdAt is a string
  if (!('createdAt' in notification) || typeof notification.createdAt !== 'string') {
    return { valid: false, error: 'Notification object must contain a "createdAt" field that is a string' };
  }

  return { valid: true };
}

/**
 * Validates action-specific data for complete messages
 * Each action has specific required fields with type checks
 * 
 * @param action - The action type from the message
 * @param data - The data object to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateActionSpecificData(
  action: string,
  data: Record<string, unknown>
): ValidationResult {
  switch (action) {
    case 'assess_progress':
    case 'playground_assess':
      // Verify progress is a number
      if (!('progress' in data) || typeof data.progress !== 'number') {
        return { 
          valid: false, 
          error: `${action} complete message must contain a "progress" field that is a number` 
        };
      }
      // Verify reasoning is a string
      if (!('reasoning' in data) || typeof data.reasoning !== 'string') {
        return { 
          valid: false, 
          error: `${action} complete message must contain a "reasoning" field that is a string` 
        };
      }
      // Verify unlocked is a boolean
      if (!('unlocked' in data) || typeof data.unlocked !== 'boolean') {
        return { 
          valid: false, 
          error: `${action} complete message must contain an "unlocked" field that is a boolean` 
        };
      }
      break;

    case 'audio_to_text':
      // Verify text is a string
      if (!('text' in data) || typeof data.text !== 'string') {
        return { 
          valid: false, 
          error: 'audio_to_text complete message must contain a "text" field that is a string' 
        };
      }
      // Verify audioFileId is a string
      if (!('audioFileId' in data) || typeof data.audioFileId !== 'string') {
        return { 
          valid: false, 
          error: 'audio_to_text complete message must contain an "audioFileId" field that is a string' 
        };
      }
      // Verify jobName is a string
      if (!('jobName' in data) || typeof data.jobName !== 'string') {
        return { 
          valid: false, 
          error: 'audio_to_text complete message must contain a "jobName" field that is a string' 
        };
      }
      break;

    case 'generate_text':
    case 'playground_test':
    case 'generate_summary':
      // Verify llm_output is a string
      if (!('llm_output' in data) || typeof data.llm_output !== 'string') {
        return { 
          valid: false, 
          error: `${action} complete message must contain an "llm_output" field that is a string` 
        };
      }
      break;

    default:
      // Unknown actions are allowed for extensibility
      break;
  }

  return { valid: true };
}
