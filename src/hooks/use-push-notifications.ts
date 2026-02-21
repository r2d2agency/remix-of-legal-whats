import { useState, useCallback, useEffect } from 'react';
import { api, API_URL } from '@/lib/api';

// Type augmentation for PushManager on ServiceWorkerRegistration
declare global {
  interface ServiceWorkerRegistration {
    pushManager: any;
  }
}

interface PushSubscriptionStatus {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  loading: boolean;
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushSubscriptionStatus>({
    isSupported: false,
    isSubscribed: false,
    permission: 'unsupported',
    loading: true,
  });

  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // Check current subscription state
  useEffect(() => {
    if (!isSupported) {
      setStatus({ isSupported: false, isSubscribed: false, permission: 'unsupported', loading: false });
      return;
    }

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setStatus({
          isSupported: true,
          isSubscribed: !!subscription,
          permission: Notification.permission,
          loading: false,
        });
      } catch (err) {
        console.error('Error checking push subscription:', err);
        setStatus({ isSupported: true, isSubscribed: false, permission: Notification.permission, loading: false });
      }
    };

    checkSubscription();
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      setStatus(prev => ({ ...prev, loading: true }));

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(prev => ({ ...prev, permission, loading: false }));
        return false;
      }

      // Get VAPID key from server
      const { publicKey } = await api<{ publicKey: string }>('/api/push/vapid-key');
      if (!publicKey) {
        console.error('No VAPID public key configured');
        setStatus(prev => ({ ...prev, loading: false }));
        return false;
      }

      // Convert VAPID key
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Subscribe
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Send to server
      const subJson = subscription.toJSON();
      await api('/api/push/subscribe', {
        method: 'POST',
        body: {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
        },
        auth: true,
      });

      setStatus({ isSupported: true, isSubscribed: true, permission: 'granted', loading: false });
      return true;
    } catch (err) {
      console.error('Push subscribe error:', err);
      setStatus(prev => ({ ...prev, loading: false }));
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      setStatus(prev => ({ ...prev, loading: true }));

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        await api('/api/push/unsubscribe', {
          method: 'POST',
          body: { endpoint },
          auth: true,
        });
      }

      setStatus(prev => ({ ...prev, isSubscribed: false, loading: false }));
      return true;
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      setStatus(prev => ({ ...prev, loading: false }));
      return false;
    }
  }, [isSupported]);

  const sendTestNotification = useCallback(async () => {
    try {
      return await api<{ success: boolean; sent: number }>('/api/push/send', {
        method: 'POST',
        body: {
          title: '🔔 Teste de Notificação',
          body: 'As notificações push estão funcionando!',
          url: '/dashboard',
        },
        auth: true,
      });
    } catch (err) {
      console.error('Test notification error:', err);
      return null;
    }
  }, []);

  return {
    ...status,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}

// Helper to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
