import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import type { ConnectionStatus as ConnectionStatusType } from '@/services/socket'

interface ConnectionStatusProps {
  status: ConnectionStatusType
  className?: string
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  status, 
  className 
}) => {
  const getStatusContent = () => {
    if (status.connected) {
      return {
        icon: <Wifi className="h-3 w-3" />,
        text: 'Connected',
        variant: 'success' as const
      }
    }
    
    if (status.reconnecting) {
      return {
        icon: <Spinner size="sm" className="h-3 w-3" />,
        text: 'Reconnecting...',
        variant: 'warning' as const
      }
    }
    
    if (status.error) {
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        text: 'Connection Error',
        variant: 'destructive' as const
      }
    }
    
    return {
      icon: <WifiOff className="h-3 w-3" />,
      text: 'Disconnected',
      variant: 'secondary' as const
    }
  }

  const { icon, text, variant } = getStatusContent()

  return (
    <Badge 
      variant={variant} 
      className={cn("flex items-center gap-1 text-xs", className)}
    >
      {icon}
      {text}
    </Badge>
  )
}