export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryCondition = (error) => {
      // Retry on network errors, 5xx errors, and timeouts
      if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
        return true;
      }
      if (error.status >= 500 && error.status < 600) {
        return true;
      }
      if (error.status === 429) { // Rate limited
        return true;
      }
      return false;
    },
    onRetry,
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries || !retryCondition(error)) {
        throw new RetryError(
          `Failed after ${attempt + 1} attempts: ${lastError.message}`,
          attempt + 1,
          lastError
        );
      }

      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      onRetry?.(attempt + 1, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Specialized retry for API calls
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  return retryWithBackoff(apiCall, {
    maxRetries: 3,
    baseDelay: 1000,
    retryCondition: (error) => {
      // Don't retry client errors (4xx) except 429
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        return false;
      }
      return true;
    },
    onRetry: (attempt, error) => {
      console.warn(`API call failed, retrying (${attempt}/${options?.maxRetries || 3}):`, error.message);
    },
    ...options,
  });
}

// Specialized retry for AI agent calls
export async function retryAgentCall<T>(
  agentCall: () => Promise<T>,
  agentType: string,
  options?: Partial<RetryOptions>
): Promise<T> {
  return retryWithBackoff(agentCall, {
    maxRetries: 2, // Fewer retries for expensive AI calls
    baseDelay: 2000,
    maxDelay: 10000,
    retryCondition: (error) => {
      // Don't retry on quota exceeded or invalid requests
      if (error.status === 429 && error.message?.includes('quota')) {
        return false;
      }
      if (error.status === 400) {
        return false;
      }
      return true;
    },
    onRetry: (attempt, error) => {
      console.warn(`${agentType} agent call failed, retrying (${attempt}/${options?.maxRetries || 2}):`, error.message);
    },
    ...options,
  });
}