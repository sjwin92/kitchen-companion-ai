import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';

export function useNotifications() {
  const { inventory } = useApp();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Check daily for expiring items and send notification
  useEffect(() => {
    if (permission !== 'granted') return;

    const checkExpiry = () => {
      const urgent = inventory.filter(i => i.status === 'use-today');
      const soon = inventory.filter(i => i.status === 'use-soon');

      if (urgent.length > 0 || soon.length > 0) {
        const parts: string[] = [];
        if (urgent.length > 0) parts.push(`${urgent.length} item${urgent.length > 1 ? 's' : ''} expiring today`);
        if (soon.length > 0) parts.push(`${soon.length} item${soon.length > 1 ? 's' : ''} expiring soon`);

        const lastNotified = localStorage.getItem('last-expiry-notification');
        const today = new Date().toDateString();

        if (lastNotified !== today) {
          new Notification('Kitchen Companion', {
            body: parts.join(', ') + '. Check your kitchen!',
            icon: '/icons/icon-192.png',
            tag: 'expiry-reminder',
          });
          localStorage.setItem('last-expiry-notification', today);
        }
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60 * 60 * 1000); // hourly
    return () => clearInterval(interval);
  }, [permission, inventory]);

  return { permission, requestPermission };
}
