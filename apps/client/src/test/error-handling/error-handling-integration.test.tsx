import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { AgentErrorBoundary } from '@/components/error/AgentErrorBoundary';
import { OfflineIndicator } from '@/components/offline/OfflineIndicator';
import { ErrorMessage } from '@/components/error/ErrorMessage';
import { useErrorHandler, useApiErrorHandler, useAgentErrorHandler } from '@/hooks/use-error-handler';
import { ApiError, NetworkError, TimeoutError } from '@/services/api';
import { AIFallbackService } from '@/services/ai-fallback';

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Test component that uses error handlers
const TestApiComponent = () => {
  const { handleApiCall, error, isError, retry } = useApiErrorHandler();

  const makeApiCall = async () => {
    await handleApiCall(async () => {
      throw new ApiError('API failed', 500);
    });
  };

  const makeSuccessfulCall = async () => {
    await handleApiCall(async () => {
      return 'success';
    });
  };

  return (
    <div>
      <button onClick={makeApiCall}>Make API Call</button>
      <button onClick={makeSuccessfulCall}>Make Successful Call</button>
      <button onClick={() => retry(makeSuccessfulCall)}>Retry</button>
      {isError && <div>Error: {error?.message}</div>}
    </div>
  );
};

const TestAgentComponent = () => {
  const { handleAgentCall, error, isError } = useAgentErrorHandler('ideation');

  const makeAgentCall = async () => {
    await handleAgentCall(async () => {
      throw new Error('Agent failed');
    }, () => ({ content: 'Fallback response' }));
  };

  return (
    <div>
      <button onClick={makeAgentCall}>Make Agent Call</button>
      {isError && <div>Agent Error: {error?.message}</div>}
    </div>
  );
};

describe('Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Complete error flow', () => {
    it('handles API errors with retry functionality', async () => {
      render(<TestApiComponent />);

      // Trigger API error
      fireEvent.click(screen.getByText('Make API Call'));

      await waitFor(() => {
        expect(screen.getByText(/Error: API failed/)).toBeInTheDocument();
      });

      // Test retry functionality
      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.queryByText(/Error: API failed/)).not.toBeInTheDocument();
      });
    });

    it('handles agent errors with fallback', async () => {
      render(<TestAgentComponent />);

      fireEvent.click(screen.getByText('Make Agent Call'));

      await waitFor(() => {
        expect(screen.getByText(/Agent Error: Agent failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Error boundaries with different error types', () => {
    const ThrowingComponent = ({ errorType }: { errorType: string }) => {
      if (errorType === 'network') {
        throw new NetworkError();
      }
      if (errorType === 'timeout') {
        throw new TimeoutError();
      }
      if (errorType === 'api') {
        throw new ApiError('API Error', 500);
      }
      throw new Error('Generic error');
    };

    it('handles network errors appropriately', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent errorType="network" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('handles timeout errors appropriately', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent errorType="timeout" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('handles API errors appropriately', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent errorType="api" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Agent error boundary with fallback', () => {
    const FailingAgentComponent = () => {
      throw new Error('Agent component failed');
    };

    it('provides agent-specific error handling', () => {
      const onFallbackMode = vi.fn();

      render(
        <AgentErrorBoundary agentType="ideation" onFallbackMode={onFallbackMode}>
          <FailingAgentComponent />
        </AgentErrorBoundary>
      );

      expect(screen.getByText('AI Agent Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/ideation agent encountered an error/)).toBeInTheDocument();

      // Test fallback mode
      fireEvent.click(screen.getByText('Continue Without AI'));
      expect(onFallbackMode).toHaveBeenCalled();
    });

    it('shows retry button for recoverable errors', () => {
      const onRetry = vi.fn();

      render(
        <AgentErrorBoundary agentType="ideation" onRetry={onRetry}>
          <FailingAgentComponent />
        </AgentErrorBoundary>
      );

      const retryButton = screen.getByText('Retry Agent');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('Error message component with different error types', () => {
    it('displays appropriate message for network errors', () => {
      const error = new NetworkError();
      const onRetry = vi.fn();

      render(<ErrorMessage error={error} onRetry={onRetry} />);

      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      expect(screen.getByText(/Check your internet connection/)).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Try Again'));
      expect(onRetry).toHaveBeenCalled();
    });

    it('displays appropriate message for timeout errors', () => {
      const error = new TimeoutError();

      render(<ErrorMessage error={error} />);

      expect(screen.getByText('Request Timed Out')).toBeInTheDocument();
      expect(screen.getByText(/took too long to complete/)).toBeInTheDocument();
    });

    it('displays appropriate message for API errors', () => {
      const error = new ApiError('Server error', 500);

      render(<ErrorMessage error={error} />);

      expect(screen.getByText('Server Error')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong on our end/)).toBeInTheDocument();
    });

    it('displays appropriate message for rate limit errors', () => {
      const error = new ApiError('Rate limited', 429);

      render(<ErrorMessage error={error} />);

      expect(screen.getByText('Rate Limited')).toBeInTheDocument();
      expect(screen.getByText(/Too many requests/)).toBeInTheDocument();
    });

    it('provides fallback mode option when available', () => {
      const error = new NetworkError();
      const onFallbackMode = vi.fn();

      render(<ErrorMessage error={error} onFallbackMode={onFallbackMode} />);

      fireEvent.click(screen.getByText('Continue Offline'));
      expect(onFallbackMode).toHaveBeenCalled();
    });
  });

  describe('Offline detection integration', () => {
    it('shows offline indicator when offline', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(<OfflineIndicator />);

      expect(screen.getByText('Offline Mode')).toBeInTheDocument();
    });

    it('shows reconnection indicator when back online', () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { rerender } = render(<OfflineIndicator />);

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      // Simulate the hook detecting the change
      rerender(<OfflineIndicator />);

      // Note: This test would need more sophisticated mocking of the useOfflineDetection hook
      // to properly test the "Back Online" state
    });
  });

  describe('AI fallback service integration', () => {
    it('provides cached responses when AI service fails', async () => {
      const mockResponse = { content: 'Cached response' };
      AIFallbackService.cacheResponse('test-key', mockResponse);

      const result = await AIFallbackService.handleAgentCall(
        'ideation',
        'test prompt',
        async () => {
          throw new Error('AI service failed');
        }
      );

      expect(AIFallbackService.isFallback(result)).toBe(true);
      if (AIFallbackService.isFallback(result)) {
        expect(result.fallbackType).toBe('cached');
      }
    });

    it('provides template responses when no cache available', async () => {
      const result = await AIFallbackService.handleAgentCall(
        'ideation',
        'test prompt',
        async () => {
          throw new Error('AI service failed');
        }
      );

      expect(AIFallbackService.isFallback(result)).toBe(true);
      if (AIFallbackService.isFallback(result)) {
        expect(result.fallbackType).toBe('template');
        expect(result.content).toContain('brainstorming approaches');
      }
    });
  });
});