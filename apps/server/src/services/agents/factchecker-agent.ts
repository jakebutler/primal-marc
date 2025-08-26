import { 
  BaseAgent, 
  AgentCapabilities, 
  AgentRequest, 
  AgentResponse, 
  AgentContext,
  Suggestion
} from './base-agent.js'
import { LLMService, LLMResponse } from '../llm.js'
import { logger } from '../../utils/logger.js'

// Fact-checking specific interfaces
export interface FactualClaim {
  id: string
  text: string
  type: 'statistic' | 'historical' | 'scientific' | 'general' | 'opinion'
  confidence: number // 0-1, how confident we are this is a factual claim
  context: string // Surrounding text for context
  position: {
    start: number
    end: number
  }
}

export interface FactCheckResult {
  claimId: string
  status: 'verified' | 'disputed' | 'unverified' | 'false' | 'misleading'
  confidence: number // 0-1, confidence in the fact-check result
  sources: SourceReference[]
  explanation: string
  alternatives?: string[] // Alternative phrasings or corrections
  lastChecked: Date
}

export interface SourceReference {
  id: string
  title: string
  url: string
  domain: string
  credibilityScore: number // 0-1, based on domain reputation
  relevanceScore: number // 0-1, how relevant to the claim
  snippet: string // Relevant excerpt
  publishDate?: Date
  author?: string
}

export interface SEOSuggestion {
  type: 'internal_link' | 'external_link' | 'keyword' | 'meta' | 'structure'
  title: string
  description: string
  implementation: string
  priority: 'high' | 'medium' | 'low'
  estimatedImpact: string
}

export interface ConflictingInformation {
  claimId: string
  conflictType: 'contradictory' | 'outdated' | 'context_dependent' | 'disputed'
  sources: SourceReference[]
  explanation: string
  recommendation: string
}

// Free search API interfaces
interface DuckDuckGoSearchResult {
  title: string
  url: string
  snippet: string
  domain: string
}

interface SerpAPIResult {
  title: string
  link: string
  snippet: string
  source: string
  date?: string
}

/**
 * Fact-Checker and SEO Agent - Verifies claims and optimizes content for search
 */
export class FactCheckerAgent extends BaseAgent {
  private factCheckCache: Map<string, FactCheckResult> = new Map()
  private sourceCredibilityCache: Map<string, number> = new Map()
  private requestCount: number = 0
  private totalProcessingTime: number = 0
  private cacheHits: number = 0

  // Trusted domains for fact-checking (higher credibility scores)
  private readonly trustedDomains = new Map([
    ['wikipedia.org', 0.8],
    ['britannica.com', 0.9],
    ['reuters.com', 0.9],
    ['ap.org', 0.9],
    ['bbc.com', 0.8],
    ['cnn.com', 0.7],
    ['nytimes.com', 0.8],
    ['washingtonpost.com', 0.8],
    ['nature.com', 0.95],
    ['science.org', 0.95],
    ['pubmed.ncbi.nlm.nih.gov', 0.95],
    ['scholar.google.com', 0.85],
    ['gov', 0.9], // Government domains
    ['edu', 0.85], // Educational domains
  ])

  constructor(capabilities: AgentCapabilities, llmService: LLMService) {
    super('FACTCHECKER', capabilities, llmService)
  }

  /**
   * Process fact-checking and SEO optimization request
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    this.requestCount++

    try {
      logger.info(`Fact-checker agent processing request`, {
        userId: request.userId,
        projectId: request.projectId,
        contentLength: request.content.length,
      })

      // Validate request
      const isValid = await this.validateRequest(request)
      if (!isValid) {
        return this.createFallbackResponse(request, new Error('Invalid request parameters'))
      }

      // Build context for the request
      const systemContext = await this.buildContext(request)
      
      // Extract factual claims from content
      const claims = await this.extractFactualClaims(request.content, systemContext)
      
      // Verify claims using free search APIs
      const factCheckResults = await this.verifyFactualClaims(claims)
      
      // Detect conflicting information
      const conflicts = await this.detectConflictingInformation(factCheckResults)
      
      // Generate SEO suggestions
      const seoSuggestions = await this.generateSEOSuggestions(request.content, systemContext)
      
      // Create comprehensive response
      const response = await this.createFactCheckResponse(
        request,
        claims,
        factCheckResults,
        conflicts,
        seoSuggestions
      )

      const processingTime = Date.now() - startTime
      this.totalProcessingTime += processingTime

      logger.info(`Fact-checker agent completed request`, {
        processingTime,
        claimsFound: claims.length,
        claimsVerified: factCheckResults.length,
        conflictsDetected: conflicts.length,
        seoSuggestions: seoSuggestions.length,
        cacheHitRate: this.requestCount > 0 ? this.cacheHits / this.requestCount : 0,
      })

      return response

    } catch (error) {
      logger.error(`Fact-checker agent failed to process request:`, error)
      return this.createFallbackResponse(request, error)
    }
  }

  /**
   * Build system prompt for fact-checking tasks
   */
  buildSystemPrompt(context: AgentContext): string {
    let prompt = `You are an expert fact-checker and SEO optimization assistant. Your role is to:

1. **Identify Factual Claims**: Detect statements that can be verified or disputed
2. **Verify Information**: Research claims using reliable sources
3. **Provide Citations**: Include proper source attribution and links
4. **Detect Conflicts**: Identify contradictory or disputed information
5. **SEO Optimization**: Suggest improvements for search engine visibility

## Core Principles:
- Prioritize accuracy and credibility over speed
- Use multiple sources to verify important claims
- Clearly distinguish between facts, opinions, and interpretations
- Provide constructive suggestions for improvement
- Focus on cost-effective verification methods

## Source Evaluation:
- Government and educational sites (.gov, .edu) are highly credible
- Peer-reviewed publications and established news sources are reliable
- Wikipedia can be a starting point but verify with primary sources
- Be cautious with social media and opinion-based content

## Communication Style:
- Be thorough but concise in explanations
- Provide specific, actionable recommendations
- Include confidence levels for fact-check results
- Suggest alternative phrasings when claims are disputed`

    // Add user preferences
    if (context.userPreferences) {
      const experience = context.userPreferences.experienceLevel
      const personality = context.userPreferences.preferredAgentPersonality
      
      prompt += `\n\nUser Context:
- Experience Level: ${experience}
- Preferred Style: ${personality}
- Writing Genres: ${context.userPreferences.writingGenres.join(', ') || 'General'}`

      if (experience === 'BEGINNER') {
        prompt += `\n- Provide detailed explanations of fact-checking methodology
- Include educational resources about source evaluation
- Offer step-by-step guidance for verification`
      } else if (experience === 'ADVANCED') {
        prompt += `\n- Focus on nuanced analysis and edge cases
- Provide sophisticated SEO strategies
- Assume familiarity with research methodologies`
      }
    }

    // Add project context
    if (context.projectContent) {
      prompt += `\n\nProject Context:
The content is part of a larger writing project. Consider how fact-checking and SEO suggestions fit within the overall narrative and goals.`
    }

    return prompt
  }

  /**
   * Parse LLM response into structured agent response
   */
  parseResponse(llmResponse: LLMResponse): AgentResponse {
    const content = llmResponse.content
    const suggestions = this.extractSuggestionsFromResponse(content)
    const nextSteps = this.generateNextSteps(content)

    return {
      content,
      suggestions,
      metadata: {
        processingTime: Date.now(),
        tokenUsage: llmResponse.usage,
        model: llmResponse.model,
        confidence: this.calculateResponseConfidence(content),
        nextSteps,
      },
    }
  }

  /**
   * Extract factual claims from content using LLM analysis
   */
  private async extractFactualClaims(content: string, systemContext: string): Promise<FactualClaim[]> {
    try {
      const extractionPrompt = `Analyze the following content and identify factual claims that can be verified:

Content: "${content}"

For each factual claim, identify:
1. The specific statement that makes a factual assertion
2. The type of claim (statistic, historical, scientific, general)
3. How confident you are that this is a verifiable fact (0-1)
4. The surrounding context

Focus on:
- Specific numbers, dates, and statistics
- Historical events and claims
- Scientific assertions
- Definitive statements about people, places, or events

Ignore:
- Obvious opinions and subjective statements
- Common knowledge that doesn't need verification
- Hypothetical or speculative statements

Format your response as a structured list with clear claim identification.`

      const llmResponse = await this.makeLLMRequest(
        { content, userId: '', projectId: '', conversationId: '' } as AgentRequest,
        systemContext + '\n\n' + extractionPrompt,
        {
          model: 'gpt-3.5-turbo', // Cost-effective for extraction
          maxTokens: 800,
          temperature: 0.3, // Lower temperature for more consistent extraction
        }
      )

      return this.parseClaimsFromResponse(llmResponse.content, content)
    } catch (error) {
      logger.warn('LLM claim extraction failed, using fallback:', error)
      return this.extractClaimsWithHeuristics(content)
    }
  }

  /**
   * Parse claims from LLM response
   */
  private parseClaimsFromResponse(responseText: string, originalContent: string): FactualClaim[] {
    const claims: FactualClaim[] = []
    const lines = responseText.split('\n')
    let currentClaim: Partial<FactualClaim> | null = null

    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Look for claim indicators
      if (trimmedLine.match(/^\d+\./) || trimmedLine.includes('Claim:') || trimmedLine.includes('Statement:')) {
        // Save previous claim if exists
        if (currentClaim && currentClaim.text) {
          claims.push(this.completeClaim(currentClaim, originalContent))
        }
        
        // Start new claim
        currentClaim = {
          id: `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: this.extractClaimText(trimmedLine),
          confidence: 0.7, // Default confidence
        }
      } else if (currentClaim && trimmedLine.includes('Type:')) {
        currentClaim.type = this.parseClaimType(trimmedLine)
      } else if (currentClaim && trimmedLine.includes('Confidence:')) {
        currentClaim.confidence = this.parseConfidence(trimmedLine)
      }
    }

    // Add final claim
    if (currentClaim && currentClaim.text) {
      claims.push(this.completeClaim(currentClaim, originalContent))
    }

    return claims.slice(0, 10) // Limit to 10 claims to manage costs
  }

  /**
   * Extract claims using simple heuristics as fallback
   */
  private extractClaimsWithHeuristics(content: string): FactualClaim[] {
    const claims: FactualClaim[] = []
    const sentences = content.split(/[.!?]+/)

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (sentence.length < 10) continue

      // Look for patterns that suggest factual claims
      const hasNumbers = /\d+/.test(sentence)
      const hasPercentage = /%/.test(sentence)
      const hasDate = /\b(19|20)\d{2}\b/.test(sentence)
      const hasStatistic = /\b(study|research|survey|report|data)\b/i.test(sentence)
      const hasDefinitive = /\b(is|are|was|were|will be|according to)\b/i.test(sentence)

      if (hasNumbers || hasPercentage || hasDate || hasStatistic || hasDefinitive) {
        claims.push({
          id: `heuristic_claim_${i}`,
          text: sentence,
          type: this.classifyClaimType(sentence),
          confidence: this.calculateClaimConfidence(sentence),
          context: this.getContext(sentences, i),
          position: this.findPosition(content, sentence),
        })
      }
    }

    return claims.slice(0, 8) // Limit for cost management
  }

  /**
   * Verify factual claims using free search APIs
   */
  private async verifyFactualClaims(claims: FactualClaim[]): Promise<FactCheckResult[]> {
    const results: FactCheckResult[] = []

    for (const claim of claims) {
      try {
        // Check cache first
        const cacheKey = this.generateCacheKey(claim.text)
        const cachedResult = this.factCheckCache.get(cacheKey)
        
        if (cachedResult && this.isCacheValid(cachedResult)) {
          this.cacheHits++
          results.push(cachedResult)
          continue
        }

        // Search for information about the claim
        const searchResults = await this.searchForClaim(claim)
        
        // Analyze search results
        const factCheckResult = await this.analyzeSearchResults(claim, searchResults)
        
        // Cache the result
        this.factCheckCache.set(cacheKey, factCheckResult)
        results.push(factCheckResult)

        // Add delay to respect rate limits
        await this.delay(500)
        
      } catch (error) {
        logger.warn(`Failed to verify claim: ${claim.text}`, error)
        
        // Add unverified result
        results.push({
          claimId: claim.id,
          status: 'unverified',
          confidence: 0.1,
          sources: [],
          explanation: `Unable to verify this claim due to search limitations: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date(),
        })
      }
    }

    return results
  }

  /**
   * Search for information about a claim using free APIs
   */
  private async searchForClaim(claim: FactualClaim): Promise<(DuckDuckGoSearchResult | SerpAPIResult)[]> {
    const searchQuery = this.buildSearchQuery(claim)
    const results: (DuckDuckGoSearchResult | SerpAPIResult)[] = []

    try {
      // Try DuckDuckGo first (completely free)
      const duckDuckGoResults = await this.searchDuckDuckGo(searchQuery)
      results.push(...duckDuckGoResults)

      // If we have SerpAPI free tier credits, use them for additional results
      if (process.env.SERPAPI_KEY && results.length < 3) {
        const serpResults = await this.searchSerpAPI(searchQuery)
        results.push(...serpResults)
      }

    } catch (error) {
      logger.warn(`Search failed for claim: ${claim.text}`, error)
    }

    return results.slice(0, 5) // Limit results to manage processing time
  }

  /**
   * Search using DuckDuckGo (free)
   */
  private async searchDuckDuckGo(query: string): Promise<DuckDuckGoSearchResult[]> {
    try {
      // Note: DuckDuckGo doesn't have an official API, but we can use their instant answer API
      // For a production app, you'd want to use a proper search API or web scraping service
      
      // This is a simplified implementation - in practice, you'd use a service like:
      // - Brave Search API (free tier)
      // - Bing Web Search API (free tier)
      // - Or implement web scraping with proper rate limiting
      
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)
      
      if (!response || !response.ok) {
        throw new Error(`DuckDuckGo search failed: ${response?.status || 'No response'}`)
      }

      const data = await response.json()
      
      // Extract results from DuckDuckGo response
      const results: DuckDuckGoSearchResult[] = []
      
      // DuckDuckGo instant answers
      if (data.AbstractText) {
        results.push({
          title: data.Heading || 'DuckDuckGo Instant Answer',
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.AbstractText,
          domain: data.AbstractSource || 'duckduckgo.com',
        })
      }

      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              url: topic.FirstURL,
              snippet: topic.Text,
              domain: this.extractDomain(topic.FirstURL),
            })
          }
        }
      }

      return results
    } catch (error) {
      logger.warn('DuckDuckGo search failed:', error)
      return []
    }
  }

  /**
   * Search using SerpAPI (free tier)
   */
  private async searchSerpAPI(query: string): Promise<SerpAPIResult[]> {
    try {
      if (!process.env.SERPAPI_KEY) {
        return []
      }

      const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}&num=3`)
      
      if (!response.ok) {
        throw new Error(`SerpAPI search failed: ${response.status}`)
      }

      const data = await response.json()
      const results: SerpAPIResult[] = []

      if (data.organic_results) {
        for (const result of data.organic_results) {
          results.push({
            title: result.title,
            link: result.link,
            snippet: result.snippet || '',
            source: result.source || this.extractDomain(result.link),
            date: result.date,
          })
        }
      }

      return results
    } catch (error) {
      logger.warn('SerpAPI search failed:', error)
      return []
    }
  }

  /**
   * Analyze search results to determine fact-check status
   */
  private async analyzeSearchResults(
    claim: FactualClaim, 
    searchResults: (DuckDuckGoSearchResult | SerpAPIResult)[]
  ): Promise<FactCheckResult> {
    if (searchResults.length === 0) {
      return {
        claimId: claim.id,
        status: 'unverified',
        confidence: 0.1,
        sources: [],
        explanation: 'No reliable sources found to verify this claim.',
        lastChecked: new Date(),
      }
    }

    // Convert search results to source references
    const sources: SourceReference[] = searchResults.map((result, index) => ({
      id: `source_${claim.id}_${index}`,
      title: result.title,
      url: 'link' in result ? result.link : result.url,
      domain: 'domain' in result ? result.domain : this.extractDomain('link' in result ? result.link : result.url),
      credibilityScore: this.calculateCredibilityScore('domain' in result ? result.domain : this.extractDomain('link' in result ? result.link : result.url)),
      relevanceScore: this.calculateRelevanceScore(claim.text, result.snippet),
      snippet: result.snippet,
      publishDate: 'date' in result && result.date ? new Date(result.date) : undefined,
    }))

    // Use LLM to analyze the sources and determine verification status
    try {
      const analysisResult = await this.analyzeSources(claim, sources)
      return {
        claimId: claim.id,
        ...analysisResult,
        sources,
        lastChecked: new Date(),
      }
    } catch (error) {
      logger.warn('LLM source analysis failed, using heuristic analysis:', error)
      return this.analyzeSourcesHeuristically(claim, sources)
    }
  }

  /**
   * Use LLM to analyze sources and determine verification status
   */
  private async analyzeSources(claim: FactualClaim, sources: SourceReference[]): Promise<{
    status: FactCheckResult['status']
    confidence: number
    explanation: string
    alternatives?: string[]
  }> {
    const analysisPrompt = `Analyze the following claim against the provided sources:

Claim: "${claim.text}"

Sources:
${sources.map((source, i) => `${i + 1}. ${source.title} (${source.domain})
   Credibility: ${source.credibilityScore.toFixed(2)}
   Snippet: "${source.snippet}"`).join('\n\n')}

Based on these sources, determine:
1. Verification status: verified, disputed, unverified, false, or misleading
2. Confidence level (0-1) in your assessment
3. Clear explanation of your reasoning
4. Alternative phrasings if the claim is inaccurate

Consider:
- Source credibility and reputation
- Consistency across multiple sources
- Recency of information
- Context and nuance in the claim

Provide a structured analysis.`

    const llmResponse = await this.makeLLMRequest(
      { content: claim.text, userId: '', projectId: '', conversationId: '' } as AgentRequest,
      analysisPrompt,
      {
        model: 'gpt-3.5-turbo',
        maxTokens: 600,
        temperature: 0.2, // Low temperature for consistent analysis
      }
    )

    return this.parseAnalysisResponse(llmResponse.content)
  }

  /**
   * Parse LLM analysis response
   */
  private parseAnalysisResponse(responseText: string): {
    status: FactCheckResult['status']
    confidence: number
    explanation: string
    alternatives?: string[]
  } {
    const lowerText = responseText.toLowerCase()
    
    // Determine status
    let status: FactCheckResult['status'] = 'unverified'
    if (lowerText.includes('verified') && !lowerText.includes('unverified')) {
      status = 'verified'
    } else if (lowerText.includes('false')) {
      status = 'false'
    } else if (lowerText.includes('disputed')) {
      status = 'disputed'
    } else if (lowerText.includes('misleading')) {
      status = 'misleading'
    }

    // Extract confidence
    const confidenceMatch = responseText.match(/confidence[:\s]*([0-9.]+)/i)
    const confidence = confidenceMatch ? Math.min(Math.max(parseFloat(confidenceMatch[1]), 0), 1) : 0.5

    // Extract explanation
    const explanationMatch = responseText.match(/explanation[:\s]*(.+?)(?:\n\n|\n[A-Z]|$)/is)
    const explanation = explanationMatch ? explanationMatch[1].trim() : responseText.substring(0, 200)

    // Extract alternatives
    const alternativesMatch = responseText.match(/alternative[s]?[:\s]*(.+?)(?:\n\n|\n[A-Z]|$)/is)
    const alternatives = alternativesMatch ? 
      alternativesMatch[1].split(/[,\n]/).map(alt => alt.trim()).filter(alt => alt.length > 0) : 
      undefined

    return { status, confidence, explanation, alternatives }
  }

  /**
   * Analyze sources using heuristics as fallback
   */
  private analyzeSourcesHeuristically(claim: FactualClaim, sources: SourceReference[]): FactCheckResult {
    const highCredibilitySources = sources.filter(s => s.credibilityScore > 0.7)
    const averageCredibility = sources.reduce((sum, s) => sum + s.credibilityScore, 0) / sources.length
    const averageRelevance = sources.reduce((sum, s) => sum + s.relevanceScore, 0) / sources.length

    let status: FactCheckResult['status'] = 'unverified'
    let confidence = 0.3
    let explanation = 'Limited verification possible with available sources.'

    if (highCredibilitySources.length >= 2 && averageRelevance > 0.6) {
      status = 'verified'
      confidence = Math.min(averageCredibility * averageRelevance, 0.8)
      explanation = `Claim appears to be supported by ${highCredibilitySources.length} credible sources.`
    } else if (averageCredibility > 0.5 && averageRelevance > 0.4) {
      status = 'unverified'
      confidence = 0.5
      explanation = 'Some supporting information found, but verification is incomplete.'
    }

    return {
      claimId: claim.id,
      status,
      confidence,
      sources,
      explanation,
      lastChecked: new Date(),
    }
  }

  /**
   * Detect conflicting information across fact-check results
   */
  private async detectConflictingInformation(factCheckResults: FactCheckResult[]): Promise<ConflictingInformation[]> {
    const conflicts: ConflictingInformation[] = []

    // Look for disputed or false claims
    const problematicResults = factCheckResults.filter(result => 
      result.status === 'disputed' || result.status === 'false' || result.status === 'misleading'
    )

    for (const result of problematicResults) {
      const conflictingSources = result.sources.filter(source => 
        source.credibilityScore > 0.6 && source.relevanceScore > 0.5
      )

      if (conflictingSources.length > 0) {
        conflicts.push({
          claimId: result.claimId,
          conflictType: result.status === 'false' ? 'contradictory' : 'disputed',
          sources: conflictingSources,
          explanation: result.explanation,
          recommendation: this.generateConflictRecommendation(result),
        })
      }
    }

    return conflicts
  }

  /**
   * Generate SEO suggestions for the content
   */
  private async generateSEOSuggestions(content: string, systemContext: string): Promise<SEOSuggestion[]> {
    try {
      const seoPrompt = `Analyze this content for SEO optimization opportunities:

Content: "${content}"

Provide specific, actionable SEO suggestions including:
1. Internal linking opportunities (connections to related topics)
2. External linking to authoritative sources
3. Keyword optimization suggestions
4. Content structure improvements
5. Meta description and title suggestions

Focus on:
- Free and cost-effective SEO strategies
- Authoritative external sources to link to
- Natural keyword integration
- Content structure for better readability
- Opportunities for topic clusters and internal linking

Provide practical, implementable suggestions.`

      const llmResponse = await this.makeLLMRequest(
        { content, userId: '', projectId: '', conversationId: '' } as AgentRequest,
        systemContext + '\n\n' + seoPrompt,
        {
          model: 'gpt-3.5-turbo',
          maxTokens: 800,
          temperature: 0.4,
        }
      )

      return this.parseSEOSuggestions(llmResponse.content)
    } catch (error) {
      logger.warn('LLM SEO analysis failed, using fallback suggestions:', error)
      return this.generateFallbackSEOSuggestions(content)
    }
  }

  /**
   * Parse SEO suggestions from LLM response
   */
  private parseSEOSuggestions(responseText: string): SEOSuggestion[] {
    const suggestions: SEOSuggestion[] = []
    const lines = responseText.split('\n')

    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (trimmedLine.includes('link') && (trimmedLine.includes('http') || trimmedLine.includes('www'))) {
        suggestions.push({
          type: 'external_link',
          title: 'Add External Link',
          description: trimmedLine,
          implementation: 'Add the suggested link to relevant content',
          priority: 'medium',
          estimatedImpact: 'Improved authority and user value',
        })
      } else if (trimmedLine.includes('keyword') || trimmedLine.includes('optimize')) {
        suggestions.push({
          type: 'keyword',
          title: 'Keyword Optimization',
          description: trimmedLine,
          implementation: 'Integrate suggested keywords naturally',
          priority: 'high',
          estimatedImpact: 'Better search visibility',
        })
      } else if (trimmedLine.includes('structure') || trimmedLine.includes('heading')) {
        suggestions.push({
          type: 'structure',
          title: 'Content Structure',
          description: trimmedLine,
          implementation: 'Reorganize content as suggested',
          priority: 'medium',
          estimatedImpact: 'Improved readability and SEO',
        })
      }
    }

    return suggestions.slice(0, 8) // Limit suggestions
  }

  /**
   * Generate fallback SEO suggestions
   */
  private generateFallbackSEOSuggestions(content: string): SEOSuggestion[] {
    const suggestions: SEOSuggestion[] = []

    // Basic SEO suggestions based on content analysis
    if (content.length > 1000) {
      suggestions.push({
        type: 'structure',
        title: 'Add Subheadings',
        description: 'Break up long content with descriptive subheadings',
        implementation: 'Add H2 and H3 tags to organize content sections',
        priority: 'high',
        estimatedImpact: 'Improved readability and SEO structure',
      })
    }

    suggestions.push({
      type: 'external_link',
      title: 'Link to Authoritative Sources',
      description: 'Add links to credible sources like Wikipedia, government sites, or academic institutions',
      implementation: 'Research and add 2-3 relevant external links',
      priority: 'medium',
      estimatedImpact: 'Increased content authority and user trust',
    })

    suggestions.push({
      type: 'internal_link',
      title: 'Create Internal Links',
      description: 'Link to related content within your site',
      implementation: 'Identify related topics and create internal links',
      priority: 'medium',
      estimatedImpact: 'Better site navigation and SEO',
    })

    return suggestions
  }

  // Helper methods
  private extractClaimText(line: string): string {
    return line.replace(/^\d+\.\s*/, '').replace(/^(Claim|Statement):\s*/i, '').trim()
  }

  private parseClaimType(line: string): FactualClaim['type'] {
    const lowerLine = line.toLowerCase()
    if (lowerLine.includes('statistic')) return 'statistic'
    if (lowerLine.includes('historical')) return 'historical'
    if (lowerLine.includes('scientific')) return 'scientific'
    if (lowerLine.includes('opinion')) return 'opinion'
    return 'general'
  }

  private parseConfidence(line: string): number {
    const match = line.match(/([0-9.]+)/)
    return match ? Math.min(Math.max(parseFloat(match[1]), 0), 1) : 0.5
  }

  private completeClaim(partialClaim: Partial<FactualClaim>, content: string): FactualClaim {
    return {
      id: partialClaim.id || `claim_${Date.now()}`,
      text: partialClaim.text || '',
      type: partialClaim.type || 'general',
      confidence: partialClaim.confidence || 0.5,
      context: partialClaim.context || '',
      position: partialClaim.position || this.findPosition(content, partialClaim.text || ''),
    }
  }

  private classifyClaimType(sentence: string): FactualClaim['type'] {
    const lowerSentence = sentence.toLowerCase()
    if (/\d+%|\d+\.\d+/.test(sentence)) return 'statistic'
    if (/\b(19|20)\d{2}\b/.test(sentence)) return 'historical'
    if (/\b(study|research|scientific|experiment)\b/i.test(sentence)) return 'scientific'
    return 'general'
  }

  private calculateClaimConfidence(sentence: string): number {
    let confidence = 0.5
    if (/\d+/.test(sentence)) confidence += 0.2
    if (/\b(study|research|according to)\b/i.test(sentence)) confidence += 0.2
    if (/\b(is|are|was|were)\b/i.test(sentence)) confidence += 0.1
    return Math.min(confidence, 1.0)
  }

  private getContext(sentences: string[], index: number): string {
    const start = Math.max(0, index - 1)
    const end = Math.min(sentences.length, index + 2)
    return sentences.slice(start, end).join('. ')
  }

  private findPosition(content: string, text: string): { start: number; end: number } {
    const start = content.indexOf(text)
    return {
      start: start >= 0 ? start : 0,
      end: start >= 0 ? start + text.length : text.length,
    }
  }

  private buildSearchQuery(claim: FactualClaim): string {
    // Extract key terms from the claim
    const text = claim.text.toLowerCase()
    const words = text.split(/\s+/).filter(word => 
      word.length > 3 && 
      !['the', 'and', 'but', 'for', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should'].includes(word)
    )
    
    return words.slice(0, 5).join(' ')
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  private calculateCredibilityScore(domain: string): number {
    // Check exact matches first
    if (this.trustedDomains.has(domain)) {
      return this.trustedDomains.get(domain)!
    }

    // Check for domain patterns
    if (domain.endsWith('.gov')) return 0.9
    if (domain.endsWith('.edu')) return 0.85
    if (domain.endsWith('.org')) return 0.7

    // Check cached scores
    if (this.sourceCredibilityCache.has(domain)) {
      return this.sourceCredibilityCache.get(domain)!
    }

    // Default score for unknown domains
    const defaultScore = 0.5
    this.sourceCredibilityCache.set(domain, defaultScore)
    return defaultScore
  }

  private calculateRelevanceScore(claimText: string, snippet: string): number {
    const claimWords = claimText.toLowerCase().split(/\s+/)
    const snippetWords = snippet.toLowerCase().split(/\s+/)
    
    const commonWords = claimWords.filter(word => 
      word.length > 3 && snippetWords.includes(word)
    )
    
    return Math.min(commonWords.length / Math.max(claimWords.length, 1), 1.0)
  }

  private generateCacheKey(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50)
  }

  private isCacheValid(result: FactCheckResult): boolean {
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    return Date.now() - result.lastChecked.getTime() < maxAge
  }

  private generateConflictRecommendation(result: FactCheckResult): string {
    switch (result.status) {
      case 'false':
        return 'Consider removing or correcting this claim based on the evidence found.'
      case 'disputed':
        return 'Add context or qualifiers to acknowledge the disputed nature of this claim.'
      case 'misleading':
        return 'Rephrase this claim to be more accurate or provide additional context.'
      default:
        return 'Review the sources and consider revising this claim for accuracy.'
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private extractSuggestionsFromResponse(responseText: string): Suggestion[] {
    const suggestions: Suggestion[] = []
    const lines = responseText.split('\n')

    for (const line of lines) {
      if (line.includes('suggest') || line.includes('recommend') || line.includes('consider')) {
        suggestions.push(this.createSuggestion(
          'improvement',
          'Content Enhancement',
          line.trim(),
          'medium'
        ))
      }
    }

    return suggestions.slice(0, 5)
  }

  private generateNextSteps(content: string): string[] {
    const steps = [
      'Review fact-check results and update content as needed',
      'Add citations and links to credible sources',
      'Implement SEO suggestions for better visibility',
    ]

    if (content.toLowerCase().includes('disputed') || content.toLowerCase().includes('false')) {
      steps.unshift('Address disputed or false claims immediately')
    }

    return steps
  }

  private calculateResponseConfidence(content: string): number {
    let confidence = 0.7
    
    if (content.includes('verified') || content.includes('confirmed')) confidence += 0.1
    if (content.includes('sources') || content.includes('citations')) confidence += 0.1
    if (content.length > 500) confidence += 0.05
    
    return Math.min(confidence, 1.0)
  }

  /**
   * Create comprehensive fact-check response
   */
  private async createFactCheckResponse(
    request: AgentRequest,
    claims: FactualClaim[],
    factCheckResults: FactCheckResult[],
    conflicts: ConflictingInformation[],
    seoSuggestions: SEOSuggestion[]
  ): Promise<AgentResponse> {
    let responseContent = `I've analyzed your content for factual accuracy and SEO optimization. Here's what I found:\n\n`

    // Fact-checking results
    if (claims.length > 0) {
      responseContent += `## Fact-Check Results (${claims.length} claims analyzed)\n\n`
      
      for (const result of factCheckResults) {
        const claim = claims.find(c => c.id === result.claimId)
        if (!claim) continue

        const statusEmoji = {
          'verified': '✅',
          'disputed': '⚠️',
          'unverified': '❓',
          'false': '❌',
          'misleading': '⚠️'
        }[result.status] || '❓'

        responseContent += `${statusEmoji} **${result.status.toUpperCase()}** (${Math.round(result.confidence * 100)}% confidence)\n`
        responseContent += `   Claim: "${claim.text}"\n`
        responseContent += `   ${result.explanation}\n`
        
        if (result.sources.length > 0) {
          responseContent += `   Sources: ${result.sources.slice(0, 2).map(s => `[${s.title}](${s.url})`).join(', ')}\n`
        }
        
        if (result.alternatives && result.alternatives.length > 0) {
          responseContent += `   Suggested revision: "${result.alternatives[0]}"\n`
        }
        responseContent += '\n'
      }
    } else {
      responseContent += `## Fact-Check Results\n\nNo specific factual claims requiring verification were identified in your content.\n\n`
    }

    // Conflicting information
    if (conflicts.length > 0) {
      responseContent += `## ⚠️ Conflicting Information Detected\n\n`
      
      for (const conflict of conflicts) {
        responseContent += `**${conflict.conflictType.replace('_', ' ').toUpperCase()}**\n`
        responseContent += `${conflict.explanation}\n`
        responseContent += `**Recommendation:** ${conflict.recommendation}\n\n`
      }
    }

    // SEO suggestions
    if (seoSuggestions.length > 0) {
      responseContent += `## SEO Optimization Suggestions\n\n`
      
      const groupedSuggestions = seoSuggestions.reduce((acc, suggestion) => {
        if (!acc[suggestion.type]) acc[suggestion.type] = []
        acc[suggestion.type].push(suggestion)
        return acc
      }, {} as Record<string, SEOSuggestion[]>)

      Object.entries(groupedSuggestions).forEach(([type, suggestions]) => {
        const typeTitle = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        responseContent += `### ${typeTitle}\n`
        
        suggestions.forEach((suggestion, index) => {
          const priorityEmoji = suggestion.priority === 'high' ? '🔴' : suggestion.priority === 'medium' ? '🟡' : '🟢'
          responseContent += `${index + 1}. ${priorityEmoji} **${suggestion.title}**\n`
          responseContent += `   ${suggestion.description}\n`
          responseContent += `   Implementation: ${suggestion.implementation}\n`
          responseContent += `   Expected impact: ${suggestion.estimatedImpact}\n\n`
        })
      })
    }

    // Summary and recommendations
    responseContent += `## Summary\n\n`
    responseContent += `- **Claims analyzed:** ${claims.length}\n`
    responseContent += `- **Verified claims:** ${factCheckResults.filter(r => r.status === 'verified').length}\n`
    responseContent += `- **Issues found:** ${factCheckResults.filter(r => r.status === 'false' || r.status === 'disputed').length}\n`
    responseContent += `- **SEO suggestions:** ${seoSuggestions.length}\n`
    responseContent += `- **Conflicts detected:** ${conflicts.length}\n\n`

    if (conflicts.length > 0) {
      responseContent += `**Priority:** Address conflicting information before publication.\n`
    } else if (factCheckResults.some(r => r.status === 'verified')) {
      responseContent += `**Status:** Content appears factually sound with good verification.\n`
    }

    // Create suggestions
    const suggestions: Suggestion[] = []

    // Add fact-checking suggestions
    if (factCheckResults.some(r => r.status === 'false' || r.status === 'disputed')) {
      suggestions.push(this.createSuggestion(
        'action',
        'Address Disputed Claims',
        'Review and correct claims marked as false or disputed',
        'high'
      ))
    }

    // Add SEO suggestions
    const highPrioritySEO = seoSuggestions.filter(s => s.priority === 'high')
    if (highPrioritySEO.length > 0) {
      suggestions.push(this.createSuggestion(
        'improvement',
        'Implement High-Priority SEO',
        `Focus on ${highPrioritySEO.length} high-priority SEO improvements`,
        'high'
      ))
    }

    // Add source citation suggestion
    if (factCheckResults.some(r => r.sources.length > 0)) {
      suggestions.push(this.createSuggestion(
        'action',
        'Add Source Citations',
        'Include citations and links to the credible sources found',
        'medium'
      ))
    }

    return {
      content: responseContent,
      suggestions,
      metadata: {
        processingTime: 0, // Will be set by caller
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0
        },
        model: 'factchecker-agent',
        confidence: 0.8,
        nextSteps: [
          'Review all fact-check results carefully',
          'Update content based on verification findings',
          'Add citations and source links',
          'Implement high-priority SEO suggestions',
          'Re-run fact-check after making changes'
        ]
      },
      phaseOutputs: [{
        type: 'FACT_CHECK_RESULTS',
        content: JSON.stringify({
          claims,
          factCheckResults,
          conflicts,
          seoSuggestions
        }),
        metadata: {
          claimsAnalyzed: claims.length,
          claimsVerified: factCheckResults.filter(r => r.status === 'verified').length,
          issuesFound: conflicts.length,
          seoSuggestions: seoSuggestions.length
        }
      }]
    }
  }

  /**
   * Create fallback response when processing fails
   */
  private createFallbackResponse(request: AgentRequest, error: any): AgentResponse {
    const content = `I encountered an issue while fact-checking your content, but I can still provide some general guidance:

## Manual Fact-Checking Guidelines

### Verify Claims Yourself
1. **Identify factual statements** - Look for specific numbers, dates, and definitive claims
2. **Check multiple sources** - Use at least 2-3 credible sources for verification
3. **Evaluate source credibility** - Prefer .gov, .edu, established news, and academic sources
4. **Look for recent information** - Ensure data and claims are current

### Recommended Fact-Checking Resources
- **Wikipedia** - Good starting point, but verify with primary sources
- **Government websites** (.gov domains) - Highly credible for official data
- **Academic institutions** (.edu domains) - Reliable for research and studies
- **Established news sources** - Reuters, AP, BBC for current events
- **Specialized databases** - PubMed for medical, JSTOR for academic research

### SEO Best Practices
- **Add external links** to authoritative sources (2-3 per article)
- **Use descriptive headings** to structure your content
- **Include internal links** to related content on your site
- **Optimize for readability** with short paragraphs and bullet points
- **Add alt text** to any images you include

### Red Flags to Watch For
- Claims without sources or citations
- Statistics that seem too precise or convenient
- Information that contradicts well-established facts
- Sources with obvious bias or agenda
- Outdated information presented as current

Error details: ${error instanceof Error ? error.message : 'Unknown error'}`

    return {
      content,
      suggestions: [
        this.createSuggestion(
          'action',
          'Manual fact-checking',
          'Verify key claims using the recommended resources',
          'high'
        ),
        this.createSuggestion(
          'resource',
          'Use credible sources',
          'Focus on .gov, .edu, and established news sources',
          'high'
        ),
        this.createSuggestion(
          'improvement',
          'Add citations',
          'Include links to sources for all factual claims',
          'medium'
        ),
        this.createSuggestion(
          'action',
          'Retry fact-checking',
          'Try the automated fact-checking again after reviewing content',
          'low'
        )
      ],
      metadata: {
        processingTime: 0,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0
        },
        model: 'fallback',
        confidence: 0.3
      }
    }
  }

  // Protected method implementations
  protected async performInitialization(): Promise<void> {
    logger.info('Initializing Fact-Checker agent')
    this.factCheckCache.clear()
    this.sourceCredibilityCache.clear()
  }

  protected async performCleanup(): Promise<void> {
    logger.info('Cleaning up Fact-Checker agent')
    this.factCheckCache.clear()
    this.sourceCredibilityCache.clear()
  }

  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Test a simple search to ensure APIs are working
      const testResults = await this.searchDuckDuckGo('test query')
      return this.initialized && Array.isArray(testResults)
    } catch {
      return false
    }
  }

  protected async getSpecificMetrics(): Promise<Record<string, any>> {
    return {
      requestCount: this.requestCount,
      averageProcessingTime: this.requestCount > 0 ? this.totalProcessingTime / this.requestCount : 0,
      cacheSize: this.factCheckCache.size,
      cacheHitRate: this.requestCount > 0 ? this.cacheHits / this.requestCount : 0,
      trustedDomainsCount: this.trustedDomains.size,
      credibilityCacheSize: this.sourceCredibilityCache.size,
    }
  }
}