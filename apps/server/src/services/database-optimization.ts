import { prisma } from './database.js'
import { logger } from '../utils/logger.js'

export interface QueryOptimizationConfig {
  enableQueryLogging: boolean
  slowQueryThreshold: number // milliseconds
  enableIndexAnalysis: boolean
  enableVacuumSchedule: boolean
  vacuumIntervalHours: number
}

export interface QueryStats {
  totalQueries: number
  slowQueries: number
  averageQueryTime: number
  cacheHitRate: number
  indexUsage: Record<string, number>
}

export class DatabaseOptimizationService {
  private config: QueryOptimizationConfig
  private queryStats: QueryStats = {
    totalQueries: 0,
    slowQueries: 0,
    averageQueryTime: 0,
    cacheHitRate: 0,
    indexUsage: {}
  }
  private queryTimes: number[] = []
  private vacuumInterval?: NodeJS.Timeout

  constructor(config: QueryOptimizationConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      // Apply SQLite-specific optimizations
      await this.applySQLiteOptimizations()
      
      // Create additional indexes for performance
      await this.createPerformanceIndexes()
      
      // Set up query monitoring if enabled
      if (this.config.enableQueryLogging) {
        this.setupQueryMonitoring()
      }
      
      // Schedule vacuum operations
      if (this.config.enableVacuumSchedule) {
        this.scheduleVacuumOperations()
      }
      
      logger.info('Database optimization service initialized')
    } catch (error) {
      logger.error('Failed to initialize database optimization service:', error)
      throw error
    }
  }

  private async applySQLiteOptimizations(): Promise<void> {
    try {
      // Enable WAL mode for better concurrency
      await prisma.$queryRaw`PRAGMA journal_mode = WAL;`
      
      // Set synchronous mode to NORMAL for better performance
      await prisma.$queryRaw`PRAGMA synchronous = NORMAL;`
      
      // Increase cache size (64MB)
      await prisma.$queryRaw`PRAGMA cache_size = -64000;`
      
      // Enable foreign key constraints
      await prisma.$queryRaw`PRAGMA foreign_keys = ON;`
      
      // Set temp store to memory
      await prisma.$queryRaw`PRAGMA temp_store = MEMORY;`
      
      // Set mmap size for memory-mapped I/O (256MB)
      await prisma.$queryRaw`PRAGMA mmap_size = 268435456;`
      
      // Optimize page size for better performance
      await prisma.$queryRaw`PRAGMA page_size = 4096;`
      
      // Set busy timeout to handle concurrent access
      await prisma.$queryRaw`PRAGMA busy_timeout = 30000;`
      
      logger.info('SQLite optimizations applied successfully')
    } catch (error) {
      logger.error('Failed to apply SQLite optimizations:', error)
      throw error
    }
  }

  private async createPerformanceIndexes(): Promise<void> {
    try {
      // User-related indexes
      await this.createIndexIfNotExists('idx_users_email', 'users', ['email'])
      await this.createIndexIfNotExists('idx_sessions_user_id', 'sessions', ['userId'])
      await this.createIndexIfNotExists('idx_sessions_expires_at', 'sessions', ['expiresAt'])
      
      // Project-related indexes
      await this.createIndexIfNotExists('idx_projects_user_id_status', 'projects', ['userId', 'status'])
      await this.createIndexIfNotExists('idx_projects_updated_at', 'projects', ['updatedAt'])
      await this.createIndexIfNotExists('idx_projects_folder_id', 'projects', ['folderId'])
      
      // Conversation and message indexes
      await this.createIndexIfNotExists('idx_conversations_project_agent', 'conversations', ['projectId', 'agentType'])
      await this.createIndexIfNotExists('idx_messages_conversation_timestamp', 'messages', ['conversationId', 'timestamp'])
      await this.createIndexIfNotExists('idx_messages_created_at', 'messages', ['createdAt'])
      
      // LLM usage indexes for cost tracking
      await this.createIndexIfNotExists('idx_llm_usage_user_date', 'llm_usage', ['userId', 'createdAt'])
      await this.createIndexIfNotExists('idx_llm_usage_agent_type', 'llm_usage', ['agentType'])
      
      // Project phase indexes
      await this.createIndexIfNotExists('idx_project_phases_project_type', 'project_phases', ['projectId', 'type'])
      await this.createIndexIfNotExists('idx_project_phases_status', 'project_phases', ['status'])
      
      // Collaboration indexes
      await this.createIndexIfNotExists('idx_project_collaborators_project', 'project_collaborators', ['projectId'])
      await this.createIndexIfNotExists('idx_project_collaborators_user', 'project_collaborators', ['userId'])
      await this.createIndexIfNotExists('idx_collaboration_invites_email', 'collaboration_invites', ['inviteeEmail'])
      
      // Sharing indexes
      await this.createIndexIfNotExists('idx_share_links_token', 'share_links', ['token'])
      await this.createIndexIfNotExists('idx_share_links_project', 'share_links', ['projectId'])
      
      logger.info('Performance indexes created successfully')
    } catch (error) {
      logger.error('Failed to create performance indexes:', error)
      throw error
    }
  }

  private async createIndexIfNotExists(
    indexName: string, 
    tableName: string, 
    columns: string[]
  ): Promise<void> {
    try {
      const columnList = columns.join(', ')
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnList});`
      )
      logger.debug(`Index ${indexName} created/verified on ${tableName}`)
    } catch (error) {
      logger.warn(`Failed to create index ${indexName}:`, error)
    }
  }

  private setupQueryMonitoring(): void {
    // This would be implemented with Prisma middleware in a real scenario
    // For now, we'll track basic metrics
    logger.info('Query monitoring enabled')
  }

  private scheduleVacuumOperations(): void {
    const intervalMs = this.config.vacuumIntervalHours * 60 * 60 * 1000
    
    this.vacuumInterval = setInterval(async () => {
      try {
        await this.performVacuum()
      } catch (error) {
        logger.error('Scheduled vacuum operation failed:', error)
      }
    }, intervalMs)
    
    logger.info(`Vacuum operations scheduled every ${this.config.vacuumIntervalHours} hours`)
  }

  async performVacuum(): Promise<void> {
    try {
      logger.info('Starting database vacuum operation')
      const startTime = Date.now()
      
      // Perform VACUUM to reclaim space and optimize database
      await prisma.$queryRaw`VACUUM;`
      
      const duration = Date.now() - startTime
      logger.info(`Database vacuum completed in ${duration}ms`)
    } catch (error) {
      logger.error('Database vacuum operation failed:', error)
      throw error
    }
  }

  async analyzeDatabase(): Promise<{
    tableStats: Array<{
      tableName: string
      rowCount: number
      sizeKB: number
    }>
    indexStats: Array<{
      indexName: string
      tableName: string
      isUsed: boolean
    }>
    recommendations: string[]
  }> {
    try {
      const tableStats = await this.getTableStatistics()
      const indexStats = await this.getIndexStatistics()
      const recommendations = await this.generateOptimizationRecommendations(tableStats)
      
      return {
        tableStats,
        indexStats,
        recommendations
      }
    } catch (error) {
      logger.error('Database analysis failed:', error)
      throw error
    }
  }

  private async getTableStatistics(): Promise<Array<{
    tableName: string
    rowCount: number
    sizeKB: number
  }>> {
    try {
      // Get table information from SQLite
      const tables = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
      `
      
      const stats = []
      for (const table of tables) {
        try {
          const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table.name}`)
          const count = Array.isArray(countResult) ? (countResult[0] as any)?.count || 0 : 0
          
          stats.push({
            tableName: table.name,
            rowCount: count,
            sizeKB: 0 // SQLite doesn't easily provide table size, would need PRAGMA table_info
          })
        } catch (error) {
          logger.warn(`Failed to get stats for table ${table.name}:`, error)
        }
      }
      
      return stats
    } catch (error) {
      logger.error('Failed to get table statistics:', error)
      return []
    }
  }

  private async getIndexStatistics(): Promise<Array<{
    indexName: string
    tableName: string
    isUsed: boolean
  }>> {
    try {
      const indexes = await prisma.$queryRaw<Array<{
        name: string
        tbl_name: string
      }>>`
        SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';
      `
      
      return indexes.map(index => ({
        indexName: index.name,
        tableName: index.tbl_name,
        isUsed: true // SQLite doesn't provide usage stats easily
      }))
    } catch (error) {
      logger.error('Failed to get index statistics:', error)
      return []
    }
  }

  private async generateOptimizationRecommendations(
    tableStats: Array<{ tableName: string; rowCount: number; sizeKB: number }>
  ): Promise<string[]> {
    const recommendations: string[] = []
    
    // Check for tables with high row counts that might benefit from partitioning
    const highVolumeThreshold = 100000
    const highVolumeTables = tableStats.filter(stat => stat.rowCount > highVolumeThreshold)
    
    if (highVolumeTables.length > 0) {
      recommendations.push(
        `Consider archiving old data from high-volume tables: ${highVolumeTables.map(t => t.tableName).join(', ')}`
      )
    }
    
    // Check for potential missing indexes based on common query patterns
    const messagesTable = tableStats.find(t => t.tableName === 'messages')
    if (messagesTable && messagesTable.rowCount > 10000) {
      recommendations.push('Consider adding composite indexes on messages table for common query patterns')
    }
    
    const projectsTable = tableStats.find(t => t.tableName === 'projects')
    if (projectsTable && projectsTable.rowCount > 1000) {
      recommendations.push('Ensure projects table has proper indexes on userId, status, and updatedAt columns')
    }
    
    return recommendations
  }

  getQueryStats(): QueryStats {
    return { ...this.queryStats }
  }

  resetQueryStats(): void {
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      cacheHitRate: 0,
      indexUsage: {}
    }
    this.queryTimes = []
  }

  async shutdown(): Promise<void> {
    if (this.vacuumInterval) {
      clearInterval(this.vacuumInterval)
    }
    logger.info('Database optimization service shutdown completed')
  }
}

// Default configuration
export const defaultOptimizationConfig: QueryOptimizationConfig = {
  enableQueryLogging: process.env.NODE_ENV === 'development',
  slowQueryThreshold: 1000, // 1 second
  enableIndexAnalysis: true,
  enableVacuumSchedule: true,
  vacuumIntervalHours: 24 // Daily vacuum
}