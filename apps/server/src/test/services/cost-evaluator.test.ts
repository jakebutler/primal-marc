import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CostEvaluator } from '../../services/cost-evaluator.js'
import { LLMUsageModel } from '../../models/llm-usage.js'
import { promptManager } from '../../services/prompt-manager.js'

vi.mock('../../models/llm-usage.js', () => ({
  LLMUsageModel: {
    checkBudgetStatus: vi.fn(),
    getUserUsageStats: vi.fn(),
    getDailyUsage: vi.fn(),
    getExpensiveRequests: vi.fn(),
  },
}))

vi.mock('../../services/prompt-manager.js', () => ({
  promptManager: {
    getPerformanceMetrics: vi.fn(),
    getAllPerformanceMetrics: vi.fn(),
  },
}))

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('CostEvaluator', () => {
  let costEvaluator: CostEvaluator

  beforeEach(() => {
    vi.clearAllMocks()
    costEvaluator = new CostEvaluator()
  })

  describe('evaluateTemplate', () => {
    const mockPerformance = {
      templateId: 'test-template',
      averageCost: 0.002,
      averageTokens: 150,
      successRate: 0.9,
      averageResponseTime: 2000,
      usageCount: 10,
      lastUsed: new Date(),
      costEfficiencyScore: 450, // successRate / averageCost
    }

    it('should evaluate template performance', async () => {
      vi.mocked(promptManager.getPerformanceMetrics).mockReturnValue(mockPerformance)

      const evaluation = await costEvaluator.evaluateTemplate('test-template')

      expect(evaluation).toBeDefined()
      expect(evaluation?.templateId).toBe('test-template')
      expect(evaluation?.costPerSuccess).toBeCloseTo(0.002 / 0.9)
      expect(evaluation?.tokenEfficiency).toBeCloseTo(0.9 / 150)
      expect(evaluation?.responseQuality).toBeGreaterThan(0)
      expect(evaluation?.overallScore).toBeGreaterThan(0)
      expect(evaluation?.recommendation).toBe('good')
      expect(evaluation?.suggestions).toBeInstanceOf(Array)
    })

    it('should return null for template with no performance data', async () => {
      vi.mocked(promptManager.getPerformanceMetrics).mockReturnValue(null)

      const evaluation = await costEvaluator.evaluateTemplate('non-existent')
      expect(evaluation).toBeNull()
    })

    it('should classify templates correctly by cost', async () => {
      // Excellent template (low cost per success)
      const excellentPerformance = {
        ...mockPerformance,
        averageCost: 0.0005,
        successRate: 1.0,
      }
      vi.mocked(promptManager.getPerformanceMetrics).mockReturnValue(excellentPerformance)

      const excellentEval = await costEvaluator.evaluateTemplate('excellent-template')
      expect(excellentEval?.recommendation).toBe('excellent')

      // Poor template (high cost per success)
      const poorPerformance = {
        ...mockPerformance,
        averageCost: 0.025,
        successRate: 0.5,
      }
      vi.mocked(promptManager.getPerformanceMetrics).mockReturnValue(poorPerformance)

      const poorEval = await costEvaluator.evaluateTemplate('poor-template')
      expect(poorEval?.recommendation).toBe('poor')
    })

    it('should generate appropriate suggestions', async () => {
      const highCostPerformance = {
        ...mockPerformance,
        averageCost: 0.01, // High cost
        successRate: 0.7, // Low success rate
        averageTokens: 1500, // High token usage
        averageResponseTime: 12000, // Slow response
        usageCount: 5, // Low usage count
      }
      vi.mocked(promptManager.getPerformanceMetrics).mockReturnValue(highCostPerformance)

      const evaluation = await costEvaluator.evaluateTemplate('high-cost-template')

      expect(evaluation?.suggestions).toContain('Consider optimizing prompt length to reduce token usage')
      expect(evaluation?.suggestions).toContain('Improve prompt clarity to increase success rate')
      expect(evaluation?.suggestions).toContain('Consider breaking down complex prompts into smaller parts')
      expect(evaluation?.suggestions).toContain('Consider using a faster model for time-sensitive requests')
      expect(evaluation?.suggestions).toContain('Collect more usage data for accurate performance evaluation')
    })
  })

  describe('evaluateAllTemplates', () => {
    const mockMetrics = [
      {
        templateId: 'excellent-template',
        averageCost: 0.0005,
        averageTokens: 100,
        successRate: 1.0,
        averageResponseTime: 1000,
        usageCount: 20,
        lastUsed: new Date(),
        costEfficiencyScore: 2000,
      },
      {
        templateId: 'good-template',
        averageCost: 0.003,
        averageTokens: 150,
        successRate: 0.9,
        averageResponseTime: 2000,
        usageCount: 15,
        lastUsed: new Date(),
        costEfficiencyScore: 300,
      },
      {
        templateId: 'poor-template',
        averageCost: 0.025,
        averageTokens: 300,
        successRate: 0.6,
        averageResponseTime: 5000,
        usageCount: 8,
        lastUsed: new Date(),
        costEfficiencyScore: 24,
      },
    ]

    it('should evaluate all templates and provide summary', async () => {
      vi.mocked(promptManager.getAllPerformanceMetrics).mockReturnValue(mockMetrics)
      vi.mocked(promptManager.getPerformanceMetrics)
        .mockReturnValueOnce(mockMetrics[0])
        .mockReturnValueOnce(mockMetrics[1])
        .mockReturnValueOnce(mockMetrics[2])

      const result = await costEvaluator.evaluateAllTemplates()

      expect(result.evaluations).toHaveLength(3)
      expect(result.summary.totalTemplates).toBe(3)
      expect(result.summary.excellentCount).toBe(1)
      expect(result.summary.goodCount).toBe(1)
      expect(result.summary.poorCount).toBe(1)
      expect(result.summary.averageScore).toBeGreaterThan(0)
      expect(result.summary.totalPotentialSavings).toBeGreaterThan(0)
    })
  })

  describe('checkBudgetAlerts', () => {
    const mockBudgetStatus = {
      monthlyBudget: 20,
      currentSpend: 16,
      remainingBudget: 4,
      budgetUsedPercent: 80,
      isApproachingLimit: true,
      isOverBudget: false,
      stats: {} as any,
    }

    const mockDailyUsage = [
      { date: '2024-01-01', cost: 2, tokens: 1000, requests: 10, agentBreakdown: {} },
      { date: '2024-01-02', cost: 2.5, tokens: 1200, requests: 12, agentBreakdown: {} },
      { date: '2024-01-03', cost: 1.8, tokens: 900, requests: 9, agentBreakdown: {} },
    ]

    beforeEach(() => {
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue(mockBudgetStatus)
      vi.mocked(LLMUsageModel.getDailyUsage).mockResolvedValue(mockDailyUsage)
    })

    it('should generate warning alert when approaching budget limit', async () => {
      const alerts = await costEvaluator.checkBudgetAlerts('test-user', 20)

      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('warning')
      expect(alerts[0].percentUsed).toBe(80)
      expect(alerts[0].projectedMonthlySpend).toBeCloseTo(2.1 * 30) // Average daily spend * 30
    })

    it('should generate critical alert when budget usage is critical', async () => {
      const criticalBudgetStatus = {
        ...mockBudgetStatus,
        currentSpend: 19,
        budgetUsedPercent: 95,
      }
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue(criticalBudgetStatus)

      const alerts = await costEvaluator.checkBudgetAlerts('test-user', 20)

      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('critical')
      expect(alerts[0].percentUsed).toBe(95)
    })

    it('should generate exceeded alert when budget is exceeded', async () => {
      const exceededBudgetStatus = {
        ...mockBudgetStatus,
        currentSpend: 22,
        budgetUsedPercent: 110,
        isOverBudget: true,
      }
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue(exceededBudgetStatus)

      const alerts = await costEvaluator.checkBudgetAlerts('test-user', 20)

      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('exceeded')
      expect(alerts[0].percentUsed).toBe(110)
    })

    it('should return empty array when budget is healthy', async () => {
      const healthyBudgetStatus = {
        ...mockBudgetStatus,
        currentSpend: 10,
        budgetUsedPercent: 50,
        isApproachingLimit: false,
      }
      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue(healthyBudgetStatus)

      const alerts = await costEvaluator.checkBudgetAlerts('test-user', 20)
      expect(alerts).toHaveLength(0)
    })
  })

  describe('generateOptimizationSuggestions', () => {
    const mockUsageStats = {
      totalCost: 15,
      totalTokens: 80000, // High token usage: 80000 / 50 = 1600 tokens per request (> 1500)
      requestCount: 50,
      averageCostPerRequest: 0.3,
      costByAgent: { IDEATION: 8, REFINER: 7 },
      costByModel: { 'gpt-4': 15 },
    }

    const mockExpensiveRequests = [
      {
        id: '1',
        agentType: 'IDEATION',
        model: 'gpt-4',
        cost: 0.05,
        totalTokens: 2000,
        createdAt: new Date(),
      },
      {
        id: '2',
        agentType: 'REFINER',
        model: 'gpt-4',
        cost: 0.04,
        totalTokens: 1800,
        createdAt: new Date(),
      },
    ]

    const mockDailyUsage = Array(7).fill(null).map((_, i) => ({
      date: `2024-01-${i + 1}`,
      cost: 3,
      tokens: 1500,
      requests: 60, // High request frequency: 60 > 50
      agentBreakdown: {},
    }))

    beforeEach(() => {
      vi.mocked(LLMUsageModel.getUserUsageStats).mockResolvedValue(mockUsageStats)
      vi.mocked(LLMUsageModel.getExpensiveRequests).mockResolvedValue(mockExpensiveRequests as any)
      vi.mocked(LLMUsageModel.getDailyUsage).mockResolvedValue(mockDailyUsage)
    })

    it('should suggest model downgrade for expensive requests', async () => {
      const suggestions = await costEvaluator.generateOptimizationSuggestions('test-user')

      const modelDowngrade = suggestions.find(s => s.type === 'model_downgrade')
      expect(modelDowngrade).toBeDefined()
      expect(modelDowngrade?.description).toContain('GPT-3.5-turbo instead of GPT-4')
      expect(modelDowngrade?.impact).toBe('high')
    })

    it('should suggest prompt optimization for high token usage', async () => {
      const suggestions = await costEvaluator.generateOptimizationSuggestions('test-user')

      const promptOptimization = suggestions.find(s => s.type === 'prompt_optimization')
      expect(promptOptimization).toBeDefined()
      expect(promptOptimization?.description).toContain('more tokens than average')
      expect(promptOptimization?.impact).toBe('medium')
    })

    it('should suggest rate limiting for high request frequency', async () => {
      const suggestions = await costEvaluator.generateOptimizationSuggestions('test-user')

      const rateLimiting = suggestions.find(s => s.type === 'rate_limiting')
      expect(rateLimiting).toBeDefined()
      expect(rateLimiting?.description).toContain('High request frequency')
      expect(rateLimiting?.impact).toBe('low')
    })

    it('should suggest template switching for poor templates', async () => {
      const mockEvaluations = {
        evaluations: [
          {
            templateId: 'poor-template',
            recommendation: 'poor' as const,
            costPerSuccess: 0.05,
            tokenEfficiency: 0.001,
            responseQuality: 0.5,
            overallScore: 0.2,
            suggestions: [],
          },
        ],
        summary: {
          totalTemplates: 1,
          excellentCount: 0,
          goodCount: 0,
          fairCount: 0,
          poorCount: 1,
          averageScore: 0.2,
          totalPotentialSavings: 5,
        },
      }

      // Mock the evaluateAllTemplates method
      const originalEvaluateAll = costEvaluator.evaluateAllTemplates
      costEvaluator.evaluateAllTemplates = vi.fn().mockResolvedValue(mockEvaluations)

      const suggestions = await costEvaluator.generateOptimizationSuggestions('test-user')

      const templateSwitch = suggestions.find(s => s.type === 'template_switch')
      expect(templateSwitch).toBeDefined()
      expect(templateSwitch?.description).toContain('poor cost efficiency')
      expect(templateSwitch?.impact).toBe('high')

      // Restore original method
      costEvaluator.evaluateAllTemplates = originalEvaluateAll
    })
  })

  describe('getCostTrends', () => {
    const mockDailyUsage = [
      // First week (days 1-7)
      { date: '2024-01-01', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      { date: '2024-01-02', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      { date: '2024-01-03', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      { date: '2024-01-04', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      { date: '2024-01-05', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      { date: '2024-01-06', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      { date: '2024-01-07', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      // Last week (days 8-14) - higher costs
      { date: '2024-01-08', cost: 3, tokens: 1500, requests: 15, agentBreakdown: {} },
      { date: '2024-01-09', cost: 3, tokens: 1500, requests: 15, agentBreakdown: {} },
      { date: '2024-01-10', cost: 3, tokens: 1500, requests: 15, agentBreakdown: {} },
      { date: '2024-01-11', cost: 3, tokens: 1500, requests: 15, agentBreakdown: {} },
      { date: '2024-01-12', cost: 3, tokens: 1500, requests: 15, agentBreakdown: {} },
      { date: '2024-01-13', cost: 3, tokens: 1500, requests: 15, agentBreakdown: {} },
      { date: '2024-01-14', cost: 3, tokens: 1500, requests: 15, agentBreakdown: {} },
    ]

    beforeEach(() => {
      vi.mocked(LLMUsageModel.getDailyUsage).mockResolvedValue(mockDailyUsage)
    })

    it('should calculate cost trends and projections', async () => {
      const trends = await costEvaluator.getCostTrends('test-user', 7)

      expect(trends.dailyTrends).toEqual(mockDailyUsage)
      // The average is calculated from the last 7 days: 3 * 7 = 21
      expect(trends.projections.nextWeekCost).toBeCloseTo(21) // 3 * 7
      expect(trends.projections.nextMonthCost).toBeCloseTo(90) // 3 * 30
      expect(trends.projections.yearEndCost).toBeCloseTo(1095) // 3 * 365
    })

    it('should generate insights about cost changes', async () => {
      const trends = await costEvaluator.getCostTrends('test-user', 14) // Use 14 days to have first and last week

      expect(trends.insights.some(insight => insight.includes('Costs increased by'))).toBe(true)
      expect(trends.insights.some(insight => insight.includes('Daily costs are above $1'))).toBe(true)
      expect(trends.insights.some(insight => insight.includes('Projected monthly costs exceed $20'))).toBe(true)
    })

    it('should handle decreasing cost trends', async () => {
      const decreasingUsage = [
        // First week (high costs)
        { date: '2024-01-01', cost: 4, tokens: 2000, requests: 20, agentBreakdown: {} },
        { date: '2024-01-02', cost: 4, tokens: 2000, requests: 20, agentBreakdown: {} },
        { date: '2024-01-03', cost: 4, tokens: 2000, requests: 20, agentBreakdown: {} },
        { date: '2024-01-04', cost: 4, tokens: 2000, requests: 20, agentBreakdown: {} },
        { date: '2024-01-05', cost: 4, tokens: 2000, requests: 20, agentBreakdown: {} },
        { date: '2024-01-06', cost: 4, tokens: 2000, requests: 20, agentBreakdown: {} },
        { date: '2024-01-07', cost: 4, tokens: 2000, requests: 20, agentBreakdown: {} },
        // Last week (low costs)
        { date: '2024-01-08', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
        { date: '2024-01-09', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
        { date: '2024-01-10', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
        { date: '2024-01-11', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
        { date: '2024-01-12', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
        { date: '2024-01-13', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
        { date: '2024-01-14', cost: 1, tokens: 500, requests: 5, agentBreakdown: {} },
      ]

      vi.mocked(LLMUsageModel.getDailyUsage).mockResolvedValue(decreasingUsage)

      const trends = await costEvaluator.getCostTrends('test-user', 14)
      expect(trends.insights.some(insight => insight.includes('decreased by'))).toBe(true)
    })
  })

  describe('generateCostReport', () => {
    beforeEach(() => {
      // Mock all required methods
      vi.mocked(LLMUsageModel.getUserUsageStats).mockResolvedValue({
        totalCost: 15,
        totalTokens: 7500,
        requestCount: 50,
        averageCostPerRequest: 0.3,
        costByAgent: { IDEATION: 8, REFINER: 7 },
        costByModel: { 'gpt-3.5-turbo': 15 },
      })

      vi.mocked(LLMUsageModel.checkBudgetStatus).mockResolvedValue({
        monthlyBudget: 20,
        currentSpend: 15,
        remainingBudget: 5,
        budgetUsedPercent: 75,
        isApproachingLimit: false,
        isOverBudget: false,
        stats: {} as any,
      })

      vi.mocked(LLMUsageModel.getExpensiveRequests).mockResolvedValue([])
      vi.mocked(LLMUsageModel.getDailyUsage).mockResolvedValue([])
    })

    it('should generate comprehensive cost report', async () => {
      const report = await costEvaluator.generateCostReport('test-user')

      expect(report.summary).toBeDefined()
      expect(report.summary.currentMonthSpend).toBe(15)
      expect(report.summary.budgetRemaining).toBe(5)
      expect(report.summary.averageCostPerRequest).toBe(0.3)
      expect(report.summary.mostExpensiveAgent).toBe('IDEATION')
      expect(report.summary.leastExpensiveAgent).toBe('REFINER')

      expect(report.alerts).toBeInstanceOf(Array)
      expect(report.suggestions).toBeInstanceOf(Array)
      expect(report.trends).toBeDefined()
      expect(report.templateAnalysis).toBeDefined()
    })
  })
})