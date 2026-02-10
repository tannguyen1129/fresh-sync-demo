'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { EVENTS, NotificationPayload } from '@freshsync/shared';

export default function NotificationCenter() {
  const { socket } = useSocket('demo-token'); // Replace with real token
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    socket.on(EVENTS.NOTIFICATION_CREATED, (data: NotificationPayload) => {
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
      
      // Browser Alert (Optional)
      if (Notification.permission === 'granted') {
          new Notification(data.title, { body: data.message });
      }
    });

    return () => {
      socket.off(EVENTS.NOTIFICATION_CREATED);
    };
  }, [socket]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Icon */}
      <button onClick={() => setIsOpen(!isOpen)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.5rem' }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ 
              position: 'absolute', top: 0, right: 0, 
              background: 'red', color: 'white', 
              borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem' 
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown List */}
      {isOpen && (
        <div style={{
            position: 'absolute', right: 0, top: '40px',
            width: '300px', maxHeight: '400px', overflowY: 'auto',
            background: 'white', border: '1px solid #ddd', borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 1000
        }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>Notifications</div>
            {notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No notifications</div>
            ) : (
                notifications.map((notif, idx) => (
                    <div key={idx} style={{ 
                        padding: '10px', borderBottom: '1px solid #f0f0f0',
                        backgroundColor: notif.type === 'ERROR' ? '#fff0f0' : 'white' 
                    }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{notif.title}</div>
                        <div style={{ fontSize: '0.85rem', color: '#555' }}>{notif.message}</div>
                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '5px' }}>{new Date(notif.createdAt).toLocaleTimeString()}</div>
                    </div>
                ))
            )}
        </div>
      )}
    </div>
  );
}