# Notification System Implementation Tasks

## Backend Infrastructure

### 1. DynamoDB Tables Setup
- [x] 1.1 Create notification DynamoDB table in CDK
  - Update `cdk/lib/api-stack.ts` to create notification DynamoDB table
  - Configure table with PK: "USER#{userId}", SK: "NOTIFICATION#{timestamp}#{notificationId}"
  - Add GSI1 with PK: "NOTIFICATION#{notificationId}", SK: "USER#{userId}"
  - Set TTL attribute for 30-day expiration and configure billing mode
  - **Validates: Requirements 4.1, 8.1, 8.2**

- [x] 1.2 Create connection tracking DynamoDB table in CDK
  - Update `cdk/lib/api-stack.ts` to create connection DynamoDB table
  - Configure table with PK: "CONNECTION#{connectionId}", SK: "USER#{userId}"
  - Add GSI1 with PK: "USER#{userId}", SK: "CONNECTION#{connectionId}"
  - Set TTL attribute for 24-hour expiration
  - **Validates: Requirements 5.1, 5.4**

### 2. WebSocket Infrastructure Modifications

- [x] 2.1 Modify WebSocket connection handler
  - Update `cdk/lambda/websocket/connect.js` to store connection-to-user mapping in database
  - Add database connection and user ID extraction from authorizer context
  - Store connection record with TTL for automatic cleanup
  - **Validates: Requirements 5.1, 5.4**

- [x] 2.2 Modify WebSocket disconnect handler
  - Update `cdk/lambda/websocket/disconnect.js` to clean up connection records
  - Remove connection record from database on disconnect
  - **Validates: Requirements 5.1**

- [x] 2.3 Extend WebSocket default handler for notifications
  - Update `cdk/lambda/websocket/default.js` to handle notification delivery messages
  - Add new action type `notification_delivery` to existing switch statement
  - Maintain backward compatibility with existing streaming actions
  - **Validates: Requirements 1.2, 2.4, 3.4**

### 3. Notification Service Lambda

- [x] 3.1 Create notification service Lambda function
  - Create `cdk/lambda/notificationService/index.js`
  - Implement notification creation, storage, and WebSocket delivery
  - Handle EventBridge events and REST API requests
  - Include error handling and retry logic for WebSocket delivery
  - **Validates: Requirements 1.1, 2.2, 3.2, 4.1, 5.1**

- [x] 3.2 Add notification service to CDK stack
  - Update `cdk/lib/api-stack.ts` to create notification service Lambda
  - Configure EventBridge integration for notification events
  - Add REST API endpoints for notification queries and updates
  - Grant necessary permissions for DynamoDB, WebSocket API, and EventBridge
  - **Validates: Requirements 4.2, 4.4, 7.3**

### 4. Event Publisher Modifications

- [x] 4.1 Modify summary generation Lambda for notifications
  - Update `cdk/lambda/summary_generation/src/main.py` to publish completion events
  - Add EventBridge client and event publishing on success/failure
  - Include case and user context in event metadata
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 4.2 Modify audio transcription Lambda for notifications
  - Update `cdk/lambda/audioToText/src/main.py` to publish completion events
  - Add EventBridge client and event publishing on success/failure
  - Include case and user context in event metadata
  - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 4.3 Modify instructor feedback handler for notifications
  - Update `cdk/lambda/handlers/instructorFunction.js` feedback endpoint
  - Add EventBridge event publishing when feedback is sent
  - Include student ID and feedback context in event metadata
  - **Validates: Requirements 1.1**

### 5. CDK Infrastructure Updates

- [x] 5.1 Add EventBridge configuration
  - Update `cdk/lib/api-stack.ts` to create EventBridge custom bus
  - Configure event rules for notification types
  - Set up Lambda targets for notification processing
  - **Validates: Requirements 1.1, 2.2, 3.2**

- [x] 5.2 Update Lambda permissions and environment variables
  - Grant EventBridge publish permissions to existing Lambdas
  - Add notification service environment variables to WebSocket handlers
  - Configure VPC and security group access for notification service
  - **Validates: Requirements 5.1, 7.3**

## Frontend Implementation

### 6. Notification Service (Frontend)

- [x] 6.1 Create notification service module
  - Create `frontend/src/services/notificationService.ts`
  - Implement API calls for fetching, marking as read, and pagination
  - Add error handling and retry logic
  - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 6.2 Create notification context provider
  - Create `frontend/src/contexts/NotificationContext.tsx`
  - Implement state management for notifications and WebSocket integration
  - Handle real-time notification updates via existing WebSocket hook
  - **Validates: Requirements 1.2, 2.4, 3.4, 5.1**

### 7. Notification UI Components

- [x] 7.1 Create notification button component
  - Create `frontend/src/components/Notifications/NotificationButton.tsx`
  - Implement unread count badge and click handling
  - Add visual indicator for unread notifications
  - **Validates: Requirements 6.3, 6.4**

- [x] 7.2 Create notification dropdown component
  - Create `frontend/src/components/Notifications/NotificationDropdown.tsx`
  - Implement notification list with pagination
  - Add mark as read functionality and reverse chronological ordering
  - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [x] 7.3 Create snackbar alert component
  - Create `frontend/src/components/Notifications/SnackbarAlert.tsx`
  - Implement temporary notification display with auto-hide
  - Add dismiss functionality and queue management for multiple alerts
  - **Validates: Requirements 1.4, 2.5, 3.5, 6.1, 6.2, 6.5**

### 8. Header Integration

- [ ] 8.1 Update StudentHeader with notification button
  - Modify `frontend/src/components/StudentHeader.tsx`
  - Replace placeholder notification icon with functional NotificationButton
  - Integrate with notification context for real-time updates
  - **Validates: Requirements 6.3, 6.4**

- [ ] 8.2 Update InstructorHeader with notification button
  - Modify `frontend/src/components/InstructorHeader.tsx`
  - Replace placeholder notification icon with functional NotificationButton
  - Integrate with notification context for real-time updates
  - **Validates: Requirements 6.3, 6.4**

- [ ] 8.3 Update AdminHeader with notification button
  - Modify `frontend/src/components/AdminHeader.tsx`
  - Replace placeholder notification icon with functional NotificationButton
  - Integrate with notification context for real-time updates
  - **Validates: Requirements 6.3, 6.4, 7.4**

### 9. WebSocket Integration

- [ ] 9.1 Extend WebSocket hook for notifications
  - Update `frontend/src/hooks/useWebSocket.ts` to handle notification messages
  - Add notification message type to existing message interface
  - Maintain backward compatibility with streaming functionality
  - **Validates: Requirements 1.2, 2.4, 3.4, 5.1**

- [ ] 9.2 Add notification context to app root
  - Update `frontend/src/App.tsx` to include NotificationProvider
  - Ensure notification context wraps all authenticated routes
  - Pass WebSocket connection to notification provider
  - **Validates: Requirements 5.1, 5.4**

## Testing Implementation

### 10. Unit Tests

- [ ] 10.1 Write notification service Lambda tests
  - Create `cdk/lambda/notificationService/notificationService.test.js`
  - Test notification creation, storage, and WebSocket delivery
  - Test error handling and retry logic
  - **Validates: Requirements 1.1, 2.2, 3.2, 5.3**

- [ ] 10.2 Write frontend notification service tests
  - Create `frontend/src/services/notificationService.test.ts`
  - Test API calls, error handling, and pagination
  - Mock API responses and test edge cases
  - **Validates: Requirements 4.2, 4.3, 4.4**

- [ ] 10.3 Write notification UI component tests
  - Create test files for NotificationButton, NotificationDropdown, and SnackbarAlert
  - Test user interactions, state updates, and visual indicators
  - Test accessibility and keyboard navigation
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### 11. Property-Based Tests

- [ ] 11.1 Write property test for notification creation and persistence
  - Create `tests/properties/notificationPersistence.test.ts`
  - Test that any notification event creates a database record with required fields
  - Use fast-check to generate various notification types and user scenarios
  - **Feature: notification-system, Property 1: For any notification event, the system should create a notification record in the database with all required fields and associate it with the correct user**

- [ ] 11.2 Write property test for real-time delivery
  - Create `tests/properties/realtimeDelivery.test.ts`
  - Test that any notification for an online user is delivered immediately via WebSocket
  - Generate various user connection states and notification types
  - **Feature: notification-system, Property 2: For any notification created for an online user, the WebSocket manager should deliver it immediately to all active sessions**

- [ ] 11.3 Write property test for offline notification handling
  - Create `tests/properties/offlineNotifications.test.ts`
  - Test that notifications for offline users are persisted and delivered on reconnection
  - Generate scenarios with users going offline and coming back online
  - **Feature: notification-system, Property 3: For any notification created for an offline user, the system should persist it and deliver all undelivered notifications when the user comes online**

- [ ] 11.4 Write property test for snackbar display behavior
  - Create `tests/properties/snackbarDisplay.test.ts`
  - Test that any WebSocket notification triggers appropriate snackbar display
  - Generate various notification types and page contexts
  - **Feature: notification-system, Property 4: For any notification received via WebSocket, the UI should display a snackbar alert with appropriate conditional display based on context**

- [ ] 11.5 Write property test for dropdown integration
  - Create `tests/properties/dropdownIntegration.test.ts`
  - Test that any notification appears in dropdown and read status updates correctly
  - Generate various notification sequences and user interactions
  - **Feature: notification-system, Property 5: For any notification created, it should appear in the user's notification dropdown in reverse chronological order and be marked as read when viewed**

- [ ] 11.6 Write property test for access control
  - Create `tests/properties/accessControl.test.ts`
  - Test that notifications are only delivered to intended recipients
  - Generate various user roles and notification scenarios
  - **Feature: notification-system, Property 10: For any notification query or creation, the system should enforce that users only receive notifications intended for them**

### 12. Integration Tests

- [ ] 12.1 Write end-to-end notification flow tests
  - Create `tests/integration/notificationFlow.test.ts`
  - Test complete flow from event trigger to UI display
  - Test feedback, summary completion, and transcription completion scenarios
  - **Validates: Requirements 1.1-1.5, 2.1-2.5, 3.1-3.5**

- [ ] 12.2 Write WebSocket connection and delivery tests
  - Create `tests/integration/websocketDelivery.test.ts`
  - Test WebSocket connection management and message delivery
  - Test reconnection scenarios and error handling
  - **Validates: Requirements 5.1-5.5**

## Documentation and Deployment

### 13. Documentation

- [ ] 13.1 Create API documentation
  - Document notification REST API endpoints
  - Document WebSocket message formats for notifications
  - Include authentication and authorization requirements
  - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 13.2 Create deployment guide
  - Document CDK deployment steps for notification system
  - Include environment variable configuration
  - Document database migration process
  - **Validates: Requirements 8.1, 8.2**

### 14. Performance Optimization

- [ ] 14.1 Implement notification data lifecycle management
  - Add automated archiving for notifications older than 30 days
  - Implement soft delete functionality for audit trails
  - Add database indexes for optimal query performance
  - **Validates: Requirements 8.2, 8.4, 8.5**

- [ ] 14.2 Implement UI pagination and performance optimizations
  - Add pagination for users with more than 100 notifications
  - Implement virtual scrolling for large notification lists
  - Add loading states and error boundaries
  - **Validates: Requirements 8.3**