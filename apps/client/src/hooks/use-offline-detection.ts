import { useState, useEffect } from 'react';

export interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
}

export function useOfflineDetection(): OfflineState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Show reconnection notification
        console.log('Connection restored');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      console.log('Connection lost - entering offline mode');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Additional connectivity check
    const checkConnectivity = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-cache',
        });
        const online = response.ok;
        if (online !== isOnline) {
          setIsOnline(online);
          if (!online) {
            setWasOffline(true);
          }
        }
      } catch {
        if (isOnline) {
          setIsOnline(false);
          setWasOffline(true);
        }
      }
    };

    // Check connectivity every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline, wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
  };
}