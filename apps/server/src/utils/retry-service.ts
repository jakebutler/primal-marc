import { logger } from './logger';

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
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryCondition = () => true,
    onRetry,
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries || !retryCondition(error)) {
        throw new RetryError(
          `Operation failed after ${attempt + 1} attempts: ${lastError.message}`,
          attempt + 1,
          lastError
        );
      }

      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms:`, {
        error: error.message,
        attempt: attempt + 1,
        delay,
      });

      onRetry?.(attempt + 1, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Specialized retry for database operations
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return retryWithBackoff(operation, {
    maxRetries: 3,
    baseDelay: 500,
    retryCondition: (error) => {
      // Retry on connection errors, timeouts, and lock errors
      const retryableErrors = [
        'SQLITE_BUSY',
        'SQLITE_LOCKED',
        'ECONNRESET',
        'ETIMEDOUT',
        'connection',
        'timeout',
      ];
      
      const errorMessage = error.message?.toLowerCase() || '';
      return retryableErrors.some(pattern => errorMessage.includes(pattern));
    },
    onRetry: (attempt, error) => {
      logger.warn(`Database operation ${operationName} retry ${attempt}:`, error.message);
    },
  });
}

// Specialized retry for external API calls
export async function retryExternalApi<T>(
  apiCall: () => Promise<T>,
  apiName: string,
  options?: Partial<RetryOptions>
): Promise<T> {
  return retryWithBackoff(apiCall, {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryCondition: (error) => {
      // Don't retry client errors (4xx) except 429
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        return false;
      }
      // Retry server errors and network errors
      return true;
    },
    onRetry: (attempt, error) => {
      logger.warn(`External API ${apiName} retry ${attempt}:`, {
        error: error.message,
        status: error.status,
      });
    },
    ...options,
  });
}

// Circuit breaker pattern for external services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly monitoringPeriod: number = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
        logger.info('Circuit breaker reset to CLOSED state');
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}