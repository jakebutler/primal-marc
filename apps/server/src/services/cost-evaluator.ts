import { logger } from '../utils/logger.js'
import { LLMUsageModel } from '../models/llm-usage.js'
import { promptManager, PromptPerformance } from './prompt-manager.js'

// Cost evaluation metrics
export interface CostEvaluation {
  templateId: string
  costPerSuccess: number
  tokenEfficiency: number
  responseQuality: number
  overallScore: number
  recommendation: 'excellent' | 'good' | 'fair' | 'poor'
  suggestions: string[]
}

// Budget alert configuration
export interface BudgetAlert {
  userId: string
  alertType: 'warning' | 'critical' | 'exceeded'
  currentSpend: number
  budgetLimit: number
  percentUsed: number
  projectedMonthlySpend: number
  message: string
  timestamp: Date
}

// Cost optimization suggestion
export interface OptimizationSuggestion {
  type: 'model_downgrade' | 'prompt_optimization' | 'rate_limiting' | 'template_switch'
  description: string
  potentialSavings: number
  impact: 'low' | 'medium' | 'high'
  actionRequired: string
}

export class CostEvaluator {
  private readonly COST_THRESHOLDS = {
    excellent: 0.001, // $0.001 per successful request
    good: 0.005,      // $0.005 per successful request
    fair: 0.01,       // $0.01 per successful request
    poor: 0.02,       // $0.02 per successful request
  }

  private readonly BUDGET_ALERT_THRESHOLDS = {
    warning: 0.8,   // 80% of budget
    critical: 0.95, // 95% of budget
    exceeded: 1.0,  // 100% of budget
  }

  /**
   * Evaluate cost performance of a prompt template
   */
  async evaluateTemplate(templateId: string): Promise<CostEvaluation | null> {
    const performance = promptManager.getPerformanceMetrics(templateId)
    if (!performance) {
      logger.warn(`No performance data for template: ${templateId}`)
      return null
    }

    const costPerSuccess = performance.successRate > 0 
      ? performance.averageCost / performance.successRate
      : performance.averageCost

    const tokenEfficiency = this.calculateTokenEfficiency(performance)
    const responseQuality = this.calculateResponseQuality(performance)
    const overallScore = this.calculateOverallScore(costPerSuccess, tokenEfficiency, responseQuality)
    
    const recommendation = this.getRecommendation(costPerSuccess)
    const suggestions = this.generateSuggestions(performance, costPerSuccess)

    return {
      templateId,
      costPerSuccess,
      tokenEfficiency,
      responseQuality,
      overallScore,
      recommendation,
      suggestions,
    }
  }

  /**
   * Calculate token efficiency (successful responses per token)
   */
  private calculateTokenEfficiency(performance: PromptPerformance): number {
    if (performance.averageTokens === 0) return 0
    return performance.successRate / performance.averageTokens
  }

  /**
   * Calculate response quality score based on success rate and response time
   */
  private calculateResponseQuality(performance: PromptPerformance): number {
    // Normalize response time (assume 5 seconds is baseline)
    const timeScore = Math.max(0, 1 - (performance.averageResponseTime - 5000) / 10000)
    return (performance.successRate * 0.7) + (timeScore * 0.3)
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(
    costPerSuccess: number,
    tokenEfficiency: number,
    responseQuality: number
  ): number {
    // Invert cost (lower cost = higher score)
    const costScore = Math.max(0, 1 - costPerSuccess / this.COST_THRESHOLDS.poor)
    
    // Weighted average: cost (40%), efficiency (30%), quality (30%)
    return (costScore * 0.4) + (tokenEfficiency * 0.3) + (responseQuality * 0.3)
  }

  /**
   * Get recommendation based on cost per success
   */
  private getRecommendation(costPerSuccess: number): CostEvaluation['recommendation'] {
    if (costPerSuccess <= this.COST_THRESHOLDS.excellent) return 'excellent'
    if (costPerSuccess <= this.COST_THRESHOLDS.good) return 'good'
    if (costPerSuccess <= this.COST_THRESHOLDS.fair) return 'fair'
    return 'poor'
  }

  /**
   * Generate optimization suggestions
   */
  private generateSuggestions(
    performance: PromptPerformance,
    costPerSuccess: number
  ): string[] {
    const suggestions: string[] = []

    if (costPerSuccess > this.COST_THRESHOLDS.good) {
      suggestions.push('Consider optimizing prompt length to reduce token usage')
    }

    if (performance.successRate < 0.8) {
      suggestions.push('Improve prompt clarity to increase success rate')
    }

    if (performance.averageTokens > 1000) {
      suggestions.push('Consider breaking down complex prompts into smaller parts')
    }

    if (performance.averageResponseTime > 10000) {
      suggestions.push('Consider using a faster model for time-sensitive requests')
    }

    if (performance.usageCount < 10) {
      suggestions.push('Collect more usage data for accurate performance evaluation')
    }

    return suggestions
  }

  /**
   * Evaluate all templates and return cost analysis
   */
  async evaluateAllTemplates(): Promise<{
    evaluations: CostEvaluation[]
    summary: {
      totalTemplates: number
      excellentCount: number
      goodCount: number
      fairCount: number
      poorCount: number
      averageScore: number
      totalPotentialSavings: number
    }
  }> {
    const allMetrics = promptManager.getAllPerformanceMetrics()
    const evaluations: CostEvaluation[] = []

    for (const metrics of allMetrics) {
      const evaluation = await this.evaluateTemplate(metrics.templateId)
      if (evaluation) {
        evaluations.push(evaluation)
      }
    }

    // Calculate summary statistics
    const summary = {
      totalTemplates: evaluations.length,
      excellentCount: evaluations.filter(e => e.recommendation === 'excellent').length,
      goodCount: evaluations.filter(e => e.recommendation === 'good').length,
      fairCount: evaluations.filter(e => e.recommendation === 'fair').length,
      poorCount: evaluations.filter(e => e.recommendation === 'poor').length,
      averageScore: evaluations.length > 0 
        ? evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length
        : 0,
      totalPotentialSavings: this.calculatePotentialSavings(evaluations),
    }

    return { evaluations, summary }
  }

  /**
   * Calculate potential savings from optimization
   */
  private calculatePotentialSavings(evaluations: CostEvaluation[]): number {
    return evaluations.reduce((savings, evaluation) => {
      if (evaluation.recommendation === 'poor') {
        // Assume 50% savings possible for poor templates
        const performance = promptManager.getPerformanceMetrics(evaluation.templateId)
        if (performance) {
          return savings + (performance.averageCost * performance.usageCount * 0.5)
        }
      }
      return savings
    }, 0)
  }

  /**
   * Check budget status and generate alerts
   */
  async checkBudgetAlerts(userId: string, budgetLimit: number): Promise<BudgetAlert[]> {
    const budgetStatus = await LLMUsageModel.checkBudgetStatus(userId, budgetLimit)
    const alerts: BudgetAlert[] = []

    // Calculate projected monthly spend
    const dailyUsage = await LLMUsageModel.getDailyUsage(userId, 7)
    const averageDailySpend = dailyUsage.length > 0
      ? dailyUsage.reduce((sum, day) => sum + day.cost, 0) / dailyUsage.length
      : 0
    const projectedMonthlySpend = averageDailySpend * 30

    // Generate appropriate alerts
    if (budgetStatus.budgetUsedPercent >= this.BUDGET_ALERT_THRESHOLDS.exceeded * 100) {
      alerts.push({
        userId,
        alertType: 'exceeded',
        currentSpend: budgetStatus.currentSpend,
        budgetLimit,
        percentUsed: budgetStatus.budgetUsedPercent,
        projectedMonthlySpend,
        message: `Budget exceeded! Current spend: $${budgetStatus.currentSpend.toFixed(2)} / $${budgetLimit.toFixed(2)}`,
        timestamp: new Date(),
      })
    } else if (budgetStatus.budgetUsedPercent >= this.BUDGET_ALERT_THRESHOLDS.critical * 100) {
      alerts.push({
        userId,
        alertType: 'critical',
        currentSpend: budgetStatus.currentSpend,
        budgetLimit,
        percentUsed: budgetStatus.budgetUsedPercent,
        projectedMonthlySpend,
        message: `Critical: ${budgetStatus.budgetUsedPercent.toFixed(1)}% of budget used. Projected monthly spend: $${projectedMonthlySpend.toFixed(2)}`,
        timestamp: new Date(),
      })
    } else if (budgetStatus.budgetUsedPercent >= this.BUDGET_ALERT_THRESHOLDS.warning * 100) {
      alerts.push({
        userId,
        alertType: 'warning',
        currentSpend: budgetStatus.currentSpend,
        budgetLimit,
        percentUsed: budgetStatus.budgetUsedPercent,
        projectedMonthlySpend,
        message: `Warning: ${budgetStatus.budgetUsedPercent.toFixed(1)}% of budget used. Projected monthly spend: $${projectedMonthlySpend.toFixed(2)}`,
        timestamp: new Date(),
      })
    }

    return alerts
  }

  /**
   * Generate optimization suggestions for a user
   */
  async generateOptimizationSuggestions(userId: string): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = []
    
    try {
      // Get user's usage statistics
      const usageStats = await LLMUsageModel.getUserUsageStats(userId)
      const expensiveRequests = await LLMUsageModel.getExpensiveRequests(userId, 5)

      // Analyze expensive requests
      if (expensiveRequests.length > 0) {
        const avgCost = expensiveRequests.reduce((sum, req) => sum + req.cost, 0) / expensiveRequests.length
        
        if (avgCost > 0.01) {
          suggestions.push({
            type: 'model_downgrade',
            description: 'Consider using GPT-3.5-turbo instead of GPT-4 for less complex tasks',
            potentialSavings: avgCost * 0.7, // Assume 70% savings
            impact: 'high',
            actionRequired: 'Review expensive requests and switch to cheaper models where appropriate',
          })
        }
      }

      // Check for high token usage
      const avgTokensPerRequest = usageStats.totalTokens / Math.max(usageStats.requestCount, 1)
      if (avgTokensPerRequest > 1500) {
        suggestions.push({
          type: 'prompt_optimization',
          description: 'Your prompts are using more tokens than average',
          potentialSavings: usageStats.totalCost * 0.3, // Assume 30% savings
          impact: 'medium',
          actionRequired: 'Optimize prompts to be more concise while maintaining effectiveness',
        })
      }

      // Check request frequency
      const dailyUsage = await LLMUsageModel.getDailyUsage(userId, 7)
      const avgDailyRequests = dailyUsage.length > 0 
        ? dailyUsage.reduce((sum, day) => sum + day.requests, 0) / dailyUsage.length
        : 0
      
      if (avgDailyRequests > 50) {
        suggestions.push({
          type: 'rate_limiting',
          description: 'High request frequency detected',
          potentialSavings: usageStats.totalCost * 0.2, // Assume 20% savings
          impact: 'low',
          actionRequired: 'Consider implementing request batching or caching for similar queries',
        })
      }

      // Template optimization suggestions
      const templateEvaluations = await this.evaluateAllTemplates()
      const poorTemplates = templateEvaluations.evaluations.filter(e => e.recommendation === 'poor')
      
      if (poorTemplates.length > 0) {
        suggestions.push({
          type: 'template_switch',
          description: `${poorTemplates.length} templates have poor cost efficiency`,
          potentialSavings: templateEvaluations.summary.totalPotentialSavings,
          impact: 'high',
          actionRequired: 'Switch to more cost-effective prompt templates or optimize existing ones',
        })
      }

    } catch (error) {
      logger.error('Error generating optimization suggestions:', error)
    }

    return suggestions
  }

  /**
   * Get cost trends and projections
   */
  async getCostTrends(userId: string, days = 30): Promise<{
    dailyTrends: Array<{
      date: string
      cost: number
      tokens: number
      requests: number
    }>
    projections: {
      nextWeekCost: number
      nextMonthCost: number
      yearEndCost: number
    }
    insights: string[]
  }> {
    const dailyUsage = await LLMUsageModel.getDailyUsage(userId, days)
    
    // Calculate projections based on recent trends
    const recentDays = dailyUsage.slice(-7) // Last 7 days
    const avgDailyCost = recentDays.length > 0
      ? recentDays.reduce((sum, day) => sum + day.cost, 0) / recentDays.length
      : 0

    const projections = {
      nextWeekCost: avgDailyCost * 7,
      nextMonthCost: avgDailyCost * 30,
      yearEndCost: avgDailyCost * 365,
    }

    // Generate insights
    const insights: string[] = []
    
    if (dailyUsage.length >= 7) {
      const firstWeek = dailyUsage.slice(0, 7)
      const lastWeek = dailyUsage.slice(-7)
      
      const firstWeekAvg = firstWeek.reduce((sum, day) => sum + day.cost, 0) / firstWeek.length
      const lastWeekAvg = lastWeek.reduce((sum, day) => sum + day.cost, 0) / lastWeek.length
      
      const changePercent = ((lastWeekAvg - firstWeekAvg) / Math.max(firstWeekAvg, 0.001)) * 100
      
      if (Math.abs(changePercent) > 20) {
        insights.push(
          changePercent > 0
            ? `Costs increased by ${changePercent.toFixed(1)}% in the last week`
            : `Costs decreased by ${Math.abs(changePercent).toFixed(1)}% in the last week`
        )
      }
    }

    if (avgDailyCost > 1) {
      insights.push('Daily costs are above $1 - consider optimization strategies')
    }

    if (projections.nextMonthCost > 20) {
      insights.push('Projected monthly costs exceed $20 - review usage patterns')
    }

    return {
      dailyTrends: dailyUsage,
      projections,
      insights,
    }
  }

  /**
   * Generate cost report for a user
   */
  async generateCostReport(userId: string): Promise<{
    summary: {
      currentMonthSpend: number
      budgetRemaining: number
      averageCostPerRequest: number
      mostExpensiveAgent: string
      leastExpensiveAgent: string
    }
    alerts: BudgetAlert[]
    suggestions: OptimizationSuggestion[]
    trends: any
    templateAnalysis: any
  }> {
    const [
      usageStats,
      budgetAlerts,
      optimizationSuggestions,
      costTrends,
      templateAnalysis,
    ] = await Promise.all([
      LLMUsageModel.getUserUsageStats(userId),
      this.checkBudgetAlerts(userId, 20), // Default $20 budget
      this.generateOptimizationSuggestions(userId),
      this.getCostTrends(userId),
      this.evaluateAllTemplates(),
    ])

    // Find most/least expensive agents
    const agentCosts = Object.entries(usageStats.costByAgent)
    const mostExpensiveAgent = agentCosts.reduce((max, [agent, cost]) => 
      cost > (max[1] || 0) ? [agent, cost] : max, ['', 0])[0] || 'N/A'
    const leastExpensiveAgent = agentCosts.reduce((min, [agent, cost]) => 
      cost < (min[1] || Infinity) ? [agent, cost] : min, ['', Infinity])[0] || 'N/A'

    return {
      summary: {
        currentMonthSpend: usageStats.totalCost,
        budgetRemaining: Math.max(0, 20 - usageStats.totalCost),
        averageCostPerRequest: usageStats.averageCostPerRequest,
        mostExpensiveAgent,
        leastExpensiveAgent,
      },
      alerts: budgetAlerts,
      suggestions: optimizationSuggestions,
      trends: costTrends,
      templateAnalysis,
    }
  }
}

// Export singleton instance
export const costEvaluator = new CostEvaluator()