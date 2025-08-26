import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptManager, PromptTemplate } from '../../services/prompt-manager.js'

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('PromptManager', () => {
  let promptManager: PromptManager

  beforeEach(() => {
    promptManager = new PromptManager()
  })

  describe('initialization', () => {
    it('should initialize with default templates', () => {
      const ideationTemplates = promptManager.getTemplatesByAgent('IDEATION')
      const refinerTemplates = promptManager.getTemplatesByAgent('REFINER')
      const mediaTemplates = promptManager.getTemplatesByAgent('MEDIA')
      const factcheckTemplates = promptManager.getTemplatesByAgent('FACTCHECKER')

      expect(ideationTemplates.length).toBeGreaterThan(0)
      expect(refinerTemplates.length).toBeGreaterThan(0)
      expect(mediaTemplates.length).toBeGreaterThan(0)
      expect(factcheckTemplates.length).toBeGreaterThan(0)
    })

    it('should have cost-optimized templates', () => {
      const costOptimized = promptManager.getCostOptimizedTemplates()
      expect(costOptimized.length).toBeGreaterThan(0)
      expect(costOptimized.every(t => t.costOptimized)).toBe(true)
    })
  })

  describe('getTemplate', () => {
    it('should return template by ID', () => {
      const template = promptManager.getTemplate('ideation-brainstorm-v1')
      expect(template).toBeDefined()
      expect(template?.id).toBe('ideation-brainstorm-v1')
      expect(template?.agentType).toBe('IDEATION')
    })

    it('should return null for non-existent template', () => {
      const template = promptManager.getTemplate('non-existent')
      expect(template).toBeNull()
    })
  })

  describe('getTemplatesByAgent', () => {
    it('should return templates for specific agent type', () => {
      const ideationTemplates = promptManager.getTemplatesByAgent('IDEATION')
      expect(ideationTemplates.every(t => t.agentType === 'IDEATION')).toBe(true)
    })

    it('should return empty array for agent with no templates', () => {
      // Remove all templates first
      const allTemplates = promptManager.exportTemplates()
      allTemplates.forEach(t => promptManager.removeTemplate(t.id))

      const templates = promptManager.getTemplatesByAgent('IDEATION')
      expect(templates).toEqual([])
    })
  })

  describe('getCostOptimizedTemplates', () => {
    it('should return only cost-optimized templates', () => {
      const costOptimized = promptManager.getCostOptimizedTemplates()
      expect(costOptimized.every(t => t.costOptimized)).toBe(true)
    })

    it('should filter by agent type when specified', () => {
      const ideationOptimized = promptManager.getCostOptimizedTemplates('IDEATION')
      expect(ideationOptimized.every(t => t.agentType === 'IDEATION' && t.costOptimized)).toBe(true)
    })

    it('should sort by cost efficiency score', () => {
      // Record some performance metrics
      promptManager.recordPerformance('ideation-brainstorm-v1', {
        cost: 0.001,
        tokens: 100,
        responseTime: 2000,
        success: true,
      })

      promptManager.recordPerformance('ideation-structure-v1', {
        cost: 0.005,
        tokens: 200,
        responseTime: 3000,
        success: true,
      })

      const optimized = promptManager.getCostOptimizedTemplates('IDEATION')
      expect(optimized.length).toBeGreaterThan(1)
      
      // First template should have higher efficiency score
      const firstMetrics = promptManager.getPerformanceMetrics(optimized[0].id)
      const secondMetrics = promptManager.getPerformanceMetrics(optimized[1].id)
      
      if (firstMetrics && secondMetrics) {
        expect(firstMetrics.costEfficiencyScore).toBeGreaterThanOrEqual(secondMetrics.costEfficiencyScore)
      }
    })
  })

  describe('renderPrompt', () => {
    it('should render template with variables', () => {
      const result = promptManager.renderPrompt('ideation-brainstorm-v1', {
        topic: 'AI in healthcare',
        context: 'Medical applications',
      })

      expect(result).toBeDefined()
      expect(result?.prompt).toContain('AI in healthcare')
      expect(result?.prompt).toContain('Medical applications')
      expect(result?.systemContext).toBeDefined()
      expect(result?.config.maxTokens).toBe(300)
      expect(result?.config.temperature).toBe(0.8)
    })

    it('should return null for non-existent template', () => {
      const result = promptManager.renderPrompt('non-existent', {})
      expect(result).toBeNull()
    })

    it('should handle missing variables gracefully', () => {
      const result = promptManager.renderPrompt('ideation-brainstorm-v1', {
        topic: 'AI in healthcare',
        // Missing 'context' variable
      })

      expect(result).toBeDefined()
      expect(result?.prompt).toContain('AI in healthcare')
      expect(result?.prompt).toContain('{{context}}') // Unreplaced variable
    })

    it('should replace all instances of variables', () => {
      // Create a template with repeated variables
      const testTemplate: PromptTemplate = {
        id: 'test-repeat',
        name: 'Test Repeat',
        description: 'Test template with repeated variables',
        agentType: 'IDEATION',
        template: 'Topic: {{topic}}. More about {{topic}}: {{topic}} is important.',
        variables: ['topic'],
        costOptimized: false,
        version: '1.0',
        tags: [],
      }

      promptManager.addTemplate(testTemplate)

      const result = promptManager.renderPrompt('test-repeat', {
        topic: 'AI',
      })

      expect(result?.prompt).toBe('Topic: AI. More about AI: AI is important.')
    })
  })

  describe('addTemplate', () => {
    it('should add valid template', () => {
      const newTemplate: PromptTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        agentType: 'IDEATION',
        template: 'Test prompt with {{variable}}',
        variables: ['variable'],
        costOptimized: true,
        version: '1.0',
        tags: ['test'],
      }

      promptManager.addTemplate(newTemplate)
      const retrieved = promptManager.getTemplate('test-template')
      expect(retrieved).toEqual(newTemplate)
    })

    it('should update existing template', () => {
      const template1: PromptTemplate = {
        id: 'test-update',
        name: 'Original',
        description: 'Original description',
        agentType: 'IDEATION',
        template: 'Original template',
        variables: [],
        costOptimized: false,
        version: '1.0',
        tags: [],
      }

      const template2: PromptTemplate = {
        ...template1,
        name: 'Updated',
        description: 'Updated description',
      }

      promptManager.addTemplate(template1)
      promptManager.addTemplate(template2)

      const retrieved = promptManager.getTemplate('test-update')
      expect(retrieved?.name).toBe('Updated')
      expect(retrieved?.description).toBe('Updated description')
    })

    it('should throw error for invalid template', () => {
      const invalidTemplate = {
        id: 'invalid',
        // Missing required fields
      }

      expect(() => {
        promptManager.addTemplate(invalidTemplate as PromptTemplate)
      }).toThrow('Invalid template schema')
    })
  })

  describe('removeTemplate', () => {
    it('should remove existing template', () => {
      const templateId = 'ideation-brainstorm-v1'
      expect(promptManager.getTemplate(templateId)).toBeDefined()

      const removed = promptManager.removeTemplate(templateId)
      expect(removed).toBe(true)
      expect(promptManager.getTemplate(templateId)).toBeNull()
    })

    it('should return false for non-existent template', () => {
      const removed = promptManager.removeTemplate('non-existent')
      expect(removed).toBe(false)
    })

    it('should remove performance metrics when removing template', () => {
      const templateId = 'test-remove-metrics'
      const template: PromptTemplate = {
        id: templateId,
        name: 'Test Remove',
        description: 'Test template for removal',
        agentType: 'IDEATION',
        template: 'Test',
        variables: [],
        costOptimized: false,
        version: '1.0',
        tags: [],
      }

      promptManager.addTemplate(template)
      promptManager.recordPerformance(templateId, {
        cost: 0.001,
        tokens: 100,
        responseTime: 1000,
        success: true,
      })

      expect(promptManager.getPerformanceMetrics(templateId)).toBeDefined()

      promptManager.removeTemplate(templateId)
      expect(promptManager.getPerformanceMetrics(templateId)).toBeNull()
    })
  })

  describe('recordPerformance', () => {
    const templateId = 'ideation-brainstorm-v1'

    it('should record performance metrics', () => {
      promptManager.recordPerformance(templateId, {
        cost: 0.002,
        tokens: 150,
        responseTime: 2500,
        success: true,
      })

      const metrics = promptManager.getPerformanceMetrics(templateId)
      expect(metrics).toBeDefined()
      expect(metrics?.averageCost).toBe(0.002)
      expect(metrics?.averageTokens).toBe(150)
      expect(metrics?.averageResponseTime).toBe(2500)
      expect(metrics?.successRate).toBe(1)
      expect(metrics?.usageCount).toBe(1)
    })

    it('should calculate running averages', () => {
      // First recording
      promptManager.recordPerformance(templateId, {
        cost: 0.001,
        tokens: 100,
        responseTime: 1000,
        success: true,
      })

      // Second recording
      promptManager.recordPerformance(templateId, {
        cost: 0.003,
        tokens: 200,
        responseTime: 3000,
        success: false,
      })

      const metrics = promptManager.getPerformanceMetrics(templateId)
      expect(metrics?.averageCost).toBe(0.002) // (0.001 + 0.003) / 2
      expect(metrics?.averageTokens).toBe(150) // (100 + 200) / 2
      expect(metrics?.averageResponseTime).toBe(2000) // (1000 + 3000) / 2
      expect(metrics?.successRate).toBe(0.5) // 1 success out of 2
      expect(metrics?.usageCount).toBe(2)
    })

    it('should calculate cost efficiency score', () => {
      promptManager.recordPerformance(templateId, {
        cost: 0.001,
        tokens: 100,
        responseTime: 1000,
        success: true,
      })

      const metrics = promptManager.getPerformanceMetrics(templateId)
      expect(metrics?.costEfficiencyScore).toBe(1 / 0.001) // successRate / averageCost
    })

    it('should update last used timestamp', () => {
      const beforeTime = new Date()
      
      promptManager.recordPerformance(templateId, {
        cost: 0.001,
        tokens: 100,
        responseTime: 1000,
        success: true,
      })

      const metrics = promptManager.getPerformanceMetrics(templateId)
      expect(metrics?.lastUsed.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
    })
  })

  describe('getRecommendedTemplate', () => {
    beforeEach(() => {
      // Set up some performance data
      promptManager.recordPerformance('ideation-brainstorm-v1', {
        cost: 0.001,
        tokens: 100,
        responseTime: 1000,
        success: true,
      })

      promptManager.recordPerformance('ideation-structure-v1', {
        cost: 0.005,
        tokens: 200,
        responseTime: 2000,
        success: true,
      })
    })

    it('should return template with best cost efficiency when prioritizing cost', () => {
      const recommended = promptManager.getRecommendedTemplate('IDEATION', true)
      expect(recommended?.id).toBe('ideation-brainstorm-v1') // Lower cost, higher efficiency
    })

    it('should return cost-optimized template as fallback', () => {
      const recommended = promptManager.getRecommendedTemplate('MEDIA', true)
      expect(recommended?.costOptimized).toBe(true)
    })

    it('should return null for agent with no templates', () => {
      // Remove all templates
      const allTemplates = promptManager.exportTemplates()
      allTemplates.forEach(t => promptManager.removeTemplate(t.id))

      const recommended = promptManager.getRecommendedTemplate('IDEATION')
      expect(recommended).toBeNull()
    })
  })

  describe('exportTemplates', () => {
    it('should export all templates', () => {
      const exported = promptManager.exportTemplates()
      expect(exported.length).toBeGreaterThan(0)
      expect(exported.every(t => t.id && t.name && t.agentType)).toBe(true)
    })
  })

  describe('importTemplates', () => {
    it('should import valid templates', () => {
      const templates: PromptTemplate[] = [
        {
          id: 'import-test-1',
          name: 'Import Test 1',
          description: 'Test import',
          agentType: 'IDEATION',
          template: 'Test {{var}}',
          variables: ['var'],
          costOptimized: true,
          version: '1.0',
          tags: ['import'],
        },
        {
          id: 'import-test-2',
          name: 'Import Test 2',
          description: 'Test import 2',
          agentType: 'REFINER',
          template: 'Test 2',
          variables: [],
          costOptimized: false,
          version: '1.0',
          tags: ['import'],
        },
      ]

      promptManager.importTemplates(templates)

      expect(promptManager.getTemplate('import-test-1')).toBeDefined()
      expect(promptManager.getTemplate('import-test-2')).toBeDefined()
    })

    it('should skip invalid templates during import', () => {
      const templates = [
        {
          id: 'valid-import',
          name: 'Valid',
          description: 'Valid template',
          agentType: 'IDEATION',
          template: 'Valid',
          variables: [],
          costOptimized: false,
          version: '1.0',
          tags: [],
        },
        {
          id: 'invalid-import',
          // Missing required fields
        },
      ] as PromptTemplate[]

      promptManager.importTemplates(templates)

      expect(promptManager.getTemplate('valid-import')).toBeDefined()
      expect(promptManager.getTemplate('invalid-import')).toBeNull()
    })
  })

  describe('getUsageStatistics', () => {
    it('should return usage statistics', () => {
      // Record some performance data
      promptManager.recordPerformance('ideation-brainstorm-v1', {
        cost: 0.001,
        tokens: 100,
        responseTime: 1000,
        success: true,
      })

      promptManager.recordPerformance('ideation-structure-v1', {
        cost: 0.002,
        tokens: 150,
        responseTime: 1500,
        success: true,
      })

      const stats = promptManager.getUsageStatistics()

      expect(stats.totalTemplates).toBeGreaterThan(0)
      expect(stats.totalUsage).toBe(2)
      expect(stats.averageCostEfficiency).toBeGreaterThan(0)
      expect(stats.mostUsedTemplate).toBeDefined()
      expect(stats.leastUsedTemplate).toBeDefined()
    })

    it('should handle no usage data', () => {
      const newManager = new PromptManager()
      const stats = newManager.getUsageStatistics()

      expect(stats.totalTemplates).toBeGreaterThan(0)
      expect(stats.totalUsage).toBe(0)
      expect(stats.averageCostEfficiency).toBe(0)
      expect(stats.mostUsedTemplate).toBeNull()
      expect(stats.leastUsedTemplate).toBeNull()
    })
  })
})