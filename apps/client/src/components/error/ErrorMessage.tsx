import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  MessageCircle, 
  Clock,
  DollarSign,
  Shield
} from 'lucide-react';
import { ApiError, NetworkError, TimeoutError } from '@/services/api';

interface ErrorMessageProps {
  error: Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  onFallbackMode?: () => void;
  context?: string;
}

export function ErrorMessage({ 
  error, 
  onRetry, 
  onDismiss, 
  onFallbackMode,
  context 
}: ErrorMessageProps) {
  const getErrorInfo = (error: Error) => {
    if (error instanceof NetworkError) {
      return {
        title: 'Connection Problem',
        description: 'Unable to connect to the server. Check your internet connection.',
        icon: WifiOff,
        variant: 'destructive' as const,
        canRetry: true,
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Switch to offline mode to continue working'
        ]
      };
    }

    if (error instanceof TimeoutError) {
      return {
        title: 'Request Timed Out',
        description: 'The request took too long to complete. This might be due to high server load.',
        icon: Clock,
        variant: 'destructive' as const,
        canRetry: true,
        suggestions: [
          'Try again in a few moments',
          'Check your internet connection',
          'The server might be experiencing high load'
        ]
      };
    }

    if (error instanceof ApiError) {
      if (error.status === 401) {
        return {
          title: 'Authentication Required',
          description: 'Your session has expired. Please log in again.',
          icon: Shield,
          variant: 'destructive' as const,
          canRetry: false,
          suggestions: ['You will be redirected to the login page']
        };
      }

      if (error.status === 403) {
        return {
          title: 'Access Denied',
          description: 'You don\'t have permission to perform this action.',
          icon: Shield,
          variant: 'destructive' as const,
          canRetry: false,
          suggestions: ['Contact support if you believe this is an error']
        };
      }

      if (error.status === 429) {
        return {
          title: 'Rate Limited',
          description: 'Too many requests. Please wait before trying again.',
          icon: Clock,
          variant: 'secondary' as const,
          canRetry: true,
          suggestions: [
            'Wait a few minutes before retrying',
            'Consider upgrading your plan for higher limits'
          ]
        };
      }

      if (error.status >= 500) {
        return {
          title: 'Server Error',
          description: 'Something went wrong on our end. We\'re working to fix it.',
          icon: AlertTriangle,
          variant: 'destructive' as const,
          canRetry: true,
          suggestions: [
            'Try again in a few minutes',
            'Your work is automatically saved',
            'Contact support if the problem persists'
          ]
        };
      }

      // Handle AI-specific errors
      if (error.message.includes('quota') || error.message.includes('budget')) {
        return {
          title: 'AI Service Unavailable',
          description: 'AI features are temporarily limited due to usage quotas.',
          icon: DollarSign,
          variant: 'secondary' as const,
          canRetry: false,
          suggestions: [
            'Continue working without AI assistance',
            'AI features will be restored soon',
            'Your content is automatically saved'
          ]
        };
      }
    }

    // Generic error
    return {
      title: 'Something Went Wrong',
      description: error.message || 'An unexpected error occurred.',
      icon: AlertTriangle,
      variant: 'destructive' as const,
      canRetry: true,
      suggestions: [
        'Try refreshing the page',
        'Check your internet connection',
        'Contact support if the problem persists'
      ]
    };
  };

  const errorInfo = getErrorInfo(error);
  const Icon = errorInfo.icon;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground">
          <Icon className="h-full w-full" />
        </div>
        <CardTitle className="flex items-center justify-center gap-2">
          {errorInfo.title}
          <Badge variant={errorInfo.variant} className="text-xs">
            {context || 'Error'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {errorInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorInfo.suggestions.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">What you can do:</p>
            <ul className="list-disc list-inside space-y-1">
              {errorInfo.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          {errorInfo.canRetry && onRetry && (
            <Button onClick={onRetry} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          
          {onFallbackMode && (
            <Button onClick={onFallbackMode} variant="outline" className="flex-1">
              <MessageCircle className="mr-2 h-4 w-4" />
              Continue Offline
            </Button>
          )}
          
          {onDismiss && (
            <Button onClick={onDismiss} variant="ghost" size="sm">
              Dismiss
            </Button>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Technical Details</summary>
            <pre className="mt-2 bg-muted p-2 rounded overflow-auto">
              {error.stack || error.message}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}