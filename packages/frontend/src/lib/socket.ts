import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@quiz/shared';
import type { SessionJoinPayload } from '@quiz/shared';

let socket: Socket | null = null;
const joinedCodes = new Set<string>();
const activeSessions = new Map<string, SessionJoinPayload>();

export function getSocket(token?: string): Socket {
  // Return existing socket even while still connecting — do NOT check .connected
  // Checking .connected creates a second socket because the first is "connecting"
  // but not yet "connected", causing listeners and emits to land on different objects.
  if (socket) return socket;

  socket = io('/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: token ? { token } : undefined,
    withCredentials: true,
  });

  // Re-join all active sessions after any reconnect
  socket.io.on('reconnect', () => {
    for (const payload of activeSessions.values()) {
      socket!.emit(SOCKET_EVENTS.SESSION_JOIN, payload);
    }
  });

  return socket;
}

export function joinSession(
  code: string,
  info: { firstName: string; lastName: string; nickname: string },
): void {
  // Prevent double-emit (React StrictMode runs effects twice in dev)
  if (joinedCodes.has(code)) return;
  joinedCodes.add(code);

  const payload: SessionJoinPayload = { code, ...info };
  activeSessions.set(code, payload);

  getSocket().emit(SOCKET_EVENTS.SESSION_JOIN, payload);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  joinedCodes.clear();
  activeSessions.clear();
}
