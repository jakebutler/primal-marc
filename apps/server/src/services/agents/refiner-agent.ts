import { 
  BaseAgent, 
  AgentType, 
  AgentCapabilities, 
  AgentRequest, 
  AgentResponse, 
  AgentContext,
  Suggestion,
  StyleGuide
} from './base-agent.js'
import { LLMService, LLMResponse } from '../llm.js'
import { logger } from '../../utils/logger.js'

// Refiner-specific interfaces
export interface RefinerContext extends AgentContext {
  draftAnalysis?: DraftAnalysis
  styleAnalysis?: StyleAnalysis
  structureAnalysis?: StructureAnalysis
  userStyleProfile?: UserStyleProfile
}

export interface DraftAnalysis {
  wordCount: number
  paragraphCount: number
  sentenceCount: number
  averageSentenceLength: number
  readabilityScore: number
  structuralIssues: StructuralIssue[]
  flowIssues: FlowIssue[]
  strengthsIdentified: string[]
}

export interface StructuralIssue {
  type: 'weak_introduction' | 'unclear_thesis' | 'poor_transitions' | 'weak_conclusion' | 'logical_gaps'
  severity: 'low' | 'medium' | 'high'
  location: TextLocation
  description: string
  suggestion: string
}

export interface FlowIssue {
  type: 'abrupt_transition' | 'repetitive_structure' | 'unclear_progression' | 'inconsistent_tone'
  severity: 'low' | 'medium' | 'high'
  location: TextLocation
  description: string
  suggestion: string
}

export interface TextLocation {
  paragraphIndex: number
  sentenceIndex?: number
  startChar: number
  endChar: number
}

export interface StyleAnalysis {
  currentStyle: StyleProfile
  consistencyScore: number
  styleIssues: StyleIssue[]
  recommendations: StyleRecommendation[]
  writerSimilarity?: WriterSimilarity[]
}

export interface StyleProfile {
  toneScore: number // -1 (formal) to 1 (casual)
  complexityScore: number // 0 (simple) to 1 (complex)
  sentimentScore: number // -1 (negative) to 1 (positive)
  personalityTraits: string[]
  vocabularyLevel: 'basic' | 'intermediate' | 'advanced' | 'expert'
  averageSentenceLength: number
  passiveVoicePercentage: number
  firstPersonUsage: number
}

export interface StyleIssue {
  type: 'tone_inconsistency' | 'complexity_mismatch' | 'voice_inconsistency' | 'vocabulary_level_mismatch'
  severity: 'low' | 'medium' | 'high'
  location: TextLocation
  description: string
  currentValue: string
  suggestedValue: string
}

export interface StyleRecommendation {
  category: 'tone' | 'voice' | 'structure' | 'vocabulary' | 'flow'
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  examples: StyleExample[]
}

export interface StyleExample {
  before: string
  after: string
  explanation: string
}

export interface WriterSimilarity {
  writerName: string
  similarityScore: number // 0 to 1
  matchingTraits: string[]
  differingTraits: string[]
  recommendations: string[]
}

export interface StructureAnalysis {
  argumentStructure: ArgumentStructure
  logicalFlow: LogicalFlowAnalysis
  coherenceScore: number
  improvementSuggestions: StructureImprovement[]
}

export interface ArgumentStructure {
  hasThesis: boolean
  thesisStrength: number // 0 to 1
  supportingPoints: SupportingPoint[]
  counterarguments: CounterArgument[]
  evidenceQuality: number // 0 to 1
  conclusionStrength: number // 0 to 1
}

export interface SupportingPoint {
  content: string
  location: TextLocation
  strength: number // 0 to 1
  evidenceSupport: string[]
  connections: string[] // IDs of related points
}

export interface CounterArgument {
  content: string
  location: TextLocation
  addressed: boolean
  strength: number // 0 to 1
}

export interface LogicalFlowAnalysis {
  transitionQuality: number // 0 to 1
  paragraphCoherence: number[] // Score per paragraph
  overallProgression: 'linear' | 'circular' | 'scattered' | 'building'
  flowIssues: FlowIssue[]
}

export interface StructureImprovement {
  type: 'argument_strengthening' | 'flow_improvement' | 'evidence_addition' | 'transition_enhancement'
  priority: 'low' | 'medium' | 'high'
  description: string
  specificSuggestion: string
  location?: TextLocation
}

export interface UserStyleProfile {
  userId: string
  preferredStyles: StyleProfile[]
  learningHistory: StyleLearningEntry[]
  adaptationLevel: number // 0 to 1, how well we know their preferences
  lastUpdated: Date
}

export interface StyleLearningEntry {
  timestamp: Date
  userFeedback: 'positive' | 'negative' | 'neutral'
  suggestionType: string
  context: string
  outcome: 'accepted' | 'rejected' | 'modified'
}

// Reference writer profiles for style matching
const REFERENCE_WRITERS = {
  'hemingway': {
    name: 'Ernest Hemingway',
    style: {
      toneScore: 0.2, // Slightly casual but controlled
      complexityScore: 0.2, // Simple, direct
      sentimentScore: 0.1, // Often neutral to slightly positive
      personalityTraits: ['direct', 'understated', 'precise', 'economical'],
      vocabularyLevel: 'intermediate' as const,
      averageSentenceLength: 12,
      passiveVoicePercentage: 5,
      firstPersonUsage: 15,
    },
    characteristics: [
      'Short, declarative sentences',
      'Minimal use of adjectives and adverbs',
      'Understated emotion',
      'Iceberg theory - surface simplicity with deeper meaning',
      'Dialogue-driven narrative'
    ]
  },
  'orwell': {
    name: 'George Orwell',
    style: {
      toneScore: -0.3, // More formal, serious
      complexityScore: 0.4, // Moderate complexity
      sentimentScore: -0.2, // Often critical/serious
      personalityTraits: ['clear', 'direct', 'political', 'analytical'],
      vocabularyLevel: 'advanced' as const,
      averageSentenceLength: 18,
      passiveVoicePercentage: 15,
      firstPersonUsage: 25,
    },
    characteristics: [
      'Clear, precise language',
      'Political awareness and social criticism',
      'Logical argument structure',
      'Concrete examples and imagery',
      'Accessible despite complex ideas'
    ]
  },
  'woolf': {
    name: 'Virginia Woolf',
    style: {
      toneScore: 0.1, // Neutral to slightly casual
      complexityScore: 0.8, // High complexity
      sentimentScore: 0.3, // Often introspective, varied
      personalityTraits: ['introspective', 'flowing', 'psychological', 'experimental'],
      vocabularyLevel: 'expert' as const,
      averageSentenceLength: 25,
      passiveVoicePercentage: 25,
      firstPersonUsage: 35,
    },
    characteristics: [
      'Stream of consciousness',
      'Long, flowing sentences',
      'Psychological depth',
      'Experimental structure',
      'Rich, poetic language'
    ]
  },
  'twain': {
    name: 'Mark Twain',
    style: {
      toneScore: 0.7, // Casual, conversational
      complexityScore: 0.3, // Moderate simplicity
      sentimentScore: 0.4, // Often humorous, positive
      personalityTraits: ['humorous', 'conversational', 'satirical', 'folksy'],
      vocabularyLevel: 'intermediate' as const,
      averageSentenceLength: 16,
      passiveVoicePercentage: 10,
      firstPersonUsage: 40,
    },
    characteristics: [
      'Conversational, folksy tone',
      'Humor and satire',
      'Regional dialect and colloquialisms',
      'Social commentary through storytelling',
      'Accessible, engaging style'
    ]
  },
  'baldwin': {
    name: 'James Baldwin',
    style: {
      toneScore: 0.0, // Balanced formal/casual
      complexityScore: 0.6, // Moderately complex
      sentimentScore: 0.2, // Passionate, varied
      personalityTraits: ['passionate', 'eloquent', 'rhythmic', 'confrontational'],
      vocabularyLevel: 'advanced' as const,
      averageSentenceLength: 22,
      passiveVoicePercentage: 20,
      firstPersonUsage: 30,
    },
    characteristics: [
      'Rhythmic, musical prose',
      'Passionate and eloquent',
      'Personal and political intertwined',
      'Complex sentence structures',
      'Emotional depth and honesty'
    ]
  }
}

// Style analysis templates and frameworks
const STYLE_FRAMEWORKS = {
  academic: {
    name: 'Academic Writing',
    characteristics: {
      toneScore: -0.6, // Formal
      complexityScore: 0.7, // Complex
      vocabularyLevel: 'expert' as const,
      passiveVoicePercentage: 30,
      firstPersonUsage: 5,
    },
    guidelines: [
      'Use formal, objective tone',
      'Employ complex sentence structures',
      'Minimize first-person pronouns',
      'Use discipline-specific terminology',
      'Maintain logical argument structure'
    ]
  },
  business: {
    name: 'Business Communication',
    characteristics: {
      toneScore: -0.2, // Slightly formal
      complexityScore: 0.3, // Moderate simplicity
      vocabularyLevel: 'advanced' as const,
      passiveVoicePercentage: 15,
      firstPersonUsage: 10,
    },
    guidelines: [
      'Be clear and concise',
      'Use active voice',
      'Focus on actionable insights',
      'Maintain professional tone',
      'Structure with clear headings'
    ]
  },
  creative: {
    name: 'Creative Writing',
    characteristics: {
      toneScore: 0.4, // More casual/expressive
      complexityScore: 0.5, // Variable complexity
      vocabularyLevel: 'intermediate' as const,
      passiveVoicePercentage: 20,
      firstPersonUsage: 25,
    },
    guidelines: [
      'Show, don\'t tell',
      'Use vivid, sensory language',
      'Vary sentence structure',
      'Develop unique voice',
      'Focus on emotional impact'
    ]
  },
  journalistic: {
    name: 'Journalistic Style',
    characteristics: {
      toneScore: -0.1, // Neutral
      complexityScore: 0.2, // Simple, accessible
      vocabularyLevel: 'intermediate' as const,
      passiveVoicePercentage: 10,
      firstPersonUsage: 5,
    },
    guidelines: [
      'Lead with most important information',
      'Use clear, simple language',
      'Maintain objectivity',
      'Include concrete details',
      'Write for broad audience'
    ]
  }
}/**

 * Draft Refiner Agent - Specializes in analyzing and improving draft structure and style
 */
export class RefinerAgent extends BaseAgent {
  private userStyleProfiles: Map<string, UserStyleProfile> = new Map()
  private analysisCache: Map<string, DraftAnalysis> = new Map()

  constructor(capabilities: AgentCapabilities, llmService: LLMService) {
    super('REFINER', capabilities, llmService)
  }

  /**
   * Process refiner request with comprehensive draft analysis
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      logger.info(`Refiner agent processing request`, {
        userId: request.userId,
        projectId: request.projectId,
        contentLength: request.content.length,
      })

      // Determine the type of refinement request
      const requestType = this.analyzeRequestType(request)
      
      // Perform draft analysis
      const draftAnalysis = await this.analyzeDraft(request.content)
      
      // Perform style analysis
      const styleAnalysis = await this.analyzeStyle(request.content, request.context?.styleGuide)
      
      // Perform structure analysis
      const structureAnalysis = await this.analyzeStructure(request.content)
      
      // Build context for the request
      const systemContext = await this.buildContext(request)
      
      // Generate response based on request type
      let response: AgentResponse

      switch (requestType) {
        case 'structure_analysis':
          response = await this.handleStructureAnalysis(request, systemContext, structureAnalysis)
          break
        case 'style_refinement':
          response = await this.handleStyleRefinement(request, systemContext, styleAnalysis)
          break
        case 'flow_improvement':
          response = await this.handleFlowImprovement(request, systemContext, draftAnalysis)
          break
        case 'argument_strengthening':
          response = await this.handleArgumentStrengthening(request, systemContext, structureAnalysis)
          break
        case 'writer_matching':
          response = await this.handleWriterMatching(request, systemContext, styleAnalysis)
          break
        default:
          response = await this.handleGeneralRefinement(request, systemContext, {
            draftAnalysis,
            styleAnalysis,
            structureAnalysis
          })
      }

      // Update user style profile based on interaction
      await this.updateUserStyleProfile(request.userId, request, response)

      const processingTime = Date.now() - startTime
      logger.info(`Refiner agent completed request`, {
        requestType,
        processingTime,
        tokenUsage: response.metadata.tokenUsage.totalTokens,
      })

      return response

    } catch (error) {
      logger.error(`Refiner agent failed to process request:`, error)
      throw error
    }
  }

  /**
   * Build system prompt for refinement tasks
   */
  buildSystemPrompt(context: AgentContext): string {
    let prompt = `You are an expert writing coach and editor specializing in draft refinement, style analysis, and structural improvement. Your role is to help writers improve their drafts through detailed analysis and personalized feedback.

Core Capabilities:
- Analyze draft structure and argument flow
- Identify style inconsistencies and suggest improvements
- Match writing style to reference writers or style guides
- Strengthen argument structure and logical progression
- Provide personalized feedback based on user preferences

Communication Style:
- Be constructive and encouraging in feedback
- Provide specific, actionable suggestions
- Explain the reasoning behind recommendations
- Offer multiple options when appropriate
- Balance criticism with recognition of strengths`

    // Add user preferences and style guide
    if (context.userPreferences) {
      const personality = context.userPreferences.preferredAgentPersonality
      const experience = context.userPreferences.experienceLevel
      
      prompt += `\n\nUser Context:
- Experience Level: ${experience}
- Preferred Interaction Style: ${personality}
- Writing Genres: ${context.userPreferences.writingGenres.join(', ') || 'General'}`

      // Adjust approach based on experience level
      if (experience === 'BEGINNER') {
        prompt += `\n- Provide detailed explanations for suggestions
- Focus on fundamental writing principles
- Offer step-by-step improvement guidance`
      } else if (experience === 'ADVANCED') {
        prompt += `\n- Focus on nuanced style and advanced techniques
- Provide sophisticated analysis and feedback
- Challenge the writer to push creative boundaries`
      }
    }

    // Add style guide context
    if (context.styleGuide) {
      prompt += `\n\nStyle Guide Context:`
      
      if (context.styleGuide.referenceWriters) {
        prompt += `\n- Reference Writers: ${context.styleGuide.referenceWriters.join(', ')}`
      }
      
      if (context.styleGuide.toneDescription) {
        prompt += `\n- Desired Tone: ${context.styleGuide.toneDescription}`
      }
      
      if (context.styleGuide.targetAudience) {
        prompt += `\n- Target Audience: ${context.styleGuide.targetAudience}`
      }
      
      if (context.styleGuide.exampleText) {
        prompt += `\n- Style Example: "${context.styleGuide.exampleText.substring(0, 200)}${context.styleGuide.exampleText.length > 200 ? '...' : ''}"`
      }
    }

    return prompt
  }  /*
*
   * Parse LLM response into structured agent response
   */
  parseResponse(llmResponse: LLMResponse): AgentResponse {
    const content = llmResponse.content
    const suggestions = this.extractRefinementSuggestions(content)
    const nextSteps = this.generateRefinementNextSteps(content)

    return {
      content,
      suggestions,
      metadata: {
        processingTime: Date.now(),
        tokenUsage: llmResponse.usage,
        model: llmResponse.model,
        confidence: this.calculateRefinementConfidence(content),
        nextSteps,
      },
    }
  }

  /**
   * Analyze the type of refinement request
   */
  private analyzeRequestType(request: AgentRequest): string {
    const content = request.content.toLowerCase()

    // Structure analysis indicators
    if (content.includes('structure') ||
        content.includes('organization') ||
        content.includes('flow') ||
        content.includes('argument')) {
      return 'structure_analysis'
    }

    // Style refinement indicators
    if (content.includes('style') ||
        content.includes('tone') ||
        content.includes('voice') ||
        content.includes('consistency')) {
      return 'style_refinement'
    }

    // Flow improvement indicators
    if (content.includes('flow') ||
        content.includes('transition') ||
        content.includes('smooth') ||
        content.includes('connection')) {
      return 'flow_improvement'
    }

    // Argument strengthening indicators
    if (content.includes('argument') ||
        content.includes('logic') ||
        content.includes('evidence') ||
        content.includes('persuasive')) {
      return 'argument_strengthening'
    }

    // Writer matching indicators
    if (content.includes('like') && (content.includes('writer') || content.includes('author')) ||
        content.includes('similar to') ||
        content.includes('style of')) {
      return 'writer_matching'
    }

    // Default to general refinement
    return 'general_refinement'
  }

  /**
   * Analyze draft structure and identify issues
   */
  private async analyzeDraft(content: string): Promise<DraftAnalysis> {
    const cacheKey = this.generateCacheKey(content)
    const cached = this.analysisCache.get(cacheKey)
    if (cached) return cached

    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    const wordCount = content.split(/\s+/).length
    const averageSentenceLength = wordCount / sentences.length

    // Calculate readability score (simplified Flesch Reading Ease)
    const avgSentenceLength = wordCount / sentences.length
    const avgSyllablesPerWord = this.estimateAverageSyllables(content)
    const readabilityScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)

    // Identify structural issues
    const structuralIssues = this.identifyStructuralIssues(content, paragraphs)
    
    // Identify flow issues
    const flowIssues = this.identifyFlowIssues(content, paragraphs)
    
    // Identify strengths
    const strengthsIdentified = this.identifyStrengths(content, paragraphs)

    const analysis: DraftAnalysis = {
      wordCount,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      averageSentenceLength,
      readabilityScore: Math.max(0, Math.min(100, readabilityScore)),
      structuralIssues,
      flowIssues,
      strengthsIdentified,
    }

    this.analysisCache.set(cacheKey, analysis)
    return analysis
  }

  /**
   * Analyze writing style and consistency
   */
  private async analyzeStyle(content: string, styleGuide?: StyleGuide): Promise<StyleAnalysis> {
    const currentStyle = this.extractStyleProfile(content)
    const styleIssues = this.identifyStyleIssues(content, currentStyle, styleGuide)
    const recommendations = this.generateStyleRecommendations(currentStyle, styleGuide)
    const writerSimilarity = this.calculateWriterSimilarity(currentStyle)
    
    // Calculate consistency score based on style variations throughout the text
    const consistencyScore = this.calculateStyleConsistency(content)

    return {
      currentStyle,
      consistencyScore,
      styleIssues,
      recommendations,
      writerSimilarity,
    }
  }

  /**
   * Analyze argument structure and logical flow
   */
  private async analyzeStructure(content: string): Promise<StructureAnalysis> {
    const argumentStructure = this.analyzeArgumentStructure(content)
    const logicalFlow = this.analyzeLogicalFlow(content)
    const coherenceScore = this.calculateCoherenceScore(content)
    const improvementSuggestions = this.generateStructureImprovements(argumentStructure, logicalFlow)

    return {
      argumentStructure,
      logicalFlow,
      coherenceScore,
      improvementSuggestions,
    }
  }  /**

   * Handle structure analysis requests
   */
  private async handleStructureAnalysis(
    request: AgentRequest,
    systemContext: string,
    structureAnalysis: StructureAnalysis
  ): Promise<AgentResponse> {
    const analysisPrompt = `Analyze the structure and argument flow of the user's draft. Focus on logical progression, argument strength, and overall organization.

Draft Analysis Results:
- Coherence Score: ${structureAnalysis.coherenceScore.toFixed(2)}/1.0
- Thesis Strength: ${structureAnalysis.argumentStructure.thesisStrength.toFixed(2)}/1.0
- Supporting Points: ${structureAnalysis.argumentStructure.supportingPoints.length}
- Evidence Quality: ${structureAnalysis.argumentStructure.evidenceQuality.toFixed(2)}/1.0

Key Issues Identified:
${structureAnalysis.improvementSuggestions.map(s => `- ${s.description}`).join('\n')}

User's Draft: "${request.content}"

Provide specific feedback on:
1. Overall argument structure and thesis clarity
2. Logical flow and transitions between ideas
3. Evidence quality and supporting points
4. Areas for structural improvement
5. Specific suggestions for reorganization if needed`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + analysisPrompt, {
      temperature: 0.3, // Lower temperature for analytical tasks
      maxTokens: 1200,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add structure-specific suggestions
    response.suggestions.push(
      this.createSuggestion('improvement', 'Strengthen Thesis', 'Make your main argument more clear and specific', 'high'),
      this.createSuggestion('action', 'Improve Transitions', 'Add connecting phrases between paragraphs', 'medium'),
      this.createSuggestion('improvement', 'Add Evidence', 'Support your points with more concrete examples', 'medium')
    )

    return response
  }

  /**
   * Handle style refinement requests
   */
  private async handleStyleRefinement(
    request: AgentRequest,
    systemContext: string,
    styleAnalysis: StyleAnalysis
  ): Promise<AgentResponse> {
    const stylePrompt = `Analyze and refine the writing style of the user's draft. Focus on consistency, tone, and alignment with their style preferences.

Current Style Profile:
- Tone: ${styleAnalysis.currentStyle.toneScore > 0 ? 'Casual' : 'Formal'} (${styleAnalysis.currentStyle.toneScore.toFixed(2)})
- Complexity: ${styleAnalysis.currentStyle.complexityScore.toFixed(2)}/1.0
- Vocabulary Level: ${styleAnalysis.currentStyle.vocabularyLevel}
- Consistency Score: ${styleAnalysis.consistencyScore.toFixed(2)}/1.0

Style Issues Found:
${styleAnalysis.styleIssues.map(issue => `- ${issue.description}`).join('\n')}

Writer Similarities:
${styleAnalysis.writerSimilarity?.slice(0, 3).map(w => `- ${w.writerName}: ${(w.similarityScore * 100).toFixed(0)}% match`).join('\n') || 'None calculated'}

User's Draft: "${request.content}"

Provide specific feedback on:
1. Style consistency throughout the draft
2. Tone appropriateness for the intended audience
3. Vocabulary and complexity level adjustments
4. Specific word and phrase improvements
5. How to better match their desired style`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + stylePrompt, {
      temperature: 0.4,
      maxTokens: 1200,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add style-specific suggestions
    response.suggestions.push(
      this.createSuggestion('improvement', 'Maintain Consistent Tone', 'Keep the same tone throughout your writing', 'high'),
      this.createSuggestion('action', 'Vary Sentence Length', 'Mix short and long sentences for better flow', 'medium'),
      this.createSuggestion('improvement', 'Strengthen Voice', 'Develop a more distinctive writing voice', 'low')
    )

    return response
  }

  /**
   * Handle flow improvement requests
   */
  private async handleFlowImprovement(
    request: AgentRequest,
    systemContext: string,
    draftAnalysis: DraftAnalysis
  ): Promise<AgentResponse> {
    const flowPrompt = `Help improve the flow and readability of the user's draft. Focus on transitions, paragraph structure, and overall readability.

Draft Metrics:
- Readability Score: ${draftAnalysis.readabilityScore.toFixed(1)}/100
- Average Sentence Length: ${draftAnalysis.averageSentenceLength.toFixed(1)} words
- Paragraph Count: ${draftAnalysis.paragraphCount}

Flow Issues Identified:
${draftAnalysis.flowIssues.map(issue => `- ${issue.description}`).join('\n')}

Strengths Identified:
${draftAnalysis.strengthsIdentified.join('\n- ')}

User's Draft: "${request.content}"

Provide specific feedback on:
1. Transition quality between paragraphs and ideas
2. Sentence variety and rhythm
3. Paragraph structure and length
4. Overall readability improvements
5. Specific suggestions for smoother flow`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + flowPrompt, {
      temperature: 0.4,
      maxTokens: 1000,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add flow-specific suggestions
    response.suggestions.push(
      this.createSuggestion('action', 'Add Transition Words', 'Use connecting words to link ideas', 'high'),
      this.createSuggestion('improvement', 'Vary Sentence Structure', 'Mix simple and complex sentences', 'medium'),
      this.createSuggestion('action', 'Break Up Long Paragraphs', 'Split dense paragraphs for better readability', 'medium')
    )

    return response
  }  /**

   * Handle argument strengthening requests
   */
  private async handleArgumentStrengthening(
    request: AgentRequest,
    systemContext: string,
    structureAnalysis: StructureAnalysis
  ): Promise<AgentResponse> {
    const argumentPrompt = `Help strengthen the argument and logical structure of the user's draft. Focus on evidence, reasoning, and persuasive elements.

Argument Analysis:
- Thesis Present: ${structureAnalysis.argumentStructure.hasThesis ? 'Yes' : 'No'}
- Thesis Strength: ${structureAnalysis.argumentStructure.thesisStrength.toFixed(2)}/1.0
- Supporting Points: ${structureAnalysis.argumentStructure.supportingPoints.length}
- Evidence Quality: ${structureAnalysis.argumentStructure.evidenceQuality.toFixed(2)}/1.0
- Conclusion Strength: ${structureAnalysis.argumentStructure.conclusionStrength.toFixed(2)}/1.0

Counterarguments Addressed: ${structureAnalysis.argumentStructure.counterarguments.filter(c => c.addressed).length}/${structureAnalysis.argumentStructure.counterarguments.length}

User's Draft: "${request.content}"

Provide specific feedback on:
1. Thesis clarity and strength
2. Quality and relevance of supporting evidence
3. Logical connections between points
4. Potential counterarguments to address
5. Ways to make the argument more persuasive`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + argumentPrompt, {
      temperature: 0.3,
      maxTokens: 1200,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add argument-specific suggestions
    response.suggestions.push(
      this.createSuggestion('improvement', 'Clarify Thesis Statement', 'Make your main argument more specific and debatable', 'high'),
      this.createSuggestion('action', 'Add Supporting Evidence', 'Include more facts, examples, or expert opinions', 'high'),
      this.createSuggestion('improvement', 'Address Counterarguments', 'Acknowledge and refute opposing viewpoints', 'medium')
    )

    return response
  }

  /**
   * Handle writer matching requests
   */
  private async handleWriterMatching(
    request: AgentRequest,
    systemContext: string,
    styleAnalysis: StyleAnalysis
  ): Promise<AgentResponse> {
    const topMatches = styleAnalysis.writerSimilarity?.slice(0, 3) || []
    
    const matchingPrompt = `Help the user understand their writing style in relation to famous writers and provide guidance on style development.

Current Style Matches:
${topMatches.map(match => `
- ${match.writerName}: ${(match.similarityScore * 100).toFixed(0)}% similarity
  Matching traits: ${match.matchingTraits.join(', ')}
  Different traits: ${match.differingTraits.join(', ')}
`).join('\n')}

User's Draft: "${request.content}"

Provide insights on:
1. How their style compares to the matched writers
2. Specific techniques they could adopt from these writers
3. Ways to develop their unique voice while learning from masters
4. Style exercises to improve their writing
5. What makes their current style distinctive`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + matchingPrompt, {
      temperature: 0.5,
      maxTokens: 1000,
    })

    const response = this.parseResponse(llmResponse)
    
    // Add writer-matching specific suggestions
    if (topMatches.length > 0) {
      const topMatch = topMatches[0]
      response.suggestions.push(
        this.createSuggestion('resource', `Study ${topMatch.writerName}`, `Read more of ${topMatch.writerName}'s work to learn their techniques`, 'medium'),
        this.createSuggestion('action', 'Practice Style Exercises', 'Try writing exercises in different styles', 'low')
      )
    }

    return response
  }

  /**
   * Handle general refinement requests
   */
  private async handleGeneralRefinement(
    request: AgentRequest,
    systemContext: string,
    analyses: {
      draftAnalysis: DraftAnalysis
      styleAnalysis: StyleAnalysis
      structureAnalysis: StructureAnalysis
    }
  ): Promise<AgentResponse> {
    const { draftAnalysis, styleAnalysis, structureAnalysis } = analyses
    
    const generalPrompt = `Provide comprehensive feedback on the user's draft, covering structure, style, and overall effectiveness.

Comprehensive Analysis:
- Readability Score: ${draftAnalysis.readabilityScore.toFixed(1)}/100
- Style Consistency: ${styleAnalysis.consistencyScore.toFixed(2)}/1.0
- Argument Coherence: ${structureAnalysis.coherenceScore.toFixed(2)}/1.0
- Word Count: ${draftAnalysis.wordCount}

Top Strengths:
${draftAnalysis.strengthsIdentified.slice(0, 3).map(s => `- ${s}`).join('\n')}

Priority Issues:
${[...draftAnalysis.structuralIssues, ...styleAnalysis.styleIssues]
  .filter(issue => issue.severity === 'high')
  .slice(0, 3)
  .map(issue => `- ${issue.description}`)
  .join('\n')}

User's Draft: "${request.content}"

Provide balanced feedback covering:
1. Overall strengths and what's working well
2. Priority areas for improvement
3. Specific, actionable suggestions
4. Next steps for revision
5. Encouragement and motivation for continued improvement`

    const llmResponse = await this.makeLLMRequest(request, systemContext + '\n\n' + generalPrompt, {
      temperature: 0.4,
      maxTokens: 1200,
    })

    const response = this.parseResponse(llmResponse)
    
    // Ensure we always have some suggestions for general refinement
    if (response.suggestions.length === 0) {
      response.suggestions.push(
        this.createSuggestion('improvement', 'Maintain Consistent Tone', 'Keep the same tone throughout your writing', 'medium'),
        this.createSuggestion('action', 'Vary Sentence Length', 'Mix short and long sentences for better flow', 'medium'),
        this.createSuggestion('improvement', 'Strengthen Voice', 'Develop a more distinctive writing voice', 'low')
      )
    }

    return response
  }

  // Helper methods for analysis

  /**
   * Extract style profile from content
   */
  private extractStyleProfile(content: string): StyleProfile {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = content.split(/\s+/)
    const wordCount = words.length
    
    // Calculate tone score (simplified sentiment analysis)
    const casualWords = ['really', 'pretty', 'quite', 'very', 'totally', 'awesome', 'cool']
    const formalWords = ['therefore', 'furthermore', 'consequently', 'nevertheless', 'moreover']
    const casualCount = casualWords.reduce((count, word) => count + (content.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0)
    const formalCount = formalWords.reduce((count, word) => count + (content.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0)
    const toneScore = (casualCount - formalCount) / Math.max(wordCount / 100, 1)
    
    // Calculate complexity score
    const avgSentenceLength = wordCount / sentences.length
    const complexityScore = Math.min(avgSentenceLength / 25, 1) // Normalize to 0-1
    
    // Calculate sentiment (simplified)
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic']
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing']
    const positiveCount = positiveWords.reduce((count, word) => count + (content.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0)
    const negativeCount = negativeWords.reduce((count, word) => count + (content.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0)
    const sentimentScore = (positiveCount - negativeCount) / Math.max(wordCount / 100, 1)
    
    // Calculate passive voice percentage (simplified)
    const passiveIndicators = content.match(/\b(was|were|is|are|been|being)\s+\w+ed\b/gi) || []
    const passiveVoicePercentage = (passiveIndicators.length / sentences.length) * 100
    
    // Calculate first person usage
    const firstPersonWords = content.match(/\b(I|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi) || []
    const firstPersonUsage = (firstPersonWords.length / wordCount) * 100
    
    // Determine vocabulary level
    const longWords = words.filter(word => word.length > 6).length
    const longWordPercentage = (longWords / wordCount) * 100
    let vocabularyLevel: StyleProfile['vocabularyLevel'] = 'basic'
    if (longWordPercentage > 30) vocabularyLevel = 'expert'
    else if (longWordPercentage > 20) vocabularyLevel = 'advanced'
    else if (longWordPercentage > 10) vocabularyLevel = 'intermediate'
    
    // Extract personality traits (simplified)
    const personalityTraits: string[] = []
    if (toneScore > 0.3) personalityTraits.push('casual', 'conversational')
    if (toneScore < -0.3) personalityTraits.push('formal', 'academic')
    if (complexityScore > 0.7) personalityTraits.push('complex', 'sophisticated')
    if (complexityScore < 0.3) personalityTraits.push('simple', 'direct')
    if (sentimentScore > 0.2) personalityTraits.push('positive', 'optimistic')
    if (sentimentScore < -0.2) personalityTraits.push('critical', 'analytical')
    
    return {
      toneScore: Math.max(-1, Math.min(1, toneScore)),
      complexityScore: Math.max(0, Math.min(1, complexityScore)),
      sentimentScore: Math.max(-1, Math.min(1, sentimentScore)),
      personalityTraits,
      vocabularyLevel,
      averageSentenceLength: avgSentenceLength,
      passiveVoicePercentage: Math.min(100, passiveVoicePercentage),
      firstPersonUsage: Math.min(100, firstPersonUsage),
    }
  }

  /**
   * Calculate writer similarity based on style profile
   */
  private calculateWriterSimilarity(currentStyle: StyleProfile): WriterSimilarity[] {
    const similarities: WriterSimilarity[] = []
    
    Object.entries(REFERENCE_WRITERS).forEach(([key, writer]) => {
      const writerStyle = writer.style
      
      // Calculate similarity score based on multiple factors
      const toneDistance = Math.abs(currentStyle.toneScore - writerStyle.toneScore)
      const complexityDistance = Math.abs(currentStyle.complexityScore - writerStyle.complexityScore)
      const sentimentDistance = Math.abs(currentStyle.sentimentScore - writerStyle.sentimentScore)
      const sentenceLengthDistance = Math.abs(currentStyle.averageSentenceLength - writerStyle.averageSentenceLength) / 20
      const passiveVoiceDistance = Math.abs(currentStyle.passiveVoicePercentage - writerStyle.passiveVoicePercentage) / 100
      
      // Weight the factors
      const totalDistance = (
        toneDistance * 0.3 +
        complexityDistance * 0.25 +
        sentimentDistance * 0.2 +
        sentenceLengthDistance * 0.15 +
        passiveVoiceDistance * 0.1
      )
      
      const similarityScore = Math.max(0, 1 - totalDistance)
      
      // Find matching and differing traits
      const matchingTraits = currentStyle.personalityTraits.filter(trait => 
        writerStyle.personalityTraits.includes(trait)
      )
      const differingTraits = writerStyle.personalityTraits.filter(trait => 
        !currentStyle.personalityTraits.includes(trait)
      )
      
      // Generate recommendations
      const recommendations = this.generateWriterRecommendations(writer, currentStyle, writerStyle)
      
      similarities.push({
        writerName: writer.name,
        similarityScore,
        matchingTraits,
        differingTraits,
        recommendations,
      })
    })
    
    return similarities.sort((a, b) => b.similarityScore - a.similarityScore)
  }

  /**
   * Generate recommendations based on writer comparison
   */
  private generateWriterRecommendations(
    writer: typeof REFERENCE_WRITERS[keyof typeof REFERENCE_WRITERS],
    currentStyle: StyleProfile,
    writerStyle: StyleProfile
  ): string[] {
    const recommendations: string[] = []
    
    if (Math.abs(currentStyle.averageSentenceLength - writerStyle.averageSentenceLength) > 5) {
      if (writerStyle.averageSentenceLength < currentStyle.averageSentenceLength) {
        recommendations.push(`Try shorter, more direct sentences like ${writer.name}`)
      } else {
        recommendations.push(`Experiment with longer, more complex sentences like ${writer.name}`)
      }
    }
    
    if (Math.abs(currentStyle.passiveVoicePercentage - writerStyle.passiveVoicePercentage) > 10) {
      if (writerStyle.passiveVoicePercentage < currentStyle.passiveVoicePercentage) {
        recommendations.push(`Use more active voice like ${writer.name}`)
      }
    }
    
    // Add characteristic-based recommendations
    writer.characteristics.slice(0, 2).forEach(characteristic => {
      recommendations.push(`Adopt ${writer.name}'s approach: ${characteristic.toLowerCase()}`)
    })
    
    return recommendations.slice(0, 3) // Limit to 3 recommendations
  }  /**

   * Identify structural issues in the draft
   */
  private identifyStructuralIssues(content: string, paragraphs: string[]): StructuralIssue[] {
    const issues: StructuralIssue[] = []
    
    // Check for weak introduction
    if (paragraphs.length > 0) {
      const firstParagraph = paragraphs[0]
      if (firstParagraph.length < 100 || !this.hasHookElements(firstParagraph)) {
        issues.push({
          type: 'weak_introduction',
          severity: 'medium',
          location: { paragraphIndex: 0, startChar: 0, endChar: firstParagraph.length },
          description: 'Introduction could be more engaging and substantial',
          suggestion: 'Start with a compelling hook, question, or surprising fact'
        })
      }
    }
    
    // Check for unclear thesis
    const hasThesis = this.detectThesis(content)
    if (!hasThesis) {
      issues.push({
        type: 'unclear_thesis',
        severity: 'high',
        location: { paragraphIndex: 0, startChar: 0, endChar: content.length },
        description: 'No clear thesis statement found',
        suggestion: 'Add a clear, specific thesis statement that presents your main argument'
      })
    }
    
    // Check for poor transitions
    const transitionIssues = this.detectTransitionIssues(paragraphs)
    issues.push(...transitionIssues)
    
    // Check for weak conclusion
    if (paragraphs.length > 1) {
      const lastParagraph = paragraphs[paragraphs.length - 1]
      if (lastParagraph.length < 80 || !this.hasConclusionElements(lastParagraph)) {
        issues.push({
          type: 'weak_conclusion',
          severity: 'medium',
          location: { 
            paragraphIndex: paragraphs.length - 1, 
            startChar: content.lastIndexOf(lastParagraph), 
            endChar: content.length 
          },
          description: 'Conclusion could be stronger and more impactful',
          suggestion: 'Summarize key points and end with a call to action or thought-provoking statement'
        })
      }
    }
    
    return issues
  }

  /**
   * Identify flow issues in the draft
   */
  private identifyFlowIssues(content: string, paragraphs: string[]): FlowIssue[] {
    const issues: FlowIssue[] = []
    
    // Check for abrupt transitions
    for (let i = 1; i < paragraphs.length; i++) {
      const prevParagraph = paragraphs[i - 1]
      const currentParagraph = paragraphs[i]
      
      if (!this.hasTransitionElements(currentParagraph) && !this.hasTopicConnection(prevParagraph, currentParagraph)) {
        issues.push({
          type: 'abrupt_transition',
          severity: 'medium',
          location: { 
            paragraphIndex: i, 
            startChar: content.indexOf(currentParagraph), 
            endChar: content.indexOf(currentParagraph) + currentParagraph.length 
          },
          description: 'Abrupt transition between paragraphs',
          suggestion: 'Add transitional phrases or sentences to connect ideas smoothly'
        })
      }
    }
    
    // Check for repetitive structure
    const structurePatterns = this.analyzeStructurePatterns(paragraphs)
    if (structurePatterns.repetitiveScore > 0.7) {
      issues.push({
        type: 'repetitive_structure',
        severity: 'low',
        location: { paragraphIndex: 0, startChar: 0, endChar: content.length },
        description: 'Paragraphs follow too similar a structure',
        suggestion: 'Vary paragraph structure and sentence patterns for better flow'
      })
    }
    
    return issues
  }

  /**
   * Identify strengths in the draft
   */
  private identifyStrengths(content: string, paragraphs: string[]): string[] {
    const strengths: string[] = []
    
    // Check for good examples
    if (this.hasConcreteExamples(content)) {
      strengths.push('Uses concrete examples to support points')
    }
    
    // Check for varied sentence structure
    if (this.hasVariedSentenceStructure(content)) {
      strengths.push('Good variety in sentence structure and length')
    }
    
    // Check for clear topic sentences
    const topicSentenceCount = paragraphs.filter(p => this.hasTopicSentence(p)).length
    if (topicSentenceCount / paragraphs.length > 0.6) {
      strengths.push('Clear topic sentences in most paragraphs')
    }
    
    // Check for engaging language
    if (this.hasEngagingLanguage(content)) {
      strengths.push('Uses engaging and vivid language')
    }
    
    return strengths
  }

  /**
   * Identify style issues
   */
  private identifyStyleIssues(content: string, currentStyle: StyleProfile, styleGuide?: StyleGuide): StyleIssue[] {
    const issues: StyleIssue[] = []
    
    // Check tone consistency if style guide is provided
    if (styleGuide?.toneDescription) {
      const targetTone = this.interpretToneDescription(styleGuide.toneDescription)
      const toneDistance = Math.abs(currentStyle.toneScore - targetTone)
      
      if (toneDistance > 0.3) {
        issues.push({
          type: 'tone_inconsistency',
          severity: 'medium',
          location: { paragraphIndex: 0, startChar: 0, endChar: content.length },
          description: `Current tone doesn't match desired style: ${styleGuide.toneDescription}`,
          currentValue: currentStyle.toneScore > 0 ? 'Casual' : 'Formal',
          suggestedValue: targetTone > 0 ? 'More casual' : 'More formal'
        })
      }
    }
    
    // Check for vocabulary level consistency
    const vocabularyInconsistencies = this.detectVocabularyInconsistencies(content)
    issues.push(...vocabularyInconsistencies)
    
    return issues
  }

  /**
   * Generate style recommendations
   */
  private generateStyleRecommendations(currentStyle: StyleProfile, styleGuide?: StyleGuide): StyleRecommendation[] {
    const recommendations: StyleRecommendation[] = []
    
    // Sentence variety recommendation
    if (currentStyle.averageSentenceLength > 20 || currentStyle.averageSentenceLength < 10) {
      recommendations.push({
        category: 'structure',
        priority: 'medium',
        title: 'Improve Sentence Variety',
        description: 'Mix short and long sentences for better rhythm and readability',
        examples: [
          {
            before: 'This is a long sentence that goes on and on without much variation in structure or length.',
            after: 'This is a long sentence that demonstrates poor variety. Short sentences add punch. They create rhythm.',
            explanation: 'Mixing sentence lengths creates better flow and keeps readers engaged'
          }
        ]
      })
    }
    
    // Passive voice recommendation
    if (currentStyle.passiveVoicePercentage > 20) {
      recommendations.push({
        category: 'voice',
        priority: 'high',
        title: 'Reduce Passive Voice',
        description: 'Use more active voice to make your writing more direct and engaging',
        examples: [
          {
            before: 'The report was written by the team.',
            after: 'The team wrote the report.',
            explanation: 'Active voice is more direct and creates stronger, clearer sentences'
          }
        ]
      })
    }
    
    return recommendations
  }

  // Additional helper methods

  private hasHookElements(paragraph: string): boolean {
    const hookIndicators = ['?', '!', 'imagine', 'what if', 'surprising', 'shocking', 'according to']
    return hookIndicators.some(indicator => paragraph.toLowerCase().includes(indicator))
  }

  private detectThesis(content: string): boolean {
    const thesisIndicators = ['argue that', 'believe that', 'contend that', 'propose that', 'thesis', 'main point']
    return thesisIndicators.some(indicator => content.toLowerCase().includes(indicator))
  }

  private hasConclusionElements(paragraph: string): boolean {
    const conclusionIndicators = ['in conclusion', 'therefore', 'thus', 'finally', 'ultimately', 'in summary']
    return conclusionIndicators.some(indicator => paragraph.toLowerCase().includes(indicator))
  }

  private hasTransitionElements(paragraph: string): boolean {
    const transitions = ['however', 'furthermore', 'moreover', 'additionally', 'consequently', 'meanwhile', 'first', 'second', 'next', 'finally']
    return transitions.some(transition => paragraph.toLowerCase().includes(transition))
  }

  private hasTopicConnection(prev: string, current: string): boolean {
    // Simple keyword overlap check
    const prevWords = prev.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    const currentWords = current.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    const overlap = prevWords.filter(word => currentWords.includes(word))
    return overlap.length > 0
  }

  private detectTransitionIssues(paragraphs: string[]): StructuralIssue[] {
    const issues: StructuralIssue[] = []
    let transitionCount = 0
    
    paragraphs.forEach((paragraph, index) => {
      if (this.hasTransitionElements(paragraph)) {
        transitionCount++
      }
    })
    
    const transitionRatio = transitionCount / Math.max(paragraphs.length - 1, 1)
    if (transitionRatio < 0.3) {
      issues.push({
        type: 'poor_transitions',
        severity: 'medium',
        location: { paragraphIndex: 0, startChar: 0, endChar: 0 },
        description: 'Few transitional elements between paragraphs',
        suggestion: 'Add more transitional words and phrases to connect ideas'
      })
    }
    
    return issues
  }

  private analyzeStructurePatterns(paragraphs: string[]): { repetitiveScore: number } {
    // Simplified pattern analysis
    const lengths = paragraphs.map(p => p.length)
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length
    const repetitiveScore = 1 - (Math.sqrt(variance) / avgLength)
    
    return { repetitiveScore: Math.max(0, Math.min(1, repetitiveScore)) }
  }

  private hasConcreteExamples(content: string): boolean {
    const exampleIndicators = ['for example', 'for instance', 'such as', 'including', 'like', 'consider']
    return exampleIndicators.some(indicator => content.toLowerCase().includes(indicator))
  }

  private hasVariedSentenceStructure(content: string): boolean {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const lengths = sentences.map(s => s.split(/\s+/).length)
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length
    return Math.sqrt(variance) > 3 // Good variety if standard deviation > 3
  }

  private hasTopicSentence(paragraph: string): boolean {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length === 0) return false
    
    const firstSentence = sentences[0]
    // Simple heuristic: topic sentences are often longer and contain key terms
    return firstSentence.split(/\s+/).length > 8
  }

  private hasEngagingLanguage(content: string): boolean {
    const engagingWords = ['fascinating', 'remarkable', 'surprising', 'incredible', 'amazing', 'compelling', 'intriguing']
    const engagingCount = engagingWords.reduce((count, word) => 
      count + (content.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    )
    return engagingCount > 0
  }

  private interpretToneDescription(description: string): number {
    const lowerDesc = description.toLowerCase()
    if (lowerDesc.includes('casual') || lowerDesc.includes('informal') || lowerDesc.includes('conversational')) {
      return 0.5
    }
    if (lowerDesc.includes('formal') || lowerDesc.includes('academic') || lowerDesc.includes('professional')) {
      return -0.5
    }
    return 0 // Neutral
  }

  private detectVocabularyInconsistencies(content: string): StyleIssue[] {
    // Simplified vocabulary consistency check
    const issues: StyleIssue[] = []
    const paragraphs = content.split(/\n\s*\n/)
    
    // Check for mixing of formal and informal vocabulary
    let formalCount = 0
    let informalCount = 0
    
    paragraphs.forEach((paragraph, index) => {
      const formalWords = ['therefore', 'furthermore', 'consequently', 'nevertheless']
      const informalWords = ['really', 'pretty', 'quite', 'totally']
      
      const paraFormal = formalWords.some(word => paragraph.toLowerCase().includes(word))
      const paraInformal = informalWords.some(word => paragraph.toLowerCase().includes(word))
      
      if (paraFormal) formalCount++
      if (paraInformal) informalCount++
    })
    
    if (formalCount > 0 && informalCount > 0 && Math.abs(formalCount - informalCount) < paragraphs.length * 0.3) {
      issues.push({
        type: 'vocabulary_level_mismatch',
        severity: 'medium',
        location: { paragraphIndex: 0, startChar: 0, endChar: content.length },
        description: 'Inconsistent vocabulary level throughout the text',
        currentValue: 'Mixed formal and informal vocabulary',
        suggestedValue: 'Choose consistent vocabulary level'
      })
    }
    
    return issues
  } 
 /**
   * Analyze argument structure
   */
  private analyzeArgumentStructure(content: string): ArgumentStructure {
    const hasThesis = this.detectThesis(content)
    const thesisStrength = hasThesis ? this.calculateThesisStrength(content) : 0
    
    const supportingPoints = this.extractSupportingPoints(content)
    const counterarguments = this.extractCounterarguments(content)
    const evidenceQuality = this.assessEvidenceQuality(content)
    const conclusionStrength = this.assessConclusionStrength(content)
    
    return {
      hasThesis,
      thesisStrength,
      supportingPoints,
      counterarguments,
      evidenceQuality,
      conclusionStrength,
    }
  }

  /**
   * Analyze logical flow
   */
  private analyzeLogicalFlow(content: string): LogicalFlowAnalysis {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    
    const transitionQuality = this.assessTransitionQuality(paragraphs)
    const paragraphCoherence = paragraphs.map(p => this.assessParagraphCoherence(p))
    const overallProgression = this.determineProgressionType(paragraphs)
    const flowIssues = this.identifyFlowIssues(content, paragraphs)
    
    return {
      transitionQuality,
      paragraphCoherence,
      overallProgression,
      flowIssues,
    }
  }

  /**
   * Calculate coherence score
   */
  private calculateCoherenceScore(content: string): number {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    
    // Factors contributing to coherence
    const transitionScore = this.assessTransitionQuality(paragraphs)
    const topicConsistency = this.assessTopicConsistency(paragraphs)
    const logicalOrder = this.assessLogicalOrder(paragraphs)
    
    return (transitionScore + topicConsistency + logicalOrder) / 3
  }

  /**
   * Generate structure improvements
   */
  private generateStructureImprovements(
    argumentStructure: ArgumentStructure,
    logicalFlow: LogicalFlowAnalysis
  ): StructureImprovement[] {
    const improvements: StructureImprovement[] = []
    
    if (argumentStructure.thesisStrength < 0.6) {
      improvements.push({
        type: 'argument_strengthening',
        priority: 'high',
        description: 'Thesis statement needs strengthening',
        specificSuggestion: 'Make your thesis more specific, debatable, and clearly stated'
      })
    }
    
    if (logicalFlow.transitionQuality < 0.5) {
      improvements.push({
        type: 'flow_improvement',
        priority: 'medium',
        description: 'Improve transitions between paragraphs',
        specificSuggestion: 'Add transitional phrases and connecting sentences between ideas'
      })
    }
    
    if (argumentStructure.evidenceQuality < 0.5) {
      improvements.push({
        type: 'evidence_addition',
        priority: 'high',
        description: 'Add more supporting evidence',
        specificSuggestion: 'Include specific examples, statistics, or expert opinions to support your points'
      })
    }
    
    return improvements
  }

  // Additional analysis helper methods
  private calculateThesisStrength(content: string): number {
    // Simplified thesis strength calculation
    const thesisIndicators = ['argue that', 'believe that', 'contend that', 'propose that']
    const hasStrongIndicator = thesisIndicators.some(indicator => content.toLowerCase().includes(indicator))
    
    // Check if thesis is specific and debatable
    const hasSpecificity = content.length > 100 && content.split(/\s+/).length > 15
    const hasDebatableElements = ['should', 'must', 'need to', 'important', 'better'].some(word => 
      content.toLowerCase().includes(word)
    )
    
    let strength = 0.3 // Base score
    if (hasStrongIndicator) strength += 0.3
    if (hasSpecificity) strength += 0.2
    if (hasDebatableElements) strength += 0.2
    
    return Math.min(1, strength)
  }

  private extractSupportingPoints(content: string): SupportingPoint[] {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    const points: SupportingPoint[] = []
    
    paragraphs.forEach((paragraph, index) => {
      if (index > 0 && index < paragraphs.length - 1) { // Skip intro and conclusion
        const strength = this.assessPointStrength(paragraph)
        const evidenceSupport = this.extractEvidence(paragraph)
        
        points.push({
          content: paragraph.substring(0, 100) + '...',
          location: {
            paragraphIndex: index,
            startChar: content.indexOf(paragraph),
            endChar: content.indexOf(paragraph) + paragraph.length
          },
          strength,
          evidenceSupport,
          connections: [] // Could be enhanced with actual connection analysis
        })
      }
    })
    
    return points
  }

  private extractCounterarguments(content: string): CounterArgument[] {
    const counterIndicators = ['however', 'although', 'despite', 'critics argue', 'opponents claim', 'some believe']
    const counterarguments: CounterArgument[] = []
    
    counterIndicators.forEach(indicator => {
      const regex = new RegExp(`${indicator}[^.!?]*[.!?]`, 'gi')
      const matches = content.match(regex) || []
      
      matches.forEach(match => {
        const startChar = content.indexOf(match)
        counterarguments.push({
          content: match,
          location: {
            paragraphIndex: 0, // Could be enhanced with actual paragraph detection
            startChar,
            endChar: startChar + match.length
          },
          addressed: this.isCounterargumentAddressed(content, match),
          strength: 0.5 // Simplified strength assessment
        })
      })
    })
    
    return counterarguments
  }

  private assessEvidenceQuality(content: string): number {
    const evidenceIndicators = ['study shows', 'research indicates', 'according to', 'statistics', 'data', 'expert', 'professor']
    const evidenceCount = evidenceIndicators.reduce((count, indicator) => 
      count + (content.toLowerCase().match(new RegExp(`\\b${indicator}`, 'g')) || []).length, 0
    )
    
    const wordCount = content.split(/\s+/).length
    return Math.min(1, evidenceCount / (wordCount / 200)) // Normalize by content length
  }

  private assessConclusionStrength(content: string): number {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    if (paragraphs.length === 0) return 0
    
    const lastParagraph = paragraphs[paragraphs.length - 1]
    const conclusionIndicators = ['in conclusion', 'therefore', 'thus', 'ultimately', 'in summary']
    const hasIndicator = conclusionIndicators.some(indicator => lastParagraph.toLowerCase().includes(indicator))
    
    const hasCallToAction = ['should', 'must', 'need to', 'important'].some(word => 
      lastParagraph.toLowerCase().includes(word)
    )
    
    let strength = 0.2 // Base score
    if (hasIndicator) strength += 0.4
    if (hasCallToAction) strength += 0.2
    if (lastParagraph.length > 100) strength += 0.2
    
    return Math.min(1, strength)
  }

  private assessTransitionQuality(paragraphs: string[]): number {
    if (paragraphs.length <= 1) return 1
    
    let transitionCount = 0
    for (let i = 1; i < paragraphs.length; i++) {
      if (this.hasTransitionElements(paragraphs[i]) || this.hasTopicConnection(paragraphs[i-1], paragraphs[i])) {
        transitionCount++
      }
    }
    
    return transitionCount / (paragraphs.length - 1)
  }

  private assessParagraphCoherence(paragraph: string): number {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length <= 1) return 1
    
    // Simple coherence check based on keyword overlap between sentences
    let coherenceScore = 0
    for (let i = 1; i < sentences.length; i++) {
      if (this.hasTopicConnection(sentences[i-1], sentences[i])) {
        coherenceScore++
      }
    }
    
    return coherenceScore / (sentences.length - 1)
  }

  private determineProgressionType(paragraphs: string[]): LogicalFlowAnalysis['overallProgression'] {
    // Simplified progression analysis
    if (paragraphs.length < 3) return 'linear'
    
    const hasIntroConclusion = this.hasHookElements(paragraphs[0]) && this.hasConclusionElements(paragraphs[paragraphs.length - 1])
    if (hasIntroConclusion) return 'linear'
    
    return 'building' // Default assumption
  }

  private assessTopicConsistency(paragraphs: string[]): number {
    if (paragraphs.length <= 1) return 1
    
    // Extract key terms from first paragraph as topic baseline
    const firstParagraphWords = paragraphs[0].toLowerCase().split(/\s+/).filter(w => w.length > 4)
    const keyTerms = firstParagraphWords.slice(0, 10) // Use first 10 significant words
    
    let consistencyScore = 0
    paragraphs.slice(1).forEach(paragraph => {
      const paragraphWords = paragraph.toLowerCase().split(/\s+/)
      const overlap = keyTerms.filter(term => paragraphWords.includes(term))
      consistencyScore += overlap.length / keyTerms.length
    })
    
    return consistencyScore / (paragraphs.length - 1)
  }

  private assessLogicalOrder(paragraphs: string[]): number {
    // Simplified logical order assessment
    // Check for chronological or importance-based ordering indicators
    const orderIndicators = ['first', 'second', 'third', 'next', 'then', 'finally', 'most important', 'furthermore']
    
    let orderScore = 0
    paragraphs.forEach(paragraph => {
      if (orderIndicators.some(indicator => paragraph.toLowerCase().includes(indicator))) {
        orderScore++
      }
    })
    
    return Math.min(1, orderScore / Math.max(paragraphs.length * 0.3, 1))
  }

  private assessPointStrength(paragraph: string): number {
    const hasEvidence = this.extractEvidence(paragraph).length > 0
    const hasExamples = this.hasConcreteExamples(paragraph)
    const isSubstantial = paragraph.length > 150
    
    let strength = 0.2 // Base score
    if (hasEvidence) strength += 0.4
    if (hasExamples) strength += 0.2
    if (isSubstantial) strength += 0.2
    
    return Math.min(1, strength)
  }

  private extractEvidence(paragraph: string): string[] {
    const evidenceIndicators = ['study', 'research', 'data', 'statistics', 'according to', 'expert']
    const evidence: string[] = []
    
    evidenceIndicators.forEach(indicator => {
      if (paragraph.toLowerCase().includes(indicator)) {
        evidence.push(indicator)
      }
    })
    
    return evidence
  }

  private isCounterargumentAddressed(content: string, counterargument: string): boolean {
    const counterIndex = content.indexOf(counterargument)
    const afterCounter = content.substring(counterIndex + counterargument.length, counterIndex + counterargument.length + 200)
    
    const responseIndicators = ['however', 'but', 'nevertheless', 'despite this', 'in response']
    return responseIndicators.some(indicator => afterCounter.toLowerCase().includes(indicator))
  }  /**

   * Update user style profile based on interaction
   */
  private async updateUserStyleProfile(userId: string, request: AgentRequest, response: AgentResponse): Promise<void> {
    try {
      let profile = this.userStyleProfiles.get(userId)
      
      if (!profile) {
        profile = {
          userId,
          preferredStyles: [],
          learningHistory: [],
          adaptationLevel: 0,
          lastUpdated: new Date(),
        }
      }
      
      // Add learning entry based on the interaction
      const learningEntry: StyleLearningEntry = {
        timestamp: new Date(),
        userFeedback: 'neutral', // Would be updated based on actual user feedback
        suggestionType: 'general_refinement',
        context: request.content.substring(0, 100),
        outcome: 'accepted', // Would be updated based on user actions
      }
      
      profile.learningHistory.push(learningEntry)
      
      // Keep only recent history (last 50 interactions)
      if (profile.learningHistory.length > 50) {
        profile.learningHistory = profile.learningHistory.slice(-50)
      }
      
      // Update adaptation level
      profile.adaptationLevel = Math.min(1, profile.learningHistory.length / 20)
      profile.lastUpdated = new Date()
      
      this.userStyleProfiles.set(userId, profile)
      
      logger.debug(`Updated style profile for user ${userId}`, {
        adaptationLevel: profile.adaptationLevel,
        historyLength: profile.learningHistory.length,
      })
    } catch (error) {
      logger.error(`Failed to update user style profile for ${userId}:`, error)
    }
  }

  /**
   * Extract refinement suggestions from LLM response
   */
  private extractRefinementSuggestions(content: string): Suggestion[] {
    const suggestions: Suggestion[] = []
    
    // Look for improvement patterns
    const improvementPatterns = [
      /consider (.*?)[.!?]/gi,
      /try (.*?)[.!?]/gi,
      /you could (.*?)[.!?]/gi,
      /might want to (.*?)[.!?]/gi,
    ]
    
    improvementPatterns.forEach(pattern => {
      const matches = content.match(pattern) || []
      matches.slice(0, 2).forEach(match => {
        suggestions.push(this.createSuggestion(
          'improvement',
          'Style Improvement',
          match.replace(pattern, '$1').trim(),
          'medium'
        ))
      })
    })
    
    // Look for specific action items
    const actionPatterns = [
      /add (.*?)[.!?]/gi,
      /remove (.*?)[.!?]/gi,
      /change (.*?)[.!?]/gi,
      /revise (.*?)[.!?]/gi,
    ]
    
    actionPatterns.forEach(pattern => {
      const matches = content.match(pattern) || []
      matches.slice(0, 1).forEach(match => {
        suggestions.push(this.createSuggestion(
          'action',
          'Revision Action',
          match.trim(),
          'high'
        ))
      })
    })
    
    return suggestions.slice(0, 5) // Limit to 5 suggestions
  }

  /**
   * Generate next steps for refinement
   */
  private generateRefinementNextSteps(content: string): string[] {
    const steps = [
      'Review and implement the suggested improvements',
      'Focus on one area of improvement at a time',
      'Read your draft aloud to check flow and rhythm',
    ]
    
    // Add context-specific steps
    if (content.toLowerCase().includes('structure')) {
      steps.push('Create an outline to check logical organization')
    }
    
    if (content.toLowerCase().includes('style')) {
      steps.push('Read examples from your reference writers')
    }
    
    if (content.toLowerCase().includes('argument')) {
      steps.push('Gather additional evidence to support your points')
    }
    
    return steps.slice(0, 4)
  }

  /**
   * Calculate confidence for refinement responses
   */
  private calculateRefinementConfidence(content: string): number {
    let confidence = 0.7 // Base confidence
    
    // Increase confidence for detailed analysis
    if (content.length > 800) confidence += 0.1
    if (content.length > 1200) confidence += 0.1
    
    // Increase confidence for specific suggestions
    const specificWords = ['specific', 'particular', 'exactly', 'precisely']
    const specificCount = specificWords.reduce((count, word) => 
      count + (content.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    )
    confidence += Math.min(specificCount * 0.02, 0.1)
    
    // Increase confidence for structured feedback
    if (content.includes('1.') || content.includes('•') || content.includes('-')) {
      confidence += 0.05
    }
    
    return Math.min(confidence, 1.0)
  }

  /**
   * Calculate style consistency across the text
   */
  private calculateStyleConsistency(content: string): number {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    if (paragraphs.length <= 1) return 1
    
    const styles = paragraphs.map(p => this.extractStyleProfile(p))
    
    // Calculate variance in key style metrics
    const toneVariance = this.calculateVariance(styles.map(s => s.toneScore))
    const complexityVariance = this.calculateVariance(styles.map(s => s.complexityScore))
    const sentenceLengthVariance = this.calculateVariance(styles.map(s => s.averageSentenceLength))
    
    // Convert variance to consistency score (lower variance = higher consistency)
    const toneConsistency = Math.max(0, 1 - toneVariance * 2)
    const complexityConsistency = Math.max(0, 1 - complexityVariance * 2)
    const lengthConsistency = Math.max(0, 1 - (sentenceLengthVariance / 100))
    
    return (toneConsistency + complexityConsistency + lengthConsistency) / 3
  }

  /**
   * Calculate variance for an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length <= 1) return 0
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  /**
   * Estimate average syllables per word (simplified)
   */
  private estimateAverageSyllables(content: string): number {
    const words = content.split(/\s+/).filter(w => w.length > 0)
    const totalSyllables = words.reduce((total, word) => {
      // Simple syllable estimation: count vowel groups
      const vowelGroups = word.toLowerCase().match(/[aeiouy]+/g) || []
      return total + Math.max(1, vowelGroups.length)
    }, 0)
    
    return totalSyllables / Math.max(words.length, 1)
  }

  /**
   * Generate cache key for analysis results
   */
  private generateCacheKey(content: string): string {
    // Simple hash function for caching
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `draft_${Math.abs(hash)}`
  }

  // Protected method implementations
  protected async performInitialization(): Promise<void> {
    logger.info('Initializing Refiner agent')
    this.userStyleProfiles.clear()
    this.analysisCache.clear()
  }

  protected async performCleanup(): Promise<void> {
    logger.info('Cleaning up Refiner agent')
    this.userStyleProfiles.clear()
    this.analysisCache.clear()
  }

  protected async performHealthCheck(): Promise<boolean> {
    return this.initialized && await this.llmService.healthCheck().then(h => h.status === 'healthy')
  }

  protected async getSpecificMetrics(): Promise<Record<string, any>> {
    return {
      userStyleProfiles: this.userStyleProfiles.size,
      cachedAnalyses: this.analysisCache.size,
      referenceWriters: Object.keys(REFERENCE_WRITERS).length,
      styleFrameworks: Object.keys(STYLE_FRAMEWORKS).length,
    }
  }
}