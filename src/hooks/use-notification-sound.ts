import { useState, useEffect, useCallback } from 'react';

// Notification sound options
export const NOTIFICATION_SOUNDS = [
  { id: 'default', name: 'Padrão', file: '/sounds/notification-default.mp3' },
  { id: 'chime', name: 'Sino', file: '/sounds/notification-chime.mp3' },
  { id: 'pop', name: 'Pop', file: '/sounds/notification-pop.mp3' },
  { id: 'ding', name: 'Ding', file: '/sounds/notification-ding.mp3' },
  { id: 'message', name: 'Mensagem', file: '/sounds/notification-message.mp3' },
  { id: 'none', name: 'Sem som', file: null },
] as const;

export type NotificationSoundId = typeof NOTIFICATION_SOUNDS[number]['id'];

interface NotificationSoundSettings {
  soundEnabled: boolean;
  soundId: NotificationSoundId;
  pushEnabled: boolean;
  volume: number;
}

const SETTINGS_KEY = 'notification-sound-settings';

const defaultSettings: NotificationSoundSettings = {
  soundEnabled: true,
  soundId: 'default',
  pushEnabled: false,
  volume: 0.7,
};

// Audio cache to avoid re-loading
const audioCache: Record<string, HTMLAudioElement> = {};

function getAudio(soundId: NotificationSoundId): HTMLAudioElement | null {
  const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundId);
  if (!sound?.file) return null;

  if (!audioCache[soundId]) {
    audioCache[soundId] = new Audio(sound.file);
  }
  return audioCache[soundId];
}

export function useNotificationSound() {
  const [settings, setSettingsState] = useState<NotificationSoundSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  // Check push permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const updateSettings = useCallback((updates: Partial<NotificationSoundSettings>) => {
    setSettingsState(prev => {
      const newSettings = { ...prev, ...updates };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      
      if (permission === 'granted') {
        updateSettings({ pushEnabled: true });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [updateSettings]);

  const playSound = useCallback((customSoundId?: NotificationSoundId) => {
    if (!settings.soundEnabled) return;
    
    const soundId = customSoundId || settings.soundId;
    const audio = getAudio(soundId);
    
    if (audio) {
      audio.volume = settings.volume;
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Could not play notification sound:', err);
      });
    }
  }, [settings.soundEnabled, settings.soundId, settings.volume]);

  const previewSound = useCallback((soundId: NotificationSoundId) => {
    const audio = getAudio(soundId);
    if (audio) {
      audio.volume = settings.volume;
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Could not play sound preview:', err);
      });
    }
  }, [settings.volume]);

  const showPushNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!settings.pushEnabled || pushPermission !== 'granted') return;
    
    try {
      const notification = new Notification(title, {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error showing push notification:', error);
    }
  }, [settings.pushEnabled, pushPermission]);

  const notify = useCallback((title: string, body?: string, options?: { playSound?: boolean }) => {
    // Play sound
    if (options?.playSound !== false) {
      playSound();
    }

    // Show push notification
    if (settings.pushEnabled && pushPermission === 'granted') {
      showPushNotification(title, { body });
    }
  }, [playSound, showPushNotification, settings.pushEnabled, pushPermission]);

  return {
    settings,
    updateSettings,
    pushPermission,
    requestPushPermission,
    playSound,
    previewSound,
    showPushNotification,
    notify,
    isPushSupported: typeof window !== 'undefined' && 'Notification' in window,
  };
}
