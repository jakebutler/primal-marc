import { prisma } from '../services/database.js'
import { logger } from '../utils/logger.js'

export interface LLMUsageData {
  userId: string
  agentType: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  requestId?: string
  metadata?: Record<string, any>
}

export interface UsageStats {
  totalCost: number
  totalTokens: number
  requestCount: number
  averageCostPerRequest: number
  costByAgent: Record<string, number>
  costByModel: Record<string, number>
}

export class LLMUsageModel {
  /**
   * Record LLM usage for cost tracking
   */
  static async recordUsage(data: LLMUsageData) {
    try {
      const usage = await prisma.lLMUsage.create({
        data: {
          userId: data.userId,
          agentType: data.agentType,
          model: data.model,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          cost: data.cost,
          requestId: data.requestId,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
      })
      
      logger.debug(`LLM usage recorded: ${usage.id} - $${data.cost}`)
      return usage
    } catch (error) {
      logger.error('Failed to record LLM usage:', error)
      throw error
    }
  }
  
  /**
   * Get usage statistics for a user
   */
  static async getUserUsageStats(userId: string, options: {
    startDate?: Date
    endDate?: Date
    agentType?: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'
  } = {}): Promise<UsageStats> {
    try {
      const { startDate, endDate, agentType } = options
      
      const where: any = { userId }
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }
      if (agentType) where.agentType = agentType
      
      const usageRecords = await prisma.lLMUsage.findMany({
        where,
        select: {
          cost: true,
          totalTokens: true,
          agentType: true,
          model: true,
        },
      })
      
      const stats: UsageStats = {
        totalCost: 0,
        totalTokens: 0,
        requestCount: usageRecords.length,
        averageCostPerRequest: 0,
        costByAgent: {},
        costByModel: {},
      }
      
      usageRecords.forEach(record => {
        stats.totalCost += record.cost
        stats.totalTokens += record.totalTokens
        
        // Cost by agent
        if (!stats.costByAgent[record.agentType]) {
          stats.costByAgent[record.agentType] = 0
        }
        stats.costByAgent[record.agentType] += record.cost
        
        // Cost by model
        if (!stats.costByModel[record.model]) {
          stats.costByModel[record.model] = 0
        }
        stats.costByModel[record.model] += record.cost
      })
      
      stats.averageCostPerRequest = stats.requestCount > 0 ? stats.totalCost / stats.requestCount : 0
      
      return stats
    } catch (error) {
      logger.error('Failed to get user usage stats:', error)
      throw error
    }
  }
  
  /**
   * Get daily usage for the last N days
   */
  static async getDailyUsage(userId: string, days = 30) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      const usageRecords = await prisma.lLMUsage.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        select: {
          cost: true,
          totalTokens: true,
          createdAt: true,
          agentType: true,
        },
        orderBy: { createdAt: 'asc' },
      })
      
      // Group by date
      const dailyUsage: Record<string, {
        date: string
        cost: number
        tokens: number
        requests: number
        agentBreakdown: Record<string, number>
      }> = {}
      
      usageRecords.forEach(record => {
        const dateKey = record.createdAt.toISOString().split('T')[0]
        
        if (!dailyUsage[dateKey]) {
          dailyUsage[dateKey] = {
            date: dateKey,
            cost: 0,
            tokens: 0,
            requests: 0,
            agentBreakdown: {},
          }
        }
        
        dailyUsage[dateKey].cost += record.cost
        dailyUsage[dateKey].tokens += record.totalTokens
        dailyUsage[dateKey].requests += 1
        
        if (!dailyUsage[dateKey].agentBreakdown[record.agentType]) {
          dailyUsage[dateKey].agentBreakdown[record.agentType] = 0
        }
        dailyUsage[dateKey].agentBreakdown[record.agentType] += record.cost
      })
      
      return Object.values(dailyUsage)
    } catch (error) {
      logger.error('Failed to get daily usage:', error)
      throw error
    }
  }
  
  /**
   * Check if user is approaching budget limit
   */
  static async checkBudgetStatus(userId: string, monthlyBudget: number) {
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const monthlyStats = await this.getUserUsageStats(userId, {
        startDate: startOfMonth,
      })
      
      const budgetUsedPercent = (monthlyStats.totalCost / monthlyBudget) * 100
      
      return {
        monthlyBudget,
        currentSpend: monthlyStats.totalCost,
        remainingBudget: monthlyBudget - monthlyStats.totalCost,
        budgetUsedPercent,
        isApproachingLimit: budgetUsedPercent > 80,
        isOverBudget: budgetUsedPercent > 100,
        stats: monthlyStats,
      }
    } catch (error) {
      logger.error('Failed to check budget status:', error)
      throw error
    }
  }
  
  /**
   * Get most expensive requests for optimization
   */
  static async getExpensiveRequests(userId: string, limit = 10) {
    try {
      return await prisma.lLMUsage.findMany({
        where: { userId },
        orderBy: { cost: 'desc' },
        take: limit,
        select: {
          id: true,
          agentType: true,
          model: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          cost: true,
          createdAt: true,
          metadata: true,
        },
      })
    } catch (error) {
      logger.error('Failed to get expensive requests:', error)
      throw error
    }
  }
  
  /**
   * Get global usage statistics (for admin/monitoring)
   */
  static async getGlobalUsageStats(options: {
    startDate?: Date
    endDate?: Date
  } = {}) {
    try {
      const { startDate, endDate } = options
      
      const where: any = {}
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }
      
      const [totalStats, userStats] = await Promise.all([
        prisma.lLMUsage.aggregate({
          where,
          _sum: {
            cost: true,
            totalTokens: true,
          },
          _count: {
            id: true,
          },
        }),
        prisma.lLMUsage.groupBy({
          by: ['userId'],
          where,
          _sum: {
            cost: true,
            totalTokens: true,
          },
          _count: {
            id: true,
          },
          orderBy: {
            _sum: {
              cost: 'desc',
            },
          },
          take: 10,
        }),
      ])
      
      return {
        totalCost: totalStats._sum.cost || 0,
        totalTokens: totalStats._sum.totalTokens || 0,
        totalRequests: totalStats._count.id || 0,
        topUsers: userStats,
      }
    } catch (error) {
      logger.error('Failed to get global usage stats:', error)
      throw error
    }
  }
  
  /**
   * Clean up old usage records (keep for cost tracking but summarize)
   */
  static async cleanupOldRecords(daysToKeep = 90) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      // For now, just log old records count
      // In production, you might want to summarize rather than delete
      const oldRecordsCount = await prisma.lLMUsage.count({
        where: {
          createdAt: { lt: cutoffDate },
        },
      })
      
      logger.info(`Found ${oldRecordsCount} old LLM usage records (keeping for cost tracking)`)
      
      return { oldRecordsCount }
    } catch (error) {
      logger.error('Failed to cleanup old usage records:', error)
      throw error
    }
  }
}