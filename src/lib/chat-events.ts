/**
 * Global chat event bus for synchronizing updates across components
 * When notifications detect new messages, they broadcast an event
 * that triggers immediate refresh in conversation list and chat area
 */

type ChatEventType = 'new_message' | 'conversation_update' | 'message_read';

interface ChatEventData {
  conversationId?: string;
  messageId?: string;
}

type ChatEventCallback = (data: ChatEventData) => void;

class ChatEventBus {
  private listeners: Map<ChatEventType, Set<ChatEventCallback>> = new Map();

  subscribe(event: ChatEventType, callback: ChatEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: ChatEventType, data: ChatEventData = {}): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('[ChatEventBus] Error in callback:', error);
      }
    });
  }
}

// Singleton instance
export const chatEvents = new ChatEventBus();
