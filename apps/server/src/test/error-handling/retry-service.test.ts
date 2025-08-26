import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  retryWithBackoff, 
  retryDatabaseOperation, 
  retryExternalApi, 
  CircuitBreaker,
  RetryError 
} from '../../utils/retry-service';

describe('Retry Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('retryWithBackoff', () => {
    it('returns result on first success', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockOperation, { maxRetries: 3 });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('throws RetryError after max retries', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const promise = retryWithBackoff(mockOperation, { maxRetries: 2 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(RetryError);
      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('respects retry condition', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Non-retryable error'));
      const retryCondition = vi.fn().mockReturnValue(false);

      await expect(
        retryWithBackoff(mockOperation, { retryCondition })
      ).rejects.toThrow(RetryError);

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(retryCondition).toHaveBeenCalledWith(expect.any(Error));
    });

    it('uses exponential backoff', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockOperation, {
        baseDelay: 100,
        backoffFactor: 2,
      });

      // Check that delays increase exponentially
      await vi.advanceTimersByTimeAsync(100); // First retry after 100ms
      await vi.advanceTimersByTimeAsync(200); // Second retry after 200ms
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('caps delay at maxDelay', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockOperation, {
        baseDelay: 1000,
        maxDelay: 500,
      });

      // Should use maxDelay instead of calculated delay
      await vi.advanceTimersByTimeAsync(500);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('calls onRetry callback', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue('success');
      const onRetry = vi.fn();

      const promise = retryWithBackoff(mockOperation, { onRetry });

      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('retryDatabaseOperation', () => {
    it('retries on database connection errors', async () => {
      const error = new Error('SQLITE_BUSY: database is locked');
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = retryDatabaseOperation(mockOperation, 'test operation');
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-retryable database errors', async () => {
      const error = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      const mockOperation = vi.fn().mockRejectedValue(error);

      const promise = retryDatabaseOperation(mockOperation, 'test operation');
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(RetryError);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryExternalApi', () => {
    it('retries on 5xx errors', async () => {
      const error = new Error('Server error');
      (error as any).status = 500;
      
      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = retryExternalApi(mockApiCall, 'test API');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockApiCall).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 4xx errors (except 429)', async () => {
      const error = new Error('Bad request');
      (error as any).status = 400;
      
      const mockApiCall = vi.fn().mockRejectedValue(error);

      const promise = retryExternalApi(mockApiCall, 'test API');
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(RetryError);
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 (rate limit)', async () => {
      const error = new Error('Rate limited');
      (error as any).status = 429;
      
      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = retryExternalApi(mockApiCall, 'test API');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockApiCall).toHaveBeenCalledTimes(2);
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(2, 1000); // 2 failures, 1s recovery
    });

    it('allows operations when circuit is closed', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('opens circuit after failure threshold', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

      // First failure
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Second failure - should open circuit
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('rejects operations when circuit is open', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

      // Trigger circuit opening
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      // Circuit should be open now
      expect(circuitBreaker.getState()).toBe('OPEN');

      // New operation should be rejected immediately
      const newMockOperation = vi.fn().mockResolvedValue('success');
      await expect(circuitBreaker.execute(newMockOperation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(newMockOperation).not.toHaveBeenCalled();
    });

    it('transitions to half-open after recovery timeout', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

      // Open the circuit
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Advance time past recovery timeout
      vi.advanceTimersByTime(1500);

      // Next operation should transition to half-open
      const successOperation = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('tracks failure count correctly', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

      expect(circuitBreaker.getFailureCount()).toBe(0);

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getFailureCount()).toBe(1);

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getFailureCount()).toBe(2);
    });

    it('resets failure count on successful operation in half-open state', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Service error'));
      const successOperation = vi.fn().mockResolvedValue('success');

      // Trigger circuit opening
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Advance time to trigger half-open state
      vi.advanceTimersByTime(1500);

      // Success in half-open state should reset count
      await circuitBreaker.execute(successOperation);
      expect(circuitBreaker.getFailureCount()).toBe(0);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });
});