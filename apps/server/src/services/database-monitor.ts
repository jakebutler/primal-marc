import { prisma } from './database.js'
import { logger } from '../utils/logger.js'
import fs from 'fs/promises'
import path from 'path'

export interface DatabaseSizeInfo {
  totalSizeBytes: number
  totalSizeMB: number
  tableStats: Array<{
    tableName: string
    recordCount: number
    estimatedSizeBytes: number
  }>
}

export interface CleanupResult {
  deletedRecords: number
  freedSpaceBytes: number
  tablesAffected: string[]
}

/**
 * Get database file size and table statistics
 */
export async function getDatabaseSize(): Promise<DatabaseSizeInfo> {
  try {
    // Get physical database file size
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db'
    const stats = await fs.stat(dbPath)
    const totalSizeBytes = stats.size
    
    // Get table statistics
    const tableStats = await Promise.all([
      getTableStats('users'),
      getTableStats('sessions'),
      getTableStats('projects'),
      getTableStats('project_phases'),
      getTableStats('conversations'),
      getTableStats('messages'),
      getTableStats('llm_usage'),
      getTableStats('database_stats'),
    ])
    
    const sizeInfo: DatabaseSizeInfo = {
      totalSizeBytes,
      totalSizeMB: Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100,
      tableStats: tableStats.filter(stat => stat !== null) as any[],
    }
    
    // Store size statistics
    await storeDatabaseStats(sizeInfo)
    
    return sizeInfo
  } catch (error) {
    logger.error('Failed to get database size:', error)
    throw error
  }
}

/**
 * Get statistics for a specific table
 */
async function getTableStats(tableName: string) {
  try {
    const result = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM ${tableName}
    `
    
    const recordCount = Number(result[0]?.count || 0)
    
    // Estimate size based on record count (rough approximation)
    const estimatedSizeBytes = recordCount * getEstimatedRecordSize(tableName)
    
    return {
      tableName,
      recordCount,
      estimatedSizeBytes,
    }
  } catch (error) {
    logger.warn(`Failed to get stats for table ${tableName}:`, error)
    return null
  }
}

/**
 * Estimate record size for different tables
 */
function getEstimatedRecordSize(tableName: string): number {
  const sizeEstimates: Record<string, number> = {
    users: 500,           // User profile data
    sessions: 200,        // Session tokens
    projects: 2000,       // Project content (variable)
    project_phases: 300,  // Phase data
    conversations: 400,   // Conversation metadata
    messages: 800,        // Message content (variable)
    llm_usage: 150,       // Usage tracking
    database_stats: 100,  // Statistics
  }
  
  return sizeEstimates[tableName] || 200
}

/**
 * Store database statistics for monitoring
 */
async function storeDatabaseStats(sizeInfo: DatabaseSizeInfo) {
  try {
    const statsData = sizeInfo.tableStats.map(stat => ({
      tableName: stat.tableName,
      recordCount: stat.recordCount,
      sizeBytes: stat.estimatedSizeBytes,
    }))
    
    await prisma.databaseStats.createMany({
      data: statsData,
    })
  } catch (error) {
    logger.warn('Failed to store database stats:', error)
  }
}

/**
 * Clean up old data to manage database size
 */
export async function cleanupOldData(options: {
  maxAgeDays?: number
  maxSizeMB?: number
  dryRun?: boolean
} = {}): Promise<CleanupResult> {
  const {
    maxAgeDays = 90,
    maxSizeMB = 100,
    dryRun = false,
  } = options
  
  const result: CleanupResult = {
    deletedRecords: 0,
    freedSpaceBytes: 0,
    tablesAffected: [],
  }
  
  try {
    const currentSize = await getDatabaseSize()
    
    if (currentSize.totalSizeMB < maxSizeMB) {
      logger.info(`Database size (${currentSize.totalSizeMB}MB) is within limit (${maxSizeMB}MB)`)
      return result
    }
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)
    
    logger.info(`Starting cleanup of data older than ${cutoffDate.toISOString()}`)
    
    if (!dryRun) {
      // Clean up old sessions
      const deletedSessions = await prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { lastUsedAt: { lt: cutoffDate } },
          ],
        },
      })
      
      if (deletedSessions.count > 0) {
        result.deletedRecords += deletedSessions.count
        result.tablesAffected.push('sessions')
      }
      
      // Clean up old database stats (keep only last 30 days)
      const statscutoff = new Date()
      statscutoff.setDate(statscutoff.getDate() - 30)
      
      const deletedStats = await prisma.databaseStats.deleteMany({
        where: {
          createdAt: { lt: statscutoff },
        },
      })
      
      if (deletedStats.count > 0) {
        result.deletedRecords += deletedStats.count
        result.tablesAffected.push('database_stats')
      }
      
      // Clean up old LLM usage records (keep for cost tracking, but summarize old data)
      const oldUsageRecords = await prisma.lLMUsage.findMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
        take: 1000, // Process in batches
      })
      
      if (oldUsageRecords.length > 0) {
        // Could implement summarization logic here
        logger.info(`Found ${oldUsageRecords.length} old LLM usage records (keeping for cost tracking)`)
      }
      
      // Vacuum database to reclaim space
      await prisma.$executeRaw`VACUUM;`
      
      const newSize = await getDatabaseSize()
      result.freedSpaceBytes = currentSize.totalSizeBytes - newSize.totalSizeBytes
      
      logger.info(`Cleanup completed: ${result.deletedRecords} records deleted, ${Math.round(result.freedSpaceBytes / 1024)}KB freed`)
    } else {
      logger.info('Dry run completed - no data was actually deleted')
    }
    
    return result
  } catch (error) {
    logger.error('Database cleanup failed:', error)
    throw error
  }
}

/**
 * Get database health metrics
 */
export async function getDatabaseHealth() {
  try {
    const sizeInfo = await getDatabaseSize()
    const recentStats = await prisma.databaseStats.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    
    return {
      currentSize: sizeInfo,
      recentGrowth: calculateGrowthRate(recentStats),
      recommendations: generateRecommendations(sizeInfo),
    }
  } catch (error) {
    logger.error('Failed to get database health:', error)
    throw error
  }
}

/**
 * Calculate database growth rate
 */
function calculateGrowthRate(stats: any[]): number {
  if (stats.length < 2) return 0
  
  const latest = stats[0]
  const oldest = stats[stats.length - 1]
  
  const latestTotal = latest.sizeBytes
  const oldestTotal = oldest.sizeBytes
  
  return ((latestTotal - oldestTotal) / oldestTotal) * 100
}

/**
 * Generate recommendations based on database size
 */
function generateRecommendations(sizeInfo: DatabaseSizeInfo): string[] {
  const recommendations: string[] = []
  
  if (sizeInfo.totalSizeMB > 50) {
    recommendations.push('Consider running database cleanup to remove old data')
  }
  
  if (sizeInfo.totalSizeMB > 100) {
    recommendations.push('Database size is approaching limits - cleanup recommended')
  }
  
  const messageTable = sizeInfo.tableStats.find(t => t.tableName === 'messages')
  if (messageTable && messageTable.recordCount > 10000) {
    recommendations.push('Large number of messages - consider archiving old conversations')
  }
  
  return recommendations
}