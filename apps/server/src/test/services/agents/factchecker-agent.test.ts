import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FactCheckerAgent } from '../../../services/agents/factchecker-agent.js'
import { LLMService } from '../../../services/llm.js'
import { AgentCapabilities, AgentRequest } from '../../../services/agents/base-agent.js'

// Mock fetch for external API calls
global.fetch = vi.fn()

describe('FactCheckerAgent', () => {
  let agent: FactCheckerAgent
  let mockLLMService: LLMService
  let capabilities: AgentCapabilities

  beforeEach(() => {
    // Mock LLM service
    mockLLMService = {
      generateCompletion: vi.fn().mockResolvedValue({
        content: 'Test LLM response',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.001
        },
        model: 'gpt-3.5-turbo'
      }),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' })
    } as any

    capabilities = {
      canHandlePhase: (phase) => phase === 'FACTCHECKER',
      canProcessContent: (contentType) => ['text', 'markdown', 'html', 'url'].includes(contentType),
      supportedLanguages: ['en'],
      maxContextLength: 10000,
      estimatedCostPerRequest: 0.025,
    }

    agent = new FactCheckerAgent(capabilities, mockLLMService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with correct type and capabilities', () => {
      expect(agent.type).toBe('FACTCHECKER')
      expect(agent.capabilities).toEqual(capabilities)
    })

    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow()
      expect(await agent.healthCheck()).toBe(true)
    })

    it('should cleanup successfully', async () => {
      await agent.initialize()
      await expect(agent.cleanup()).resolves.not.toThrow()
    })
  })

  describe('Request Validation', () => {
    const baseRequest: AgentRequest = {
      userId: 'user123',
      projectId: 'project456',
      conversationId: 'conv789',
      content: 'Test content with some claims.',
      context: {
        previousPhases: [],
        userPreferences: {
          preferredAgentPersonality: 'formal',
          writingGenres: ['academic'],
          experienceLevel: 'INTERMEDIATE'
        }
      }
    }

    it('should validate valid requests', async () => {
      const isValid = await agent.validateRequest(baseRequest)
      expect(isValid).toBe(true)
    })

    it('should reject requests with missing required fields', async () => {
      const invalidRequest = { ...baseRequest, userId: '' }
      const isValid = await agent.validateRequest(invalidRequest)
      expect(isValid).toBe(false)
    })

    it('should reject requests with content too long', async () => {
      const longContent = 'a'.repeat(15000) // Exceeds maxContextLength
      const invalidRequest = { ...baseRequest, content: longContent }
      const isValid = await agent.validateRequest(invalidRequest)
      expect(isValid).toBe(false)
    })
  })

  describe('Fact Claim Extraction', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should extract factual claims from content with statistics', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'According to recent studies, 75% of people prefer coffee over tea. The research was conducted in 2023.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['academic'],
            experienceLevel: 'INTERMEDIATE'
          }
        }
      }

      // Mock LLM response for claim extraction
      vi.mocked(mockLLMService.generateCompletion).mockResolvedValueOnce({
        content: `1. Claim: "75% of people prefer coffee over tea"
Type: statistic
Confidence: 0.8

2. Claim: "The research was conducted in 2023"
Type: historical
Confidence: 0.7`,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cost: 0.001 },
        model: 'gpt-3.5-turbo'
      })

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('Fact-Check Results')
      expect(response.content).toContain('claims analyzed')
      expect(mockLLMService.generateCompletion).toHaveBeenCalled()
    })

    it('should handle content with no factual claims', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'I think coffee tastes better than tea. This is just my personal opinion.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: ['personal'],
            experienceLevel: 'BEGINNER'
          }
        }
      }

      // Mock LLM response indicating no factual claims
      vi.mocked(mockLLMService.generateCompletion).mockResolvedValue({
        content: 'No specific factual claims requiring verification were found in this content.',
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75, cost: 0.0005 },
        model: 'gpt-3.5-turbo'
      })

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('No specific factual claims')
      expect(response.suggestions).toBeDefined()
      expect(response.metadata.confidence).toBeGreaterThan(0)
    })
  })

  describe('Search Integration', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should handle DuckDuckGo search results', async () => {
      // Mock DuckDuckGo API response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          AbstractText: 'Coffee is a popular beverage worldwide.',
          Heading: 'Coffee',
          AbstractURL: 'https://en.wikipedia.org/wiki/Coffee',
          AbstractSource: 'Wikipedia',
          RelatedTopics: [
            {
              Text: 'Coffee consumption statistics - Coffee is consumed by millions',
              FirstURL: 'https://example.com/coffee-stats'
            }
          ]
        })
      } as any)

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'Coffee is consumed by 2 billion people daily worldwide.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['academic'],
            experienceLevel: 'ADVANCED'
          }
        }
      }

      // Mock LLM responses
      vi.mocked(mockLLMService.generateCompletion)
        .mockResolvedValueOnce({
          content: `1. Claim: "Coffee is consumed by 2 billion people daily worldwide"
Type: statistic
Confidence: 0.9`,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cost: 0.001 },
          model: 'gpt-3.5-turbo'
        })
        .mockResolvedValueOnce({
          content: `Status: verified
Confidence: 0.8
Explanation: The claim is supported by multiple credible sources including industry reports and statistical databases.`,
          usage: { promptTokens: 150, completionTokens: 75, totalTokens: 225, cost: 0.0015 },
          model: 'gpt-3.5-turbo'
        })
        .mockResolvedValue({
          content: `SEO Suggestions:
1. Add external links to coffee industry reports
2. Include internal links to related beverage articles
3. Optimize for keywords like "coffee consumption statistics"`,
          usage: { promptTokens: 100, completionTokens: 60, totalTokens: 160, cost: 0.001 },
          model: 'gpt-3.5-turbo'
        })

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('✅ VERIFIED')
      expect(response.content).toContain('SEO Optimization Suggestions')
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('duckduckgo.com'))
    })

    it('should handle search API failures gracefully', async () => {
      // Mock fetch failure
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'The Earth is approximately 4.5 billion years old.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['scientific'],
            experienceLevel: 'INTERMEDIATE'
          }
        }
      }

      // Mock LLM response for claim extraction
      vi.mocked(mockLLMService.generateCompletion).mockResolvedValue({
        content: `1. Claim: "The Earth is approximately 4.5 billion years old"
Type: scientific
Confidence: 0.9`,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cost: 0.001 },
        model: 'gpt-3.5-turbo'
      })

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('❓ UNVERIFIED')
      expect(response.content).toContain('Unable to verify')
      expect(response.suggestions).toBeDefined()
    })
  })

  describe('SEO Suggestions', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should generate SEO suggestions for content', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'Climate change is affecting global weather patterns. Scientists have observed significant changes in temperature and precipitation.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['environmental'],
            experienceLevel: 'ADVANCED'
          }
        }
      }

      // Mock LLM responses
      vi.mocked(mockLLMService.generateCompletion)
        .mockResolvedValueOnce({
          content: 'No specific factual claims requiring verification were found.',
          usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75, cost: 0.0005 },
          model: 'gpt-3.5-turbo'
        })
        .mockResolvedValueOnce({
          content: `SEO Suggestions:
1. Add external links to IPCC reports and NASA climate data
2. Include internal links to related environmental articles
3. Optimize for keywords like "climate change effects" and "global weather patterns"
4. Add subheadings to structure the content better
5. Link to authoritative sources like NOAA and EPA`,
          usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200, cost: 0.0012 },
          model: 'gpt-3.5-turbo'
        })

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('SEO Optimization Suggestions')
      expect(response.content).toContain('External Link')
      expect(response.content).toContain('Keyword')
      expect(response.suggestions.some(s => s.type === 'improvement')).toBe(true)
    })

    it('should provide fallback SEO suggestions when LLM fails', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'A very long article about sustainable energy sources and their impact on the environment. This content discusses various renewable energy technologies including solar, wind, and hydroelectric power. The article explores the benefits and challenges of transitioning to clean energy.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['environmental'],
            experienceLevel: 'INTERMEDIATE'
          }
        }
      }

      // Mock LLM failure for SEO analysis
      vi.mocked(mockLLMService.generateCompletion)
        .mockResolvedValueOnce({
          content: 'No factual claims found.',
          usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75, cost: 0.0005 },
          model: 'gpt-3.5-turbo'
        })
        .mockRejectedValueOnce(new Error('LLM service unavailable'))

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('SEO Optimization Suggestions')
      expect(response.content).toContain('Add Subheadings') // Fallback suggestion for long content
      expect(response.content).toContain('Link to Authoritative Sources')
    })
  })

  describe('Conflicting Information Detection', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should detect and report conflicting information', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'The population of Tokyo is 50 million people.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['factual'],
            experienceLevel: 'INTERMEDIATE'
          }
        }
      }

      // Mock search results
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          AbstractText: 'Tokyo metropolitan area has approximately 14 million people.',
          Heading: 'Tokyo Population',
          AbstractURL: 'https://en.wikipedia.org/wiki/Tokyo',
          AbstractSource: 'Wikipedia'
        })
      } as any)

      // Mock LLM responses
      vi.mocked(mockLLMService.generateCompletion)
        .mockResolvedValueOnce({
          content: `1. Claim: "The population of Tokyo is 50 million people"
Type: statistic
Confidence: 0.8`,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cost: 0.001 },
          model: 'gpt-3.5-turbo'
        })
        .mockResolvedValueOnce({
          content: `Status: false
Confidence: 0.9
Explanation: The claim significantly overestimates Tokyo's population. Credible sources indicate the Tokyo metropolitan area has approximately 14 million people, not 50 million.
Alternatives: The population of Tokyo metropolitan area is approximately 14 million people.`,
          usage: { promptTokens: 150, completionTokens: 100, totalTokens: 250, cost: 0.002 },
          model: 'gpt-3.5-turbo'
        })
        .mockResolvedValueOnce({
          content: 'Basic SEO suggestions for population statistics.',
          usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80, cost: 0.0006 },
          model: 'gpt-3.5-turbo'
        })

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('❌ FALSE')
      expect(response.content).toContain('Conflicting Information Detected')
      expect(response.content).toContain('CONTRADICTORY')
      expect(response.suggestions.some(s => s.title.includes('Disputed Claims'))).toBe(true)
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should provide fallback response when processing fails', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'Test content for error handling.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'casual',
            writingGenres: ['general'],
            experienceLevel: 'BEGINNER'
          }
        }
      }

      // Mock LLM service failure
      vi.mocked(mockLLMService.generateCompletion).mockRejectedValue(new Error('LLM service error'))

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('Manual Fact-Checking Guidelines')
      expect(response.content).toContain('Recommended Fact-Checking Resources')
      expect(response.suggestions.some(s => s.title.includes('Manual fact-checking'))).toBe(true)
      expect(response.metadata.confidence).toBeLessThan(0.5)
    })

    it('should handle invalid request gracefully', async () => {
      const invalidRequest = {
        userId: '',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'Test content'
      } as AgentRequest

      // Should not throw, but return an error response
      await expect(agent.processRequest(invalidRequest)).rejects.toThrow()
    })
  })

  describe('Caching', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should cache fact-check results', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'Water boils at 100 degrees Celsius at sea level.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['scientific'],
            experienceLevel: 'INTERMEDIATE'
          }
        }
      }

      // Mock search results
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          AbstractText: 'Water boils at 100°C (212°F) at standard atmospheric pressure.',
          Heading: 'Boiling Point',
          AbstractURL: 'https://en.wikipedia.org/wiki/Boiling_point',
          AbstractSource: 'Wikipedia'
        })
      } as any)

      // Mock LLM responses
      vi.mocked(mockLLMService.generateCompletion)
        .mockResolvedValue({
          content: `1. Claim: "Water boils at 100 degrees Celsius at sea level"
Type: scientific
Confidence: 0.95`,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cost: 0.001 },
          model: 'gpt-3.5-turbo'
        })

      // First request
      const response1 = await agent.processRequest(request)
      expect(response1.content).toContain('claims analyzed')

      // Second request with same content should use cache
      const response2 = await agent.processRequest(request)
      expect(response2.content).toContain('claims analyzed')

      // Verify metrics show cache usage
      const metrics = await agent.getMetrics()
      expect(metrics.cacheSize).toBeGreaterThan(0)
    })
  })

  describe('Metrics and Health', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should provide comprehensive metrics', async () => {
      const metrics = await agent.getMetrics()
      
      expect(metrics).toHaveProperty('agentType', 'FACTCHECKER')
      expect(metrics).toHaveProperty('initialized', true)
      expect(metrics).toHaveProperty('requestCount')
      expect(metrics).toHaveProperty('cacheSize')
      expect(metrics).toHaveProperty('trustedDomainsCount')
    })

    it('should perform health checks', async () => {
      const isHealthy = await agent.healthCheck()
      expect(isHealthy).toBe(true)
    })

    it('should handle health check failures', async () => {
      // Mock search failure
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      
      const isHealthy = await agent.healthCheck()
      expect(isHealthy).toBe(false)
    })
  })

  describe('Source Credibility', () => {
    beforeEach(async () => {
      await agent.initialize()
    })

    it('should assign high credibility to trusted domains', async () => {
      const request: AgentRequest = {
        userId: 'user123',
        projectId: 'project456',
        conversationId: 'conv789',
        content: 'The speed of light is 299,792,458 meters per second.',
        context: {
          previousPhases: [],
          userPreferences: {
            preferredAgentPersonality: 'formal',
            writingGenres: ['scientific'],
            experienceLevel: 'ADVANCED'
          }
        }
      }

      // Mock search results from trusted domain
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          AbstractText: 'The speed of light in vacuum is exactly 299,792,458 metres per second.',
          Heading: 'Speed of Light',
          AbstractURL: 'https://en.wikipedia.org/wiki/Speed_of_light',
          AbstractSource: 'Wikipedia'
        })
      } as any)

      // Mock LLM responses
      vi.mocked(mockLLMService.generateCompletion)
        .mockResolvedValueOnce({
          content: `1. Claim: "The speed of light is 299,792,458 meters per second"
Type: scientific
Confidence: 0.95`,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cost: 0.001 },
          model: 'gpt-3.5-turbo'
        })
        .mockResolvedValueOnce({
          content: `Status: verified
Confidence: 0.95
Explanation: This is a well-established scientific constant verified by multiple authoritative sources.`,
          usage: { promptTokens: 150, completionTokens: 75, totalTokens: 225, cost: 0.0015 },
          model: 'gpt-3.5-turbo'
        })
        .mockResolvedValueOnce({
          content: 'SEO suggestions for scientific content.',
          usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80, cost: 0.0006 },
          model: 'gpt-3.5-turbo'
        })

      const response = await agent.processRequest(request)
      
      expect(response.content).toContain('✅ VERIFIED')
      expect(response.content).toContain('95% confidence')
    })
  })
})