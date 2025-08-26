import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIFallbackService, AgentResponse, FallbackResponse } from '@/services/ai-fallback';

describe('AIFallbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('caching', () => {
    it('caches successful responses', () => {
      const response: AgentResponse = {
        content: 'Test response',
        suggestions: ['suggestion1'],
        metadata: { test: true },
      };

      AIFallbackService.cacheResponse('test-key', response);

      const cached = AIFallbackService.getCachedResponse('test-key');
      expect(cached).toEqual(response);
    });

    it('returns null for non-existent cache', () => {
      const cached = AIFallbackService.getCachedResponse('non-existent');
      expect(cached).toBeNull();
    });

    it('returns null for expired cache', () => {
      const response: AgentResponse = { content: 'Test response' };
      
      // Mock Date.now to simulate cache expiry
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(1000);
      
      AIFallbackService.cacheResponse('test-key', response);
      
      // Advance time beyond cache duration
      Date.now = vi.fn().mockReturnValue(1000 + 25 * 60 * 60 * 1000); // 25 hours
      
      const cached = AIFallbackService.getCachedResponse('test-key');
      expect(cached).toBeNull();
      
      Date.now = originalNow;
    });

    it('generates consistent cache keys', () => {
      const key1 = AIFallbackService.generateCacheKey('ideation', 'test prompt', { context: 'test' });
      const key2 = AIFallbackService.generateCacheKey('ideation', 'test prompt', { context: 'test' });
      const key3 = AIFallbackService.generateCacheKey('ideation', 'different prompt', { context: 'test' });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('handleAgentCall', () => {
    it('returns successful response and caches it', async () => {
      const mockResponse: AgentResponse = {
        content: 'Successful response',
        suggestions: ['test'],
      };
      const mockAgentCall = vi.fn().mockResolvedValue(mockResponse);

      const result = await AIFallbackService.handleAgentCall(
        'ideation',
        'test prompt',
        mockAgentCall
      );

      expect(result).toEqual(mockResponse);
      expect(mockAgentCall).toHaveBeenCalledTimes(1);
      
      // Check that response was cached
      const cacheKey = AIFallbackService.generateCacheKey('ideation', 'test prompt');
      const cached = AIFallbackService.getCachedResponse(cacheKey);
      expect(cached).toEqual(mockResponse);
    });

    it('returns cached response on failure', async () => {
      const cachedResponse: AgentResponse = {
        content: 'Cached response',
      };
      
      // Cache a response first
      const cacheKey = AIFallbackService.generateCacheKey('ideation', 'test prompt');
      AIFallbackService.cacheResponse(cacheKey, cachedResponse);

      const mockAgentCall = vi.fn().mockRejectedValue(new Error('AI service failed'));

      const result = await AIFallbackService.handleAgentCall(
        'ideation',
        'test prompt',
        mockAgentCall
      );

      expect(AIFallbackService.isFallback(result)).toBe(true);
      if (AIFallbackService.isFallback(result)) {
        expect(result.fallbackType).toBe('cached');
        expect(result.content).toBe('Cached response');
      }
    });

    it('returns template fallback when no cache available', async () => {
      const mockAgentCall = vi.fn().mockRejectedValue(new Error('AI service failed'));

      const result = await AIFallbackService.handleAgentCall(
        'ideation',
        'test prompt',
        mockAgentCall
      );

      expect(AIFallbackService.isFallback(result)).toBe(true);
      if (AIFallbackService.isFallback(result)) {
        expect(result.fallbackType).toBe('template');
        expect(result.content).toContain('brainstorming approaches');
      }
    });

    it('provides appropriate fallback templates for different agents', async () => {
      const mockAgentCall = vi.fn().mockRejectedValue(new Error('AI service failed'));

      const ideationResult = await AIFallbackService.handleAgentCall(
        'ideation',
        'test prompt',
        mockAgentCall
      );

      const refinerResult = await AIFallbackService.handleAgentCall(
        'refiner',
        'test prompt',
        mockAgentCall
      );

      const mediaResult = await AIFallbackService.handleAgentCall(
        'media',
        'test prompt',
        mockAgentCall
      );

      const factcheckerResult = await AIFallbackService.handleAgentCall(
        'factchecker',
        'test prompt',
        mockAgentCall
      );

      expect(AIFallbackService.isFallback(ideationResult)).toBe(true);
      expect(AIFallbackService.isFallback(refinerResult)).toBe(true);
      expect(AIFallbackService.isFallback(mediaResult)).toBe(true);
      expect(AIFallbackService.isFallback(factcheckerResult)).toBe(true);

      if (AIFallbackService.isFallback(ideationResult)) {
        expect(ideationResult.content).toContain('Mind Mapping');
      }
      if (AIFallbackService.isFallback(refinerResult)) {
        expect(refinerResult.content).toContain('Structure Check');
      }
      if (AIFallbackService.isFallback(mediaResult)) {
        expect(mediaResult.content).toContain('Search Free Resources');
      }
      if (AIFallbackService.isFallback(factcheckerResult)) {
        expect(factcheckerResult.content).toContain('Verify Claims');
      }
    });
  });

  describe('cache cleanup', () => {
    it('removes expired cache entries', () => {
      const response: AgentResponse = { content: 'Test response' };
      
      // Mock Date.now for cache creation
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(1000);
      
      AIFallbackService.cacheResponse('test-key', response);
      
      // Advance time to expire cache
      Date.now = vi.fn().mockReturnValue(1000 + 25 * 60 * 60 * 1000); // 25 hours
      
      AIFallbackService.cleanupCache();
      
      const cached = AIFallbackService.getCachedResponse('test-key');
      expect(cached).toBeNull();
      
      Date.now = originalNow;
    });

    it('keeps valid cache entries during cleanup', () => {
      const response: AgentResponse = { content: 'Test response' };
      
      AIFallbackService.cacheResponse('test-key', response);
      AIFallbackService.cleanupCache();
      
      const cached = AIFallbackService.getCachedResponse('test-key');
      expect(cached).toEqual(response);
    });
  });

  describe('isFallback', () => {
    it('correctly identifies fallback responses', () => {
      const normalResponse: AgentResponse = { content: 'Normal response' };
      const fallbackResponse: FallbackResponse = {
        content: 'Fallback response',
        isFallback: true,
        fallbackType: 'cached',
        message: 'Using cached response',
      };

      expect(AIFallbackService.isFallback(normalResponse)).toBe(false);
      expect(AIFallbackService.isFallback(fallbackResponse)).toBe(true);
    });
  });
});