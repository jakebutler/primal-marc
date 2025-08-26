import React from 'react';
import { useOfflineDetection } from '@/hooks/use-offline-detection';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const { isOnline, isOffline, wasOffline } = useOfflineDetection();

  if (isOnline && !wasOffline) {
    return null; // Don't show anything when online and never was offline
  }

  return (
    <Badge
      variant={isOffline ? 'destructive' : 'default'}
      className={cn(
        'fixed top-4 right-4 z-50 flex items-center gap-2',
        className
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-3 w-3" />
          Offline Mode
        </>
      ) : (
        <>
          <Wifi className="h-3 w-3" />
          Back Online
        </>
      )}
    </Badge>
  );
}