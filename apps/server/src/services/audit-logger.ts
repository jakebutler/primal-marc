import { Request } from 'express'
import { prisma } from './database.js'
import { logger } from '../utils/logger.js'

export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  
  // Content events
  PROJECT_CREATE = 'PROJECT_CREATE',
  PROJECT_UPDATE = 'PROJECT_UPDATE',
  PROJECT_DELETE = 'PROJECT_DELETE',
  PROJECT_VIEW = 'PROJECT_VIEW',
  
  // AI Agent events
  AI_REQUEST = 'AI_REQUEST',
  AI_RESPONSE = 'AI_RESPONSE',
  AI_ERROR = 'AI_ERROR',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // System events
  FILE_UPLOAD = 'FILE_UPLOAD',
  EXPORT_REQUEST = 'EXPORT_REQUEST',
  SEARCH_QUERY = 'SEARCH_QUERY',
  
  // Admin events
  ADMIN_ACTION = 'ADMIN_ACTION',
  SYSTEM_CONFIG_CHANGE = 'SYSTEM_CONFIG_CHANGE'
}

export interface AuditLogEntry {
  eventType: AuditEventType
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  resourceId?: string
  action?: string
  details?: Record<string, any>
  metadata?: Record<string, any>
  timestamp: Date
  success: boolean
  errorMessage?: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export class AuditLogger {
  private static instance: AuditLogger
  private logBuffer: AuditLogEntry[] = []
  private bufferSize = 100
  private flushInterval = 30000 // 30 seconds

  private constructor() {
    // Flush buffer periodically
    setInterval(() => {
      this.flushBuffer()
    }, this.flushInterval)

    // Flush buffer on process exit
    process.on('SIGTERM', () => this.flushBuffer())
    process.on('SIGINT', () => this.flushBuffer())
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    }

    // Add to buffer
    this.logBuffer.push(auditEntry)

    // Log to application logger for immediate visibility
    logger.info('Audit Event', {
      type: entry.eventType,
      userId: entry.userId,
      resource: entry.resource,
      success: entry.success,
      riskLevel: entry.riskLevel
    })

    // Flush buffer if it's full or if it's a critical event
    if (this.logBuffer.length >= this.bufferSize || entry.riskLevel === 'CRITICAL') {
      await this.flushBuffer()
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    eventType: AuditEventType,
    req: Request,
    success: boolean,
    details?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      eventType,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details,
      success,
      errorMessage,
      riskLevel: success ? 'LOW' : 'MEDIUM'
    })
  }

  /**
   * Log AI agent interactions
   */
  async logAIInteraction(
    eventType: AuditEventType,
    req: Request,
    details: {
      agentType?: string
      inputLength?: number
      outputLength?: number
      processingTime?: number
      cost?: number
      model?: string
      projectId?: string
    },
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      eventType,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      resource: 'ai_agent',
      resourceId: details.projectId,
      details,
      success,
      errorMessage,
      riskLevel: success ? 'LOW' : 'HIGH'
    })
  }

  /**
   * Log content operations
   */
  async logContentOperation(
    eventType: AuditEventType,
    req: Request,
    resourceId: string,
    action: string,
    success: boolean,
    details?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      eventType,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      resource: 'project',
      resourceId,
      action,
      details,
      success,
      errorMessage,
      riskLevel: 'LOW'
    })
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    req: Request,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    details?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      eventType,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details,
      success: false,
      errorMessage,
      riskLevel
    })
  }

  /**
   * Flush buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return

    const entries = [...this.logBuffer]
    this.logBuffer = []

    try {
      // Store in database
      await prisma.auditLog.createMany({
        data: entries.map(entry => ({
          eventType: entry.eventType,
          userId: entry.userId,
          sessionId: entry.sessionId,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          resource: entry.resource,
          resourceId: entry.resourceId,
          action: entry.action,
          details: entry.details ? JSON.stringify(entry.details) : null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          timestamp: entry.timestamp,
          success: entry.success,
          errorMessage: entry.errorMessage,
          riskLevel: entry.riskLevel
        }))
      })

      logger.debug(`Flushed ${entries.length} audit log entries to database`)
    } catch (error) {
      logger.error('Failed to flush audit log entries:', error)
      
      // Re-add entries to buffer for retry
      this.logBuffer.unshift(...entries)
      
      // Prevent buffer from growing too large
      if (this.logBuffer.length > this.bufferSize * 2) {
        this.logBuffer = this.logBuffer.slice(0, this.bufferSize)
        logger.warn('Audit log buffer overflow, some entries were dropped')
      }
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    userId?: string
    eventType?: AuditEventType
    resource?: string
    riskLevel?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }): Promise<{ logs: any[], total: number }> {
    const where: any = {}

    if (filters.userId) where.userId = filters.userId
    if (filters.eventType) where.eventType = filters.eventType
    if (filters.resource) where.resource = filters.resource
    if (filters.riskLevel) where.riskLevel = filters.riskLevel
    if (filters.startDate || filters.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = filters.startDate
      if (filters.endDate) where.timestamp.lte = filters.endDate
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return { logs, total }
  }

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(userId: string, timeWindow: number = 3600000): Promise<{
    suspicious: boolean
    reasons: string[]
    riskScore: number
  }> {
    const since = new Date(Date.now() - timeWindow)
    
    const recentLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'desc' }
    })

    const reasons: string[] = []
    let riskScore = 0

    // Check for multiple failed login attempts
    const failedLogins = recentLogs.filter(log => 
      log.eventType === AuditEventType.USER_LOGIN && !log.success
    ).length
    if (failedLogins > 3) {
      reasons.push(`${failedLogins} failed login attempts`)
      riskScore += failedLogins * 10
    }

    // Check for unusual IP addresses
    const ipAddresses = new Set(recentLogs.map(log => log.ipAddress).filter(Boolean))
    if (ipAddresses.size > 3) {
      reasons.push(`Multiple IP addresses: ${ipAddresses.size}`)
      riskScore += ipAddresses.size * 5
    }

    // Check for high-frequency requests
    const requestCount = recentLogs.length
    if (requestCount > 100) {
      reasons.push(`High request frequency: ${requestCount} requests`)
      riskScore += Math.floor(requestCount / 10)
    }

    // Check for rate limit violations
    const rateLimitViolations = recentLogs.filter(log => 
      log.eventType === AuditEventType.RATE_LIMIT_EXCEEDED
    ).length
    if (rateLimitViolations > 5) {
      reasons.push(`Multiple rate limit violations: ${rateLimitViolations}`)
      riskScore += rateLimitViolations * 15
    }

    return {
      suspicious: riskScore > 50,
      reasons,
      riskScore
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate }
      }
    })

    logger.info(`Cleaned up ${result.count} old audit log entries`)
    return result.count
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance()