import { Request, Response, NextFunction } from 'express'
import { auditLogger, AuditEventType } from '../services/audit-logger.js'
import { contentFilter } from '../services/content-filter.js'
import { logger } from '../utils/logger.js'

/**
 * Middleware to audit all requests
 */
export const auditRequest = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now()
    
    // Store original send method
    const originalSend = res.send
    
    // Override send method to capture response
    res.send = function(body) {
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Log the request asynchronously
      setImmediate(async () => {
        try {
          await logRequest(req, res, duration, body)
        } catch (error) {
          logger.error('Failed to log audit request:', error)
        }
      })
      
      return originalSend.call(this, body)
    }
    
    next()
  }
}

/**
 * Log request details for audit
 */
async function logRequest(
  req: Request, 
  res: Response, 
  duration: number, 
  responseBody: any
): Promise<void> {
  const isSuccess = res.statusCode < 400
  const isAuthEndpoint = req.path.includes('/auth')
  const isAIEndpoint = req.path.includes('/ai') || req.path.includes('/llm')
  const isContentEndpoint = req.path.includes('/projects') || req.path.includes('/content')
  
  // Determine event type based on endpoint and method
  let eventType: AuditEventType
  
  if (isAuthEndpoint) {
    if (req.path.includes('/login')) {
      eventType = AuditEventType.USER_LOGIN
    } else if (req.path.includes('/logout')) {
      eventType = AuditEventType.USER_LOGOUT
    } else if (req.path.includes('/register')) {
      eventType = AuditEventType.USER_REGISTER
    } else if (req.path.includes('/reset')) {
      eventType = AuditEventType.PASSWORD_RESET
    } else {
      eventType = AuditEventType.TOKEN_REFRESH
    }
  } else if (isAIEndpoint) {
    eventType = isSuccess ? AuditEventType.AI_REQUEST : AuditEventType.AI_ERROR
  } else if (isContentEndpoint) {
    if (req.method === 'POST') {
      eventType = AuditEventType.PROJECT_CREATE
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      eventType = AuditEventType.PROJECT_UPDATE
    } else if (req.method === 'DELETE') {
      eventType = AuditEventType.PROJECT_DELETE
    } else {
      eventType = AuditEventType.PROJECT_VIEW
    }
  } else if (req.path.includes('/search')) {
    eventType = AuditEventType.SEARCH_QUERY
  } else if (req.path.includes('/export')) {
    eventType = AuditEventType.EXPORT_REQUEST
  } else if (req.path.includes('/upload')) {
    eventType = AuditEventType.FILE_UPLOAD
  } else {
    // Don't log routine requests like health checks
    if (req.path === '/health' || req.path === '/status') {
      return
    }
    eventType = AuditEventType.SYSTEM_CONFIG_CHANGE
  }
  
  // Prepare audit details
  const details: Record<string, any> = {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration,
    contentLength: req.headers['content-length'],
    referer: req.headers.referer,
    responseSize: typeof responseBody === 'string' ? responseBody.length : JSON.stringify(responseBody || {}).length
  }
  
  // Add request body details for certain endpoints (sanitized)
  if (req.body && (isContentEndpoint || isAIEndpoint)) {
    details.requestBodySize = JSON.stringify(req.body).length
    
    // For AI requests, log input/output lengths
    if (isAIEndpoint) {
      details.inputLength = req.body.message?.length || 0
      if (isSuccess && responseBody) {
        try {
          const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody
          details.outputLength = parsed.content?.length || 0
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  }
  
  // Add query parameters for search requests
  if (eventType === AuditEventType.SEARCH_QUERY) {
    details.searchQuery = req.query.query
    details.searchFilters = Object.keys(req.query).filter(k => k !== 'query')
  }
  
  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
  
  if (!isSuccess) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      riskLevel = 'MEDIUM'
    } else if (res.statusCode === 429) {
      riskLevel = 'HIGH'
    } else if (res.statusCode >= 500) {
      riskLevel = 'MEDIUM'
    }
  }
  
  if (duration > 10000) { // Slow requests
    riskLevel = 'MEDIUM'
  }
  
  if (isAIEndpoint && !isSuccess) {
    riskLevel = 'HIGH'
  }
  
  // Log the audit event
  await auditLogger.log({
    eventType,
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    resource: getResourceFromPath(req.path),
    resourceId: req.params.id,
    action: req.method,
    details,
    success: isSuccess,
    errorMessage: !isSuccess ? getErrorMessage(responseBody) : undefined,
    riskLevel
  })
}

/**
 * Extract resource type from request path
 */
function getResourceFromPath(path: string): string {
  if (path.includes('/auth')) return 'auth'
  if (path.includes('/projects')) return 'project'
  if (path.includes('/ai') || path.includes('/llm')) return 'ai_agent'
  if (path.includes('/search')) return 'search'
  if (path.includes('/export')) return 'export'
  if (path.includes('/upload')) return 'file'
  return 'system'
}

/**
 * Extract error message from response body
 */
function getErrorMessage(responseBody: any): string | undefined {
  if (!responseBody) return undefined
  
  try {
    const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody
    return parsed.error || parsed.message
  } catch (e) {
    return typeof responseBody === 'string' ? responseBody.substring(0, 100) : 'Unknown error'
  }
}

/**
 * Middleware to audit AI interactions specifically
 */
export const auditAIInteraction = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now()
    
    // Filter input content before processing
    if (req.body?.message) {
      const filterResult = await contentFilter.filterContent(req.body.message, {
        userId: req.user?.id,
        contentType: 'user_input',
        strictMode: true
      })
      
      if (!filterResult.allowed) {
        await auditLogger.logSecurityEvent(
          AuditEventType.SUSPICIOUS_ACTIVITY,
          req,
          'HIGH',
          {
            reason: 'Inappropriate content in AI request',
            violations: filterResult.violations.map(v => v.type),
            riskScore: filterResult.riskScore
          },
          'Content filter blocked AI request'
        )
        
        res.status(400).json({
          success: false,
          error: 'Content not allowed',
          code: 'CONTENT_FILTERED',
          violations: filterResult.violations.map(v => ({
            type: v.type,
            severity: v.severity
          }))
        })
        return
      }
      
      // Use filtered content if available
      if (filterResult.filtered) {
        req.body.message = filterResult.filteredContent
      }
    }
    
    // Store original send method
    const originalSend = res.send
    
    // Override send method to audit AI response
    res.send = function(body) {
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Audit AI interaction asynchronously
      setImmediate(async () => {
        try {
          const isSuccess = res.statusCode < 400
          let outputContent = ''
          let cost = 0
          
          if (isSuccess && body) {
            try {
              const parsed = typeof body === 'string' ? JSON.parse(body) : body
              outputContent = parsed.content || parsed.message || ''
              cost = parsed.cost || 0
              
              // Filter AI output
              if (outputContent) {
                const filteredOutput = await contentFilter.filterAIOutput(outputContent, req.user?.id)
                if (filteredOutput !== outputContent) {
                  logger.warn('AI output was filtered', {
                    userId: req.user?.id,
                    originalLength: outputContent.length,
                    filteredLength: filteredOutput.length
                  })
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
          
          await auditLogger.logAIInteraction(
            isSuccess ? AuditEventType.AI_REQUEST : AuditEventType.AI_ERROR,
            req,
            {
              agentType: req.body?.agentType || 'unknown',
              inputLength: req.body?.message?.length || 0,
              outputLength: outputContent.length,
              processingTime: duration,
              cost,
              model: req.body?.model || 'unknown',
              projectId: req.body?.projectId || req.params?.projectId
            },
            isSuccess,
            !isSuccess ? getErrorMessage(body) : undefined
          )
        } catch (error) {
          logger.error('Failed to audit AI interaction:', error)
        }
      })
      
      return originalSend.call(this, body)
    }
    
    next()
  }
}

/**
 * Middleware to audit content operations
 */
export const auditContentOperation = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only audit content modification operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next()
      return
    }
    
    const originalSend = res.send
    
    res.send = function(body) {
      const isSuccess = res.statusCode < 400
      
      // Audit content operation asynchronously
      setImmediate(async () => {
        try {
          let eventType: AuditEventType
          
          switch (req.method) {
            case 'POST':
              eventType = AuditEventType.PROJECT_CREATE
              break
            case 'PUT':
            case 'PATCH':
              eventType = AuditEventType.PROJECT_UPDATE
              break
            case 'DELETE':
              eventType = AuditEventType.PROJECT_DELETE
              break
            default:
              return
          }
          
          const details: Record<string, any> = {
            method: req.method,
            contentLength: req.body ? JSON.stringify(req.body).length : 0
          }
          
          // Add content-specific details
          if (req.body) {
            if (req.body.title) details.title = req.body.title.substring(0, 100)
            if (req.body.content) details.contentLength = req.body.content.length
            if (req.body.phase) details.phase = req.body.phase
            if (req.body.status) details.status = req.body.status
          }
          
          await auditLogger.logContentOperation(
            eventType,
            req,
            req.params.id || req.params.projectId || 'unknown',
            req.method,
            isSuccess,
            details,
            !isSuccess ? getErrorMessage(body) : undefined
          )
        } catch (error) {
          logger.error('Failed to audit content operation:', error)
        }
      })
      
      return originalSend.call(this, body)
    }
    
    next()
  }
}