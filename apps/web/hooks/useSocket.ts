import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketResult {
  socket: Socket | null;
  isConnected: boolean;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

export const useSocket = (token?: string): UseSocketResult => {
  // Store the socket in a ref so it persists across renders
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // If no token (and not public), don't connect
    // Adjust logic if you have public endpoints
    if (!token) return;

    // 1. Create Socket only if it doesn't exist
    if (!socketRef.current) {
        socketRef.current = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],
            autoConnect: false, // Wait for manual connect
        });

        // Setup listeners
        socketRef.current.on('connect', () => {
            setIsConnected(true);
            console.log('Socket Connected:', socketRef.current?.id);
        });

        socketRef.current.on('disconnect', () => {
            setIsConnected(false);
            console.log('Socket Disconnected');
        });
    } else {
        // If socket exists but token changed, update auth
        if (socketRef.current.auth && typeof socketRef.current.auth === 'object') {
             (socketRef.current.auth as any).token = token;
        }
    }

    // 2. Connect
    if (!socketRef.current.connected) {
        socketRef.current.connect();
    }

    // 3. Cleanup
    return () => {
      // Optional: Only disconnect if we are truly unmounting the app
      // For now, we keep the connection alive to avoid the flicker in Strict Mode
      // If you want strict cleanup: socketRef.current?.disconnect();
    };
  }, [token]);

  return { socket: socketRef.current, isConnected };
};