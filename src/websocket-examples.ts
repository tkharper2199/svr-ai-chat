/**
 * Example: Using WebSocket Manager Programmatically
 * 
 * This example shows how to use the WebSocket manager to broadcast
 * messages or send messages to specific users from your application code.
 */

import { wsManager } from './app';

/**
 * Example 1: Broadcasting a message to all connected clients
 */
export function broadcastAnnouncement(message: string): void {
  if (wsManager) {
    wsManager.broadcast({
      type: 'announcement',
      message,
      timestamp: new Date().toISOString()
    });
    console.log(`📢 Broadcasted: ${message}`);
  } else {
    console.log('⚠️  WebSocket manager not initialized');
  }
}

/**
 * Example 2: Send a notification to a specific user
 */
export function notifyUser(userId: string, notification: any): void {
  if (wsManager) {
    wsManager.sendToUser(userId, {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString()
    });
    console.log(`📨 Sent notification to user: ${userId}`);
  } else {
    console.log('⚠️  WebSocket manager not initialized');
  }
}

/**
 * Example 3: Get the count of active WebSocket connections
 */
export function getActiveConnections(): number {
  if (wsManager) {
    return wsManager.getClientCount();
  }
  return 0;
}

/**
 * Example 4: Send a system message to all users
 */
export function sendSystemMessage(message: string, severity: 'info' | 'warning' | 'error'): void {
  if (wsManager) {
    wsManager.broadcast({
      type: 'system_message',
      message,
      severity,
      timestamp: new Date().toISOString()
    });
  }
}

// Usage examples:
// broadcastAnnouncement('Server maintenance scheduled for 2 AM');
// notifyUser('user123', { title: 'New Message', body: 'You have a new message' });
// const count = getActiveConnections();
// sendSystemMessage('Server will restart in 5 minutes', 'warning');
