import { logger } from '../utils/logger.js'
import { z } from 'zod'

// Prompt template schema
const PromptTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  agentType: z.enum(['IDEATION', 'REFINER', 'MEDIA', 'FACTCHECKER']),
  template: z.string(),
  variables: z.array(z.string()),
  systemContext: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
  costOptimized: z.boolean().default(false),
  version: z.string().default('1.0'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
})

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>

// Prompt performance metrics
export interface PromptPerformance {
  templateId: string
  averageCost: number
  averageTokens: number
  successRate: number
  averageResponseTime: number
  usageCount: number
  lastUsed: Date
  costEfficiencyScore: number // Higher is better
}

// Variable substitution context
export interface PromptContext {
  [key: string]: string | number | boolean
}

export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map()
  private performanceMetrics: Map<string, PromptPerformance> = new Map()

  constructor() {
    this.initializeDefaultTemplates()
    logger.info('Prompt Manager initialized with default templates')
  }

  /**
   * Initialize default cost-optimized prompt templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: PromptTemplate[] = [
      // Ideation Agent Templates
      {
        id: 'ideation-brainstorm-v1',
        name: 'Brainstorming Assistant',
        description: 'Cost-optimized brainstorming prompt for idea generation',
        agentType: 'IDEATION',
        template: `Help brainstorm ideas for: {{topic}}

Context: {{context}}

Generate 3-5 specific, actionable ideas. Be concise and creative.`,
        variables: ['topic', 'context'],
        systemContext: 'You are a creative writing assistant focused on generating practical, actionable ideas. Keep responses concise to minimize token usage.',
        maxTokens: 300,
        temperature: 0.8,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['brainstorming', 'ideation', 'cost-optimized'],
      },
      {
        id: 'ideation-structure-v1',
        name: 'Concept Structuring',
        description: 'Organize and structure initial concepts',
        agentType: 'IDEATION',
        template: `Structure these ideas into a logical outline:

Ideas: {{ideas}}

Create a clear, hierarchical outline with main points and sub-points.`,
        variables: ['ideas'],
        systemContext: 'You are an expert at organizing ideas into clear, logical structures. Provide concise, well-organized outlines.',
        maxTokens: 400,
        temperature: 0.3,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['structuring', 'organization', 'cost-optimized'],
      },

      // Draft Refiner Templates
      {
        id: 'refiner-structure-v1',
        name: 'Structure Analysis',
        description: 'Analyze and improve content structure',
        agentType: 'REFINER',
        template: `Analyze the structure of this content and suggest improvements:

Content: {{content}}

Focus on:
1. Logical flow
2. Argument strength
3. Clarity improvements

Provide specific, actionable suggestions.`,
        variables: ['content'],
        systemContext: 'You are an expert editor focused on content structure and flow. Provide specific, actionable feedback to improve clarity and argument strength.',
        maxTokens: 500,
        temperature: 0.2,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['structure', 'editing', 'cost-optimized'],
      },
      {
        id: 'refiner-style-v1',
        name: 'Style Refinement',
        description: 'Refine writing style based on reference',
        agentType: 'REFINER',
        template: `Refine this content to match the specified style:

Content: {{content}}
Style Reference: {{styleReference}}
Target Audience: {{audience}}

Provide specific style improvements while maintaining the original meaning.`,
        variables: ['content', 'styleReference', 'audience'],
        systemContext: 'You are a style editor who adapts content to match specific writing styles and audiences. Focus on tone, voice, and clarity.',
        maxTokens: 600,
        temperature: 0.3,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['style', 'refinement', 'cost-optimized'],
      },

      // Media Agent Templates
      {
        id: 'media-meme-v1',
        name: 'Meme Generation',
        description: 'Generate meme concepts and text',
        agentType: 'MEDIA',
        template: `Create a meme concept for this content:

Topic: {{topic}}
Context: {{context}}

Suggest:
1. Meme format/template
2. Top text
3. Bottom text
4. Why it's relevant

Keep it appropriate and engaging.`,
        variables: ['topic', 'context'],
        systemContext: 'You are a creative content creator who understands popular meme formats and internet culture. Create engaging, appropriate memes.',
        maxTokens: 200,
        temperature: 0.7,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['meme', 'visual', 'cost-optimized'],
      },
      {
        id: 'media-image-search-v1',
        name: 'Image Search Query',
        description: 'Generate optimized image search queries',
        agentType: 'MEDIA',
        template: `Generate 3 specific image search queries for:

Content: {{content}}
Purpose: {{purpose}}

Provide diverse, specific search terms that would find relevant, high-quality images.`,
        variables: ['content', 'purpose'],
        systemContext: 'You are an expert at finding relevant visual content. Generate specific, effective search queries.',
        maxTokens: 150,
        temperature: 0.4,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['images', 'search', 'cost-optimized'],
      },

      // Fact-Checker Templates
      {
        id: 'factcheck-claims-v1',
        name: 'Claim Identification',
        description: 'Identify factual claims in content',
        agentType: 'FACTCHECKER',
        template: `Identify factual claims in this content that need verification:

Content: {{content}}

List specific claims that can be fact-checked, focusing on:
1. Statistics
2. Historical facts
3. Scientific claims
4. Current events

Be concise and specific.`,
        variables: ['content'],
        systemContext: 'You are a fact-checker who identifies verifiable claims in content. Focus on claims that can be objectively verified.',
        maxTokens: 300,
        temperature: 0.1,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['fact-checking', 'claims', 'cost-optimized'],
      },
      {
        id: 'factcheck-seo-v1',
        name: 'SEO Optimization',
        description: 'Suggest SEO improvements',
        agentType: 'FACTCHECKER',
        template: `Suggest SEO improvements for this content:

Content: {{content}}
Target Keywords: {{keywords}}

Provide:
1. Title optimization
2. Meta description
3. Internal linking opportunities
4. Content structure improvements

Be specific and actionable.`,
        variables: ['content', 'keywords'],
        systemContext: 'You are an SEO expert who optimizes content for search engines while maintaining readability and value.',
        maxTokens: 400,
        temperature: 0.2,
        model: 'gpt-3.5-turbo',
        costOptimized: true,
        tags: ['seo', 'optimization', 'cost-optimized'],
      },
    ]

    // Load templates into memory
    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template)
    })
  }

  /**
   * Get a prompt template by ID
   */
  getTemplate(templateId: string): PromptTemplate | null {
    return this.templates.get(templateId) || null
  }

  /**
   * Get all templates for a specific agent type
   */
  getTemplatesByAgent(agentType: PromptTemplate['agentType']): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(
      template => template.agentType === agentType
    )
  }

  /**
   * Get cost-optimized templates
   */
  getCostOptimizedTemplates(agentType?: PromptTemplate['agentType']): PromptTemplate[] {
    let templates = Array.from(this.templates.values()).filter(
      template => template.costOptimized
    )

    if (agentType) {
      templates = templates.filter(template => template.agentType === agentType)
    }

    // Sort by cost efficiency score
    return templates.sort((a, b) => {
      const aScore = this.performanceMetrics.get(a.id)?.costEfficiencyScore || 0
      const bScore = this.performanceMetrics.get(b.id)?.costEfficiencyScore || 0
      return bScore - aScore
    })
  }

  /**
   * Render a prompt template with variables
   */
  renderPrompt(templateId: string, context: PromptContext): {
    prompt: string
    systemContext?: string
    config: {
      maxTokens?: number
      temperature?: number
      model?: string
    }
  } | null {
    const template = this.getTemplate(templateId)
    if (!template) {
      logger.error(`Template not found: ${templateId}`)
      return null
    }

    try {
      // Replace variables in template
      let prompt = template.template
      template.variables.forEach(variable => {
        const value = context[variable]
        if (value !== undefined) {
          prompt = prompt.replace(
            new RegExp(`{{${variable}}}`, 'g'),
            String(value)
          )
        }
      })

      // Check for unreplaced variables
      const unreplacedVars = prompt.match(/{{(\w+)}}/g)
      if (unreplacedVars) {
        logger.warn(`Unreplaced variables in template ${templateId}:`, unreplacedVars)
      }

      return {
        prompt,
        systemContext: template.systemContext,
        config: {
          maxTokens: template.maxTokens,
          temperature: template.temperature,
          model: template.model,
        },
      }
    } catch (error) {
      logger.error(`Error rendering template ${templateId}:`, error)
      return null
    }
  }

  /**
   * Add or update a prompt template
   */
  addTemplate(template: PromptTemplate): void {
    try {
      const validatedTemplate = PromptTemplateSchema.parse(template)
      this.templates.set(validatedTemplate.id, validatedTemplate)
      logger.info(`Template added/updated: ${validatedTemplate.id}`)
    } catch (error) {
      logger.error('Invalid template schema:', error)
      throw new Error('Invalid template schema')
    }
  }

  /**
   * Remove a template
   */
  removeTemplate(templateId: string): boolean {
    const deleted = this.templates.delete(templateId)
    if (deleted) {
      this.performanceMetrics.delete(templateId)
      logger.info(`Template removed: ${templateId}`)
    }
    return deleted
  }

  /**
   * Record performance metrics for a template
   */
  recordPerformance(
    templateId: string,
    metrics: {
      cost: number
      tokens: number
      responseTime: number
      success: boolean
    }
  ): void {
    const existing = this.performanceMetrics.get(templateId) || {
      templateId,
      averageCost: 0,
      averageTokens: 0,
      successRate: 0,
      averageResponseTime: 0,
      usageCount: 0,
      lastUsed: new Date(),
      costEfficiencyScore: 0,
    }

    // Update metrics using running averages
    const newCount = existing.usageCount + 1
    existing.averageCost = (existing.averageCost * existing.usageCount + metrics.cost) / newCount
    existing.averageTokens = (existing.averageTokens * existing.usageCount + metrics.tokens) / newCount
    existing.averageResponseTime = (existing.averageResponseTime * existing.usageCount + metrics.responseTime) / newCount
    
    // Update success rate
    const successCount = existing.successRate * existing.usageCount + (metrics.success ? 1 : 0)
    existing.successRate = successCount / newCount
    
    existing.usageCount = newCount
    existing.lastUsed = new Date()

    // Calculate cost efficiency score (success rate / average cost)
    existing.costEfficiencyScore = existing.successRate / Math.max(existing.averageCost, 0.001)

    this.performanceMetrics.set(templateId, existing)

    logger.debug(`Performance recorded for template ${templateId}:`, {
      cost: metrics.cost,
      tokens: metrics.tokens,
      success: metrics.success,
      newScore: existing.costEfficiencyScore,
    })
  }

  /**
   * Get performance metrics for a template
   */
  getPerformanceMetrics(templateId: string): PromptPerformance | null {
    return this.performanceMetrics.get(templateId) || null
  }

  /**
   * Get all performance metrics
   */
  getAllPerformanceMetrics(): PromptPerformance[] {
    return Array.from(this.performanceMetrics.values())
  }

  /**
   * Get template recommendations based on performance and cost
   */
  getRecommendedTemplate(
    agentType: PromptTemplate['agentType'],
    prioritizeCost = true
  ): PromptTemplate | null {
    const templates = this.getTemplatesByAgent(agentType)
    
    if (templates.length === 0) {
      return null
    }

    if (prioritizeCost) {
      // Sort by cost efficiency score
      const templatesWithMetrics = templates
        .map(template => ({
          template,
          metrics: this.performanceMetrics.get(template.id),
        }))
        .filter(item => item.metrics)
        .sort((a, b) => (b.metrics!.costEfficiencyScore - a.metrics!.costEfficiencyScore))

      if (templatesWithMetrics.length > 0) {
        return templatesWithMetrics[0].template
      }
    }

    // Fallback to cost-optimized templates
    const costOptimized = templates.filter(t => t.costOptimized)
    return costOptimized[0] || templates[0]
  }

  /**
   * Export templates for backup/sharing
   */
  exportTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * Import templates from backup
   */
  importTemplates(templates: PromptTemplate[]): void {
    templates.forEach(template => {
      try {
        this.addTemplate(template)
      } catch (error) {
        logger.error(`Failed to import template ${template.id}:`, error)
      }
    })
  }

  /**
   * Get template usage statistics
   */
  getUsageStatistics(): {
    totalTemplates: number
    totalUsage: number
    averageCostEfficiency: number
    mostUsedTemplate: string | null
    leastUsedTemplate: string | null
  } {
    const metrics = Array.from(this.performanceMetrics.values())
    
    const totalUsage = metrics.reduce((sum, m) => sum + m.usageCount, 0)
    const averageCostEfficiency = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.costEfficiencyScore, 0) / metrics.length
      : 0

    const mostUsed = metrics.reduce((max, m) => 
      m.usageCount > (max?.usageCount || 0) ? m : max, null as PromptPerformance | null)
    
    const leastUsed = metrics.reduce((min, m) => 
      m.usageCount < (min?.usageCount || Infinity) ? m : min, null as PromptPerformance | null)

    return {
      totalTemplates: this.templates.size,
      totalUsage,
      averageCostEfficiency,
      mostUsedTemplate: mostUsed?.templateId || null,
      leastUsedTemplate: leastUsed?.templateId || null,
    }
  }
}

// Export singleton instance
export const promptManager = new PromptManager()