import { BaseAgent, AgentCapabilities, AgentRequest, AgentResponse, AgentContext } from './base-agent.js'
import { LLMService, LLMResponse } from '../llm.js'
import { MediaService, MediaServiceConfig } from '../media/media-service.js'
import { MediaRequest, MediaResult, MediaServiceError } from '../media/types.js'
import { logger } from '../../utils/logger.js'
import path from 'path'

export class MediaAgent extends BaseAgent {
  private mediaService: MediaService
  private requestCount: number = 0
  private totalProcessingTime: number = 0
  private errorCount: number = 0

  constructor(capabilities: AgentCapabilities, llmService: LLMService) {
    super('MEDIA', capabilities, llmService)
    
    // Initialize media service with cost-effective configuration
    const mediaConfig: MediaServiceConfig = {
      storage: {
        basePath: path.join(process.cwd(), 'storage', 'media'),
        maxFileSize: 5 * 1024 * 1024, // 5MB limit
        compressionQuality: 80 // Good balance of quality vs size
      },
      apis: {
        pexelsApiKey: process.env.PEXELS_API_KEY,
        pixabayApiKey: process.env.PIXABAY_API_KEY
      },
      limits: {
        maxDataPoints: 100,
        maxImagesPerRequest: 5,
        maxMemesPerRequest: 3
      }
    }

    this.mediaService = new MediaService(mediaConfig)
  }

  /**
   * Process media generation request
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()
    this.requestCount++

    try {
      // Validate request
      const isValid = await this.validateRequest(request)
      if (!isValid) {
        throw new Error('Invalid media agent request')
      }

      // Build context for LLM
      const systemContext = await this.buildContext(request)

      // Analyze content to determine media needs
      const mediaAnalysis = await this.analyzeContentForMedia(request, systemContext)

      // Generate media based on analysis
      const mediaResults = await this.generateMedia(mediaAnalysis, request)

      // Create response with media suggestions
      const response = await this.createMediaResponse(mediaResults, mediaAnalysis, request)

      // Update metrics
      this.totalProcessingTime += Date.now() - startTime

      return response
    } catch (error) {
      this.errorCount++
      logger.error('Media agent processing failed:', error)
      
      // Return fallback response
      return this.createFallbackResponse(request, error)
    }
  }

  /**
   * Build system prompt for media agent
   */
  buildSystemPrompt(context: AgentContext): string {
    return `You are a creative media assistant specializing in visual content creation for written content. Your role is to:

1. **Analyze Content**: Identify opportunities for visual enhancement in text
2. **Suggest Media Types**: Recommend appropriate images, memes, or charts
3. **Generate Concepts**: Create specific ideas for visual content
4. **Provide Alternatives**: Offer multiple options for each media suggestion

## Your Capabilities:
- **Image Sourcing**: Find relevant stock photos and illustrations
- **Meme Creation**: Generate engaging memes using popular templates
- **Chart Generation**: Create data visualizations from structured information
- **Visual Storytelling**: Enhance narrative with appropriate visuals

## Guidelines:
- Prioritize free and cost-effective media sources
- Ensure all suggestions are appropriate and family-friendly
- Focus on enhancing the content's message and engagement
- Provide specific, actionable recommendations
- Consider the target audience and content context

## Response Format:
- Explain why specific media would enhance the content
- Provide concrete suggestions with descriptions
- Include alternative options for flexibility
- Mention any data or information needed for charts

Current user preferences: ${context.userPreferences?.preferredAgentPersonality || 'helpful'}
Writing experience level: ${context.userPreferences?.experienceLevel || 'INTERMEDIATE'}
Content context: ${context.projectContent ? 'Available' : 'Not provided'}`
  }

  /**
   * Parse LLM response into structured format
   */
  parseResponse(llmResponse: LLMResponse): AgentResponse {
    const suggestions = this.extractSuggestionsFromResponse(llmResponse.content)
    
    return {
      content: llmResponse.content,
      suggestions,
      metadata: {
        processingTime: Date.now() - Date.now(), // Will be set by caller
        tokenUsage: llmResponse.usage,
        model: llmResponse.model,
        confidence: 0.8, // Media suggestions are generally reliable
        nextSteps: [
          'Review suggested media options',
          'Select preferred visual content',
          'Integrate media into your content',
          'Consider additional visual enhancements'
        ]
      }
    }
  }

  /**
   * Analyze content to determine media needs
   */
  private async analyzeContentForMedia(
    request: AgentRequest, 
    systemContext: string
  ): Promise<MediaAnalysis> {
    try {
      // Use LLM to analyze content for media opportunities
      const analysisPrompt = `Analyze this content for visual enhancement opportunities:

Content: "${request.content}"

Identify:
1. What type of media would enhance this content (image, meme, chart)?
2. Specific concepts or data that could be visualized
3. Where in the content media should be placed
4. What mood or style would be appropriate

Respond with a structured analysis.`

      const llmResponse = await this.makeLLMRequest(
        request,
        systemContext,
        {
          model: 'gpt-3.5-turbo', // Cost-effective for analysis
          maxTokens: 500,
          temperature: 0.7
        }
      )

      return this.parseMediaAnalysis(llmResponse.content, request.content)
    } catch (error) {
      logger.warn('LLM media analysis failed, using fallback:', error)
      return this.createFallbackAnalysis(request.content)
    }
  }

  /**
   * Parse media analysis from LLM response
   */
  private parseMediaAnalysis(analysisText: string, originalContent: string): MediaAnalysis {
    const analysis: MediaAnalysis = {
      recommendedTypes: [],
      concepts: [],
      placement: 'inline',
      style: 'professional'
    }

    const lowerText = analysisText.toLowerCase()

    // Detect recommended media types
    if (lowerText.includes('image') || lowerText.includes('photo') || lowerText.includes('picture')) {
      analysis.recommendedTypes.push('image')
    }
    if (lowerText.includes('meme') || lowerText.includes('funny') || lowerText.includes('humor')) {
      analysis.recommendedTypes.push('meme')
    }
    if (lowerText.includes('chart') || lowerText.includes('graph') || lowerText.includes('data') || lowerText.includes('statistic')) {
      analysis.recommendedTypes.push('chart')
    }

    // Extract concepts (simple keyword extraction)
    const sentences = analysisText.split(/[.!?]+/)
    analysis.concepts = sentences
      .filter(s => s.length > 10 && s.length < 100)
      .slice(0, 3)
      .map(s => s.trim())

    // Determine style
    if (lowerText.includes('casual') || lowerText.includes('fun') || lowerText.includes('playful')) {
      analysis.style = 'casual'
    } else if (lowerText.includes('serious') || lowerText.includes('formal') || lowerText.includes('business')) {
      analysis.style = 'professional'
    }

    // If no types detected, make educated guess based on content
    if (analysis.recommendedTypes.length === 0) {
      if (this.hasStructuredData(originalContent)) {
        analysis.recommendedTypes.push('chart')
      } else if (this.isHumorousContent(originalContent)) {
        analysis.recommendedTypes.push('meme')
      } else {
        analysis.recommendedTypes.push('image')
      }
    }

    return analysis
  }

  /**
   * Create fallback analysis when LLM fails
   */
  private createFallbackAnalysis(content: string): MediaAnalysis {
    const analysis: MediaAnalysis = {
      recommendedTypes: ['image'],
      concepts: [content.substring(0, 100)],
      placement: 'inline',
      style: 'professional'
    }

    // Simple heuristics
    if (this.hasStructuredData(content)) {
      analysis.recommendedTypes.unshift('chart')
    }
    if (this.isHumorousContent(content)) {
      analysis.recommendedTypes.push('meme')
    }

    return analysis
  }

  /**
   * Generate media based on analysis
   */
  private async generateMedia(
    analysis: MediaAnalysis, 
    request: AgentRequest
  ): Promise<MediaResult[]> {
    const allResults: MediaResult[] = []

    for (const mediaType of analysis.recommendedTypes) {
      try {
        const mediaRequest: MediaRequest = {
          type: mediaType as 'image' | 'meme' | 'chart',
          content: request.content,
          context: request.context?.projectContent,
          options: this.createMediaOptions(mediaType, analysis)
        }

        const results = await this.mediaService.processMediaRequest(mediaRequest)
        allResults.push(...results)
      } catch (error) {
        logger.warn(`Failed to generate ${mediaType}:`, error)
        
        // Add fallback suggestion
        allResults.push(this.createFallbackMediaResult(mediaType as any, error))
      }
    }

    return allResults
  }

  /**
   * Create media options based on analysis
   */
  private createMediaOptions(mediaType: string, analysis: MediaAnalysis): any {
    const options: any = {}

    switch (mediaType) {
      case 'image':
        options.imageStyle = analysis.style === 'professional' ? 'photo' : 'illustration'
        options.imageOrientation = 'landscape'
        if (analysis.concepts.length > 0) {
          options.imageQuery = analysis.concepts[0]
        }
        break

      case 'meme':
        // Meme options will be determined by the meme service
        break

      case 'chart':
        options.chartType = 'bar' // Default, will be auto-detected
        if (analysis.concepts.length > 0) {
          options.chartTitle = analysis.concepts[0]
        }
        break
    }

    return options
  }

  /**
   * Create response with media suggestions
   */
  private async createMediaResponse(
    mediaResults: MediaResult[],
    analysis: MediaAnalysis,
    request: AgentRequest
  ): Promise<AgentResponse> {
    let responseContent = `I've analyzed your content and found several opportunities for visual enhancement:\n\n`

    // Group results by type
    const resultsByType = mediaResults.reduce((acc, result) => {
      if (!acc[result.type]) acc[result.type] = []
      acc[result.type].push(result)
      return acc
    }, {} as Record<string, MediaResult[]>)

    // Generate response for each media type
    Object.entries(resultsByType).forEach(([type, results]) => {
      responseContent += `## ${type.charAt(0).toUpperCase() + type.slice(1)} Suggestions\n\n`
      
      results.forEach((result, index) => {
        responseContent += `${index + 1}. **${result.metadata.description || 'Media suggestion'}**\n`
        responseContent += `   - URL: ${result.url}\n`
        if (result.metadata.attribution) {
          responseContent += `   - Attribution: ${result.metadata.attribution}\n`
        }
        responseContent += `   - Alt text: ${result.metadata.alt}\n\n`
      })
    })

    // Add general recommendations
    responseContent += `## Recommendations\n\n`
    responseContent += `- **Placement**: Consider adding visuals ${analysis.placement === 'header' ? 'at the beginning' : 'throughout the content'}\n`
    responseContent += `- **Style**: The ${analysis.style} style would work well for your content\n`
    responseContent += `- **Accessibility**: Always include descriptive alt text for images\n`

    // Create suggestions from media results
    const suggestions = mediaResults.flatMap(result => 
      result.suggestions?.map(suggestion => ({
        ...suggestion,
        id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })) || []
    )

    // Add general media suggestions
    suggestions.push(
      this.createSuggestion(
        'action',
        'Download and optimize images',
        'Download selected images and optimize them for web use',
        'medium',
        { action: 'optimize_images' }
      ),
      this.createSuggestion(
        'improvement',
        'Add more visual variety',
        'Consider mixing different types of media for better engagement',
        'low',
        { suggestion: 'variety' }
      )
    )

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
        model: 'media-agent',
        confidence: 0.85,
        nextSteps: [
          'Review suggested media options',
          'Select and download preferred visuals',
          'Integrate media into your content',
          'Test visual layout and accessibility'
        ]
      },
      phaseOutputs: [{
        type: 'MEDIA_SUGGESTIONS',
        content: JSON.stringify(mediaResults),
        metadata: {
          mediaCount: mediaResults.length,
          types: Object.keys(resultsByType),
          analysisStyle: analysis.style
        }
      }]
    }
  }

  /**
   * Create fallback response when processing fails
   */
  private createFallbackResponse(request: AgentRequest, error: any): AgentResponse {
    const content = `I encountered an issue while generating media suggestions, but I can still help you enhance your content visually:

## Manual Media Suggestions

### Images
- Search for relevant stock photos on Unsplash (https://unsplash.com)
- Consider Pixabay for free illustrations (https://pixabay.com)
- Use Pexels for high-quality photos (https://pexels.com)

### Charts and Data Visualization
- Create charts with QuickChart (https://quickchart.io)
- Use Google Charts for interactive visualizations
- Consider Canva for infographic-style charts

### Memes and Engaging Content
- Use Imgflip meme generator (https://imgflip.com/memegenerator)
- Create custom memes with popular templates
- Ensure memes are appropriate for your audience

## Tips for Visual Content
- Always include alt text for accessibility
- Optimize images for web (compress to reduce file size)
- Ensure visuals support and enhance your message
- Consider your audience when choosing visual style

Error details: ${error instanceof Error ? error.message : 'Unknown error'}`

    return {
      content,
      suggestions: [
        this.createSuggestion(
          'resource',
          'Free stock photo sites',
          'Use free resources like Unsplash, Pixabay, and Pexels',
          'high'
        ),
        this.createSuggestion(
          'resource',
          'Chart creation tools',
          'Create charts with QuickChart or Google Charts',
          'medium'
        ),
        this.createSuggestion(
          'action',
          'Retry media generation',
          'Try the media generation again after checking your content',
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
        confidence: 0.5
      }
    }
  }

  /**
   * Create fallback media result when generation fails
   */
  private createFallbackMediaResult(type: 'image' | 'meme' | 'chart', error: any): MediaResult {
    const fallbackUrls = {
      image: 'https://via.placeholder.com/800x600?text=Image+Placeholder',
      meme: 'https://via.placeholder.com/500x400?text=Meme+Placeholder',
      chart: 'https://via.placeholder.com/800x600?text=Chart+Placeholder'
    }

    return {
      type,
      url: fallbackUrls[type],
      metadata: {
        source: 'fallback',
        description: `${type} generation failed - manual creation suggested`,
        alt: `${type} placeholder`,
      },
      suggestions: [
        {
          type: 'alternative',
          title: 'Manual creation',
          description: `Create ${type} manually using online tools`,
        }
      ]
    }
  }

  /**
   * Extract suggestions from LLM response text
   */
  private extractSuggestionsFromResponse(responseText: string): any[] {
    const suggestions = []
    const lines = responseText.split('\n')

    for (const line of lines) {
      if (line.includes('suggest') || line.includes('recommend') || line.includes('consider')) {
        suggestions.push(this.createSuggestion(
          'improvement',
          'Content enhancement',
          line.trim(),
          'medium'
        ))
      }
    }

    return suggestions.slice(0, 5) // Limit suggestions
  }

  /**
   * Check if content has structured data suitable for charts
   */
  private hasStructuredData(content: string): boolean {
    return content.includes('|') || // Table format
           /\d+[%$]/.test(content) || // Numbers with units
           content.match(/\d+.*\d+.*\d+/) !== null // Multiple numbers
  }

  /**
   * Check if content is humorous/suitable for memes
   */
  private isHumorousContent(content: string): boolean {
    const humorKeywords = ['funny', 'joke', 'humor', 'laugh', 'hilarious', 'amusing', 'witty']
    const lowerContent = content.toLowerCase()
    return humorKeywords.some(keyword => lowerContent.includes(keyword))
  }

  // Protected methods implementation
  protected async performInitialization(): Promise<void> {
    logger.info('Initializing Media Agent')
    // Media service is initialized in constructor
  }

  protected async performCleanup(): Promise<void> {
    logger.info('Cleaning up Media Agent')
    await this.mediaService.cleanupOldMedia()
  }

  protected async performHealthCheck(): Promise<boolean> {
    const healthStatus = await this.mediaService.getHealthStatus()
    return healthStatus.status === 'healthy'
  }

  protected async getSpecificMetrics(): Promise<Record<string, any>> {
    const usageStats = await this.mediaService.getUsageStats()
    
    return {
      requestCount: this.requestCount,
      averageProcessingTime: this.requestCount > 0 ? this.totalProcessingTime / this.requestCount : 0,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      mediaServiceStats: usageStats
    }
  }
}

// Supporting interfaces
interface MediaAnalysis {
  recommendedTypes: string[]
  concepts: string[]
  placement: 'header' | 'inline' | 'footer'
  style: 'professional' | 'casual' | 'creative'
}