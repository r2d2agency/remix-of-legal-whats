import { useState, useEffect, useCallback } from 'react';

// Notification sound options - including nostalgic retro sounds
export const NOTIFICATION_SOUNDS = [
  { id: 'default', name: 'Padrão', file: '/sounds/notification-default.mp3' },
  { id: 'chime', name: 'Sino', file: '/sounds/notification-chime.mp3' },
  { id: 'pop', name: 'Pop', file: '/sounds/notification-pop.mp3' },
  { id: 'ding', name: 'Ding', file: '/sounds/notification-ding.mp3' },
  { id: 'message', name: 'Mensagem', file: '/sounds/notification-message.mp3' },
  { id: 'laser', name: 'Laser', file: '/sounds/notification-laser.mp3' },
  // Nostalgic retro sounds
  { id: 'classic', name: 'Clássico (ICQ style)', file: '/sounds/notification-classic.mp3' },
  { id: 'retro', name: 'Retrô (MSN style)', file: '/sounds/notification-retro.mp3' },
  { id: 'bubble', name: 'Bolha', file: '/sounds/notification-bubble.mp3' },
  { id: 'beep', name: 'Bip Nostálgico', file: '/sounds/notification-beep.mp3' },
  { id: 'none', name: 'Sem som', file: null },
] as const;

// Sound options specifically for new conversations in waiting queue
export const NEW_CONVERSATION_SOUNDS = [
  { id: 'chime', name: 'Sino (duplo)', file: '/sounds/notification-chime.mp3' },
  { id: 'classic', name: 'Clássico (ICQ style)', file: '/sounds/notification-classic.mp3' },
  { id: 'retro', name: 'Retrô (MSN style)', file: '/sounds/notification-retro.mp3' },
  { id: 'laser', name: 'Laser', file: '/sounds/notification-laser.mp3' },
  { id: 'ding', name: 'Ding', file: '/sounds/notification-ding.mp3' },
  { id: 'default', name: 'Padrão', file: '/sounds/notification-default.mp3' },
  { id: 'none', name: 'Sem som', file: null },
] as const;

export type NotificationSoundId = typeof NOTIFICATION_SOUNDS[number]['id'];
export type NewConversationSoundId = typeof NEW_CONVERSATION_SOUNDS[number]['id'];

interface NotificationSoundSettings {
  soundEnabled: boolean;
  soundEnabledMobile: boolean;
  soundEnabledDesktop: boolean;
  soundId: NotificationSoundId;
  newConversationSoundId: NewConversationSoundId;
  pushEnabled: boolean;
  volume: number;
  mutedConnections: string[]; // connection IDs that are muted
  mutedConversations: string[]; // conversation IDs that are muted
}

const SETTINGS_KEY = 'notification-sound-settings';

const defaultSettings: NotificationSoundSettings = {
  soundEnabled: true,
  soundEnabledMobile: true,
  soundEnabledDesktop: true,
  soundId: 'default',
  newConversationSoundId: 'chime',
  pushEnabled: false,
  volume: 0.7,
  mutedConnections: [],
};

// Detect if current device is mobile
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

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

  const isSoundAllowedForDevice = useCallback(() => {
    if (!settings.soundEnabled) return false;
    const mobile = isMobileDevice();
    if (mobile && !settings.soundEnabledMobile) return false;
    if (!mobile && !settings.soundEnabledDesktop) return false;
    return true;
  }, [settings.soundEnabled, settings.soundEnabledMobile, settings.soundEnabledDesktop]);

  const isConnectionMuted = useCallback((connectionId?: string) => {
    if (!connectionId) return false;
    return settings.mutedConnections.includes(connectionId);
  }, [settings.mutedConnections]);

  const playSound = useCallback((customSoundId?: NotificationSoundId) => {
    if (!isSoundAllowedForDevice()) return;
    
    const soundId = customSoundId || settings.soundId;
    const audio = getAudio(soundId);
    
    if (audio) {
      audio.volume = settings.volume;
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Could not play notification sound:', err);
      });
    }
  }, [isSoundAllowedForDevice, settings.soundId, settings.volume]);

  // Play special sound for new conversations entering the waiting queue (plays twice for emphasis)
  const playNewConversationSound = useCallback(() => {
    if (!isSoundAllowedForDevice()) return;
    
    const soundId = settings.newConversationSoundId || 'chime';
    if (soundId === 'none') return;
    
    const sound = NEW_CONVERSATION_SOUNDS.find(s => s.id === soundId);
    if (!sound?.file) return;
    
    const audio = new Audio(sound.file);
    audio.volume = settings.volume;
    
    audio.play().then(() => {
      setTimeout(() => {
        const audio2 = new Audio(sound.file!);
        audio2.volume = settings.volume;
        audio2.play().catch(() => {});
      }, 300);
    }).catch(err => {
      console.warn('Could not play new conversation sound:', err);
    });
  }, [isSoundAllowedForDevice, settings.newConversationSoundId, settings.volume]);

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
    playNewConversationSound,
    previewSound,
    showPushNotification,
    notify,
    isConnectionMuted,
    isMobileDevice: isMobileDevice(),
    isPushSupported: typeof window !== 'undefined' && 'Notification' in window,
  };
}
