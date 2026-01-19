import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../../config';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface ChatbotContextType {
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  toggleChatbot: () => void;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

// Convert HTTP URL to WebSocket URL
const getWebSocketUrl = (): string => {
  const backendUrl = getBackendUrl();
  const wsUrl = backendUrl.replace(/^http/, 'ws');
  return `${wsUrl}/api/chat`;
};

export const ChatbotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'bot',
      content: 'Hello! I\'m your Debezium Platform assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return; // Already connected or connecting
    }

    try {
      setConnectionStatus('connecting');
      const wsUrl = getWebSocketUrl();
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      };

      ws.onmessage = (event) => {
        console.log('Received message:', event.data);
        try {
          const data = JSON.parse(event.data);
          
          // Handle bot response
          const botMessage: Message = {
            id: Date.now().toString(),
            role: 'bot',
            content: data.message || data.content || data.response || event.data,
            timestamp: new Date(),
          };
          
          setMessages((prev) => [...prev, botMessage]);
          setIsLoading(false);
        } catch (error) {
          // If not JSON, treat as plain text
          const botMessage: Message = {
            id: Date.now().toString(),
            role: 'bot',
            content: event.data,
            timestamp: new Date(),
          };
          
          setMessages((prev) => [...prev, botMessage]);
          setIsLoading(false);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setIsLoading(false);
        
        // Add error message to chat
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: 'bot',
          content: 'Connection error occurred. Attempting to reconnect...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setIsLoading(false);
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectWebSocket();
          }, delay);
        } else {
          const errorMessage: Message = {
            id: Date.now().toString(),
            role: 'bot',
            content: 'Unable to connect to the AI assistant. Please check your connection and try again later.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('error');
    }
  }, []);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);

  // Connect when chatbot opens, disconnect when it closes
  useEffect(() => {
    if (isOpen) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isOpen, connectWebSocket, disconnectWebSocket]);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const sendMessage = async (messageContent: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Check WebSocket connection
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }

      // Send message through WebSocket
      const payload = JSON.stringify({
        message: messageContent,
        timestamp: new Date().toISOString(),
      });
      
      wsRef.current.send(payload);
      console.log('Message sent:', payload);
      
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: 'Sorry, I couldn\'t send your message. Please check the connection and try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      
      // Attempt to reconnect
      if (connectionStatus !== 'connecting') {
        connectWebSocket();
      }
    }
  };

  const clearMessages = () => {
    setMessages([
      {
        id: '1',
        role: 'bot',
        content: 'Hello! I\'m your Debezium Platform assistant. How can I help you today?',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <ChatbotContext.Provider
      value={{
        isOpen,
        messages,
        isLoading,
        connectionStatus,
        toggleChatbot,
        sendMessage,
        clearMessages,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
};

export const useChatbot = () => {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};
