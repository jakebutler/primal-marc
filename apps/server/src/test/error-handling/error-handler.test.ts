import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { 
  errorHandler, 
  notFoundHandler, 
  AppError, 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError,
  asyncHandler 
} from '../../middleware/error-handler';

// Mock logger at the top level
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('AppError classes', () => {
    it('creates AppError with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', { detail: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ detail: 'test' });
    });

    it('creates ValidationError with correct defaults', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('creates NotFoundError with correct defaults', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('creates UnauthorizedError with correct defaults', () => {
      const error = new UnauthorizedError();
      
      expect(error.message).toBe('Unauthorized');
      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('errorHandler middleware', () => {
    beforeEach(() => {
      // Add error handler as last middleware
      app.use(errorHandler);
    });

    it('handles AppError correctly', async () => {
      app.get('/test', (req, res, next) => {
        next(new AppError('Test error', 400, 'TEST_ERROR'));
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Test error',
        code: 'TEST_ERROR',
      });
    });

    it('handles generic errors with 500 status', async () => {
      app.get('/test', (req, res, next) => {
        next(new Error('Generic error'));
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Generic error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('includes error details when provided', async () => {
      app.get('/test', (req, res, next) => {
        next(new AppError('Test error', 400, 'TEST_ERROR', { field: 'email' }));
      });

      const response = await request(app).get('/test');

      expect(response.body).toMatchObject({
        success: false,
        error: 'Test error',
        code: 'TEST_ERROR',
        details: { field: 'email' }
      });
    });

    it('includes stack trace in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.get('/test', (req, res, next) => {
        next(new Error('Test error'));
      });

      const response = await request(app).get('/test');

      expect(response.body).toMatchObject({
        success: false,
        error: 'Test error',
        code: 'INTERNAL_ERROR'
      });
      expect(response.body.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('does not include stack trace in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/test', (req, res, next) => {
        next(new Error('Test error'));
      });

      const response = await request(app).get('/test');

      expect(response.body.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler middleware', () => {
    beforeEach(() => {
      app.use(notFoundHandler);
      app.use(errorHandler);
    });

    it('handles 404 routes correctly', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Route /non-existent-route not found',
        code: 'NOT_FOUND',
      });
    });
  });

  describe('asyncHandler wrapper', () => {
    beforeEach(() => {
      app.use(errorHandler);
    });

    it('catches async errors and passes to error handler', async () => {
      app.get('/test', asyncHandler(async (req, res, next) => {
        throw new AppError('Async error', 400);
      }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Async error',
        code: 'INTERNAL_ERROR'
      });
    });

    it('handles successful async operations', async () => {
      app.get('/test', asyncHandler(async (req, res) => {
        res.json({ success: true });
      }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  describe('error logging', () => {
    beforeEach(() => {
      app.use(errorHandler);
    });

    it('logs server errors (5xx)', async () => {
      const { logger } = await import('../../utils/logger');
      
      app.get('/test', (req, res, next) => {
        next(new AppError('Server error', 500));
      });

      await request(app).get('/test');

      expect(logger.error).toHaveBeenCalledWith(
        'Server error:',
        expect.objectContaining({
          message: 'Server error',
          status: 500
        })
      );
    });

    it('logs client errors (4xx) as warnings', async () => {
      const { logger } = await import('../../utils/logger');
      
      app.get('/test', (req, res, next) => {
        next(new AppError('Client error', 400));
      });

      await request(app).get('/test');

      expect(logger.warn).toHaveBeenCalledWith(
        'Client error:',
        expect.objectContaining({
          message: 'Client error',
          status: 400
        })
      );
    });
  });
});