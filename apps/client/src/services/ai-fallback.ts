import { retryAgentCall } from '@/utils/retry-with-backoff';

export interface AgentResponse {
  content: string;
  suggestions?: string[];
  metadata?: Record<string, any>;
}

export interface FallbackResponse {
  content: string;
  isFallback: true;
  fallbackType: 'cached' | 'template' | 'offline';
  message: string;
}

export type AgentResult = AgentResponse | FallbackResponse;

export class AIFallbackService {
  private static readonly CACHE_KEY_PREFIX = 'ai_cache_';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // Cache successful AI responses
  static cacheResponse(key: string, response: AgentResponse): void {
    const cacheEntry = {
      response,
      timestamp: Date.now(),
    };
    localStorage.setItem(
      `${this.CACHE_KEY_PREFIX}${key}`,
      JSON.stringify(cacheEntry)
    );
  }

  // Retrieve cached response if still valid
  static getCachedResponse(key: string): AgentResponse | null {
    try {
      const cached = localStorage.getItem(`${this.CACHE_KEY_PREFIX}${key}`);
      if (!cached) return null;

      const { response, timestamp } = JSON.parse(cached);
      
      // Check if cache is still valid
      if (Date.now() - timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(`${this.CACHE_KEY_PREFIX}${key}`);
        return null;
      }

      return response;
    } catch {
      return null;
    }
  }

  // Generate cache key from request parameters
  static generateCacheKey(agentType: string, prompt: string, context?: any): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${agentType}_${btoa(prompt + contextStr).slice(0, 32)}`;
  }

  // Fallback templates for different agent types
  private static getFallbackTemplate(agentType: string, userInput: string): FallbackResponse {
    const templates = {
      ideation: {
        content: `I understand you're looking for help with ideation around "${userInput}". While I'm temporarily unavailable, here are some general brainstorming approaches you can try:

1. **Mind Mapping**: Start with your core topic and branch out with related ideas
2. **Question Storming**: Ask "What if...?", "How might...?", "Why does...?" questions
3. **Perspective Shifting**: Consider your topic from different viewpoints or audiences
4. **Free Writing**: Set a timer for 10 minutes and write continuously about your topic

Try exploring these approaches, and I'll be back to provide more personalized assistance soon!`,
        message: 'Using general ideation guidance while AI agent is unavailable',
      },
      refiner: {
        content: `I see you're working on refining your draft. While I'm temporarily offline, here are some self-editing techniques:

1. **Structure Check**: Ensure each paragraph has a clear main point
2. **Flow Review**: Read aloud to identify awkward transitions
3. **Clarity Scan**: Replace complex words with simpler alternatives where possible
4. **Consistency Check**: Verify tone and style remain consistent throughout

Your draft is automatically saved, and I'll provide detailed feedback once I'm back online.`,
        message: 'Providing general editing guidance while AI agent is unavailable',
      },
      media: {
        content: `I'm currently unable to generate or suggest media content. In the meantime, you can:

1. **Search Free Resources**: Check Pexels, Pixabay for relevant images
2. **Create Simple Charts**: Use Google Sheets or Canva for basic visualizations
3. **Placeholder Content**: Add text placeholders like [IMAGE: description] to mark where media should go

I'll help you find and create the perfect media once I'm back online!`,
        message: 'Media generation temporarily unavailable - using manual alternatives',
      },
      factchecker: {
        content: `Fact-checking services are temporarily unavailable. For now, please:

1. **Verify Claims**: Double-check any factual statements using reliable sources
2. **Add Citations**: Include links to authoritative sources for key claims
3. **Mark Uncertainties**: Flag any statements you're unsure about with [VERIFY]
4. **Cross-Reference**: Compare information across multiple reputable sources

I'll provide comprehensive fact-checking once services are restored.`,
        message: 'Fact-checking temporarily offline - using manual verification',
      },
    };

    const template = templates[agentType as keyof typeof templates];
    if (!template) {
      return {
        content: `I'm temporarily unavailable to assist with ${agentType} tasks. Please try again in a few moments, or continue working on your content manually. Your work is automatically saved.`,
        isFallback: true,
        fallbackType: 'template',
        message: 'AI agent temporarily unavailable',
      };
    }

    return {
      content: template.content,
      isFallback: true,
      fallbackType: 'template',
      message: template.message,
    };
  }

  // Main fallback handler
  static async handleAgentCall<T extends AgentResponse>(
    agentType: string,
    prompt: string,
    agentCall: () => Promise<T>,
    context?: any
  ): Promise<AgentResult> {
    const cacheKey = this.generateCacheKey(agentType, prompt, context);

    try {
      // Try the actual AI call with retry logic
      const response = await retryAgentCall(agentCall, agentType, {
        maxRetries: 2,
        baseDelay: 2000,
      });

      // Cache successful response
      this.cacheResponse(cacheKey, response);
      return response;
    } catch (error) {
      console.warn(`AI agent ${agentType} failed, attempting fallback:`, error);

      // Try cached response first
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        return {
          ...cached,
          isFallback: true,
          fallbackType: 'cached',
          message: 'Using cached response while AI agent is unavailable',
        } as FallbackResponse;
      }

      // Fall back to template response
      return this.getFallbackTemplate(agentType, prompt);
    }
  }

  // Check if response is a fallback
  static isFallback(response: AgentResult): response is FallbackResponse {
    return 'isFallback' in response && response.isFallback === true;
  }

  // Clear expired cache entries
  static cleanupCache(): void {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(this.CACHE_KEY_PREFIX)
    );

    keys.forEach(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp > this.CACHE_DURATION) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  }
}