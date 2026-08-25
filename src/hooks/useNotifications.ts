import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';

function vapidKeyBytes(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function useNotifications() {
  const { session } = useApp();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      if (!session?.user || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (active) setEnabled(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (active) setEnabled(Boolean(subscription));
    }
    void loadStatus();
    return () => { active = false; };
  }, [session?.user]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const toggle = useCallback(async (on: boolean) => {
    if (!session?.user || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const registration = await navigator.serviceWorker.ready;
    const current = await registration.pushManager.getSubscription();

    if (!on) {
      if (current) {
        await supabase.from('push_subscriptions' as never).delete().eq('endpoint', current.endpoint);
        await current.unsubscribe();
      }
      await supabase.from('notification_preferences' as never).upsert({
        user_id: session.user.id,
        expiry_reminders: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
      } as never);
      setEnabled(false);
      return true;
    }

    let nextPermission = permission;
    if (nextPermission !== 'granted') nextPermission = await requestPermission();
    if (nextPermission !== 'granted') return false;
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicKey) return false;

    const subscription = current ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(publicKey),
    });
    const serialized = subscription.toJSON();
    if (!serialized.keys?.p256dh || !serialized.keys.auth) return false;
    const { error } = await supabase.from('push_subscriptions' as never).upsert({
      user_id: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: serialized.keys.p256dh,
      auth_key: serialized.keys.auth,
      user_agent: navigator.userAgent,
      enabled: true,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'endpoint' });
    if (error) return false;
    await supabase.from('notification_preferences' as never).upsert({
      user_id: session.user.id,
      expiry_reminders: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
      updated_at: new Date().toISOString(),
    } as never);
    setEnabled(true);
    return true;
  }, [permission, requestPermission, session?.user]);

  return { enabled, permission, toggle };
}
