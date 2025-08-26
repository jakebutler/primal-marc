import { useState, useCallback } from 'react';
import { ApiError, NetworkError, TimeoutError } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export interface ErrorState {
  error: Error | null;
  isError: boolean;
  context?: string;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  context?: string;
  onError?: (error: Error) => void;
  fallbackMode?: boolean;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
  });
  const { toast } = useToast();

  const handleError = useCallback((error: Error, customOptions?: Partial<ErrorHandlerOptions>) => {
    const finalOptions = { ...options, ...customOptions };
    
    console.error('Error handled:', error);
    
    setErrorState({
      error,
      isError: true,
      context: finalOptions.context,
    });

    // Show toast notification for certain error types
    if (finalOptions.showToast !== false) {
      let toastMessage = '';
      let toastVariant: 'default' | 'destructive' = 'destructive';

      if (error instanceof NetworkError) {
        toastMessage = 'Connection lost. Working in offline mode.';
        toastVariant = 'default';
      } else if (error instanceof TimeoutError) {
        toastMessage = 'Request timed out. Please try again.';
      } else if (error instanceof ApiError) {
        if (error.status === 429) {
          toastMessage = 'Rate limited. Please wait before trying again.';
          toastVariant = 'default';
        } else if (error.status >= 500) {
          toastMessage = 'Server error. Please try again later.';
        } else {
          toastMessage = error.message;
        }
      } else {
        toastMessage = error.message || 'An unexpected error occurred';
      }

      toast({
        title: 'Error',
        description: toastMessage,
        variant: toastVariant,
      });
    }

    // Call custom error handler
    finalOptions.onError?.(error);
  }, [options, toast]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
    });
  }, []);

  const retry = useCallback((retryFn: () => void | Promise<void>) => {
    clearError();
    try {
      const result = retryFn();
      if (result instanceof Promise) {
        result.catch(handleError);
      }
    } catch (error) {
      handleError(error as Error);
    }
  }, [clearError, handleError]);

  return {
    ...errorState,
    handleError,
    clearError,
    retry,
  };
}

// Specialized hook for API calls
export function useApiErrorHandler(options: ErrorHandlerOptions = {}) {
  const errorHandler = useErrorHandler({
    showToast: true,
    ...options,
  });

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    customOptions?: Partial<ErrorHandlerOptions>
  ): Promise<T | null> => {
    try {
      errorHandler.clearError();
      return await apiCall();
    } catch (error) {
      errorHandler.handleError(error as Error, customOptions);
      return null;
    }
  }, [errorHandler]);

  return {
    ...errorHandler,
    handleApiCall,
  };
}

// Specialized hook for AI agent calls
export function useAgentErrorHandler(agentType: string, options: ErrorHandlerOptions = {}) {
  const errorHandler = useErrorHandler({
    context: `${agentType} Agent`,
    showToast: true,
    ...options,
  });

  const handleAgentCall = useCallback(async <T>(
    agentCall: () => Promise<T>,
    fallbackFn?: () => T
  ): Promise<T | null> => {
    try {
      errorHandler.clearError();
      return await agentCall();
    } catch (error) {
      errorHandler.handleError(error as Error);
      
      // Try fallback if available
      if (fallbackFn) {
        try {
          return fallbackFn();
        } catch (fallbackError) {
          console.warn('Fallback also failed:', fallbackError);
        }
      }
      
      return null;
    }
  }, [errorHandler]);

  return {
    ...errorHandler,
    handleAgentCall,
  };
}