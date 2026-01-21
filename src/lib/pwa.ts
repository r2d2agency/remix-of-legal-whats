// Capture the install prompt for PWA
let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  (window as any).deferredPrompt = deferredPrompt;
  
  console.log('PWA install prompt available');
});

window.addEventListener('appinstalled', () => {
  // Clear the deferredPrompt so it can be garbage collected
  deferredPrompt = null;
  (window as any).deferredPrompt = null;
  
  console.log('PWA was installed');
});

export function isPWAInstalled(): boolean {
  // Check if running as standalone PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // Check iOS standalone mode
  if ((window.navigator as any).standalone === true) {
    return true;
  }
  
  return false;
}

export function canInstallPWA(): boolean {
  return deferredPrompt !== null || (window as any).deferredPrompt !== null;
}

export async function installPWA(): Promise<boolean> {
  const prompt = deferredPrompt || (window as any).deferredPrompt;
  
  if (!prompt) {
    console.log('No install prompt available');
    return false;
  }
  
  // Show the install prompt
  prompt.prompt();
  
  // Wait for the user to respond to the prompt
  const { outcome } = await prompt.userChoice;
  
  // Clear the saved prompt since it can't be used again
  deferredPrompt = null;
  (window as any).deferredPrompt = null;
  
  return outcome === 'accepted';
}

// Check if notifications are supported
export function supportsNotifications(): boolean {
  return 'Notification' in window;
}

// Check if service workers are supported
export function supportsServiceWorker(): boolean {
  return 'serviceWorker' in navigator;
}

// Get iOS detection
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Get Android detection
export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

// Get mobile detection
export function isMobile(): boolean {
  return isIOS() || isAndroid();
}
