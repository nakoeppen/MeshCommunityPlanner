/**
 * WebSocket Provider
 * React context provider for WebSocket connection
 * Includes heartbeat mechanism and connection state management
 * Iteration 11, Priority 1, Task 1.1
 */

import React, { createContext, useEffect, useRef, type ReactNode } from 'react';
import { WebSocketClient, getWebSocketClient } from './websocket';
import { useWebSocketStore } from '../stores/websocketStore';

interface WebSocketContextValue {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  send: (message: any) => void;
  subscribe: (handler: (msg: any) => void) => () => void;
  connect: (ticket: string) => Promise<void>;
  disconnect: () => void;
}

export const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  heartbeatInterval?: number; // milliseconds
  heartbeatTimeout?: number; // milliseconds
}

export function WebSocketProvider({
  children,
  heartbeatInterval = 30000, // 30 seconds
  heartbeatTimeout = 45000, // 45 seconds
}: WebSocketProviderProps) {
  const client = useRef<WebSocketClient>(getWebSocketClient());
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const timeoutCheckTimer = useRef<NodeJS.Timeout | null>(null);

  const { connected, connecting, error, setConnected, setConnecting, setError, setLastMessageTime } =
    useWebSocketStore();

  // Screen reader announcer
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create screen reader announcer
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.overflow = 'hidden';
    document.body.appendChild(announcer);
    announcerRef.current = announcer;

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
      }
    };
  }, []);

  // Announce connection status changes
  useEffect(() => {
    if (!announcerRef.current) return;

    if (connected) {
      announcerRef.current.textContent = 'Connected to server';
    } else if (connecting) {
      announcerRef.current.textContent = 'Reconnecting to server...';
    } else if (error) {
      announcerRef.current.textContent = 'Disconnected from server';
    }
  }, [connected, connecting, error]);

  // Start heartbeat when connected
  useEffect(() => {
    if (!connected) {
      stopHeartbeat();
      return;
    }

    startHeartbeat();

    return () => {
      stopHeartbeat();
    };
  }, [connected]);

  function startHeartbeat() {
    stopHeartbeat();

    // Send ping at regular intervals
    heartbeatTimer.current = setInterval(() => {
      if (client.current.isConnected()) {
        client.current.send({ type: 'ping', timestamp: Date.now() });
      }
    }, heartbeatInterval);

    // Check for timeout
    timeoutCheckTimer.current = setInterval(() => {
      const { lastMessageTime } = useWebSocketStore.getState();
      if (lastMessageTime && Date.now() - lastMessageTime > heartbeatTimeout) {
        console.error('WebSocket heartbeat timeout - reconnecting');
        client.current.disconnect();
        setConnected(false);
        setError(new Error('Connection timeout'));
      }
    }, heartbeatInterval);
  }

  function stopHeartbeat() {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    if (timeoutCheckTimer.current) {
      clearInterval(timeoutCheckTimer.current);
      timeoutCheckTimer.current = null;
    }
  }

  async function connect(ticket: string): Promise<void> {
    try {
      setConnecting(true);
      setError(null);
      await client.current.connect(ticket);
      setConnected(true);

      // Subscribe to pong messages
      client.current.subscribe((msg) => {
        if (msg.type === 'pong') {
          setLastMessageTime(Date.now());
        }
      });
    } catch (err) {
      setConnected(false);
      setError(err as Error);
      throw err;
    }
  }

  function disconnect() {
    stopHeartbeat();
    client.current.disconnect();
    setConnected(false);
    setError(null);
  }

  function send(message: any) {
    client.current.send(message);
  }

  function subscribe(handler: (msg: any) => void): () => void {
    return client.current.subscribe(handler);
  }

  const value: WebSocketContextValue = {
    connected,
    connecting,
    error,
    send,
    subscribe,
    connect,
    disconnect,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}
