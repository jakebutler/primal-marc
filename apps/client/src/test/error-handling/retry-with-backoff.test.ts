import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  retryWithBackoff, 
  retryApiCall, 
  retryAgentCall, 
  RetryError 
} from '@/utils/retry-with-backoff';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first success', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, { maxRetries: 3, baseDelay: 10 });

    // Run all timers to completion
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('throws RetryError after max retries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

    const promise = retryWithBackoff(mockFn, { maxRetries: 2, baseDelay: 10 });

    await vi.runAllTimersAsync();

    try {
      await promise;
      expect.fail('Expected promise to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(RetryError);
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }
  });

  it('respects retry condition', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Non-retryable error'));
    const retryCondition = vi.fn().mockReturnValue(false);

    try {
      await retryWithBackoff(mockFn, { retryCondition });
      expect.fail('Expected promise to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(RetryError);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(retryCondition).toHaveBeenCalledWith(expect.any(Error));
    }
  });

  it('uses exponential backoff', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, {
      baseDelay: 10,
      backoffFactor: 2,
    });

    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('success');
  });

  it('caps delay at maxDelay', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, {
      baseDelay: 1000,
      maxDelay: 50,
    });

    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('success');
  });

  it('calls onRetry callback', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Failure'))
      .mockResolvedValue('success');
    const onRetry = vi.fn();

    const promise = retryWithBackoff(mockFn, { onRetry, baseDelay: 10 });

    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

describe('retryApiCall', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on 5xx errors', async () => {
    const error = new Error('Server error');
    (error as any).status = 500;
    
    const mockFn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const promise = retryApiCall(mockFn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx errors (except 429)', async () => {
    const error = new Error('Bad request');
    (error as any).status = 400;
    
    const mockFn = vi.fn().mockRejectedValue(error);

    await expect(retryApiCall(mockFn)).rejects.toThrow(RetryError);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 (rate limit)', async () => {
    const error = new Error('Rate limited');
    (error as any).status = 429;
    
    const mockFn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const promise = retryApiCall(mockFn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('retryAgentCall', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has fewer retries for expensive AI calls', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('AI service error'));

    const promise = retryAgentCall(mockFn, 'ideation');
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(RetryError);
    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries (fewer than API calls)
  });

  it('does not retry on quota exceeded', async () => {
    const error = new Error('Quota exceeded');
    (error as any).status = 429;
    error.message = 'quota exceeded';
    
    const mockFn = vi.fn().mockRejectedValue(error);

    await expect(retryAgentCall(mockFn, 'ideation')).rejects.toThrow(RetryError);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on bad requests', async () => {
    const error = new Error('Invalid prompt');
    (error as any).status = 400;
    
    const mockFn = vi.fn().mockRejectedValue(error);

    await expect(retryAgentCall(mockFn, 'ideation')).rejects.toThrow(RetryError);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});