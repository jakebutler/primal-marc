import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { logger } from '../utils/logger.js'
import { auditLogger, AuditEventType } from '../services/audit-logger.js'

/**
 * CSRF Protection Middleware
 */
export class CSRFProtection {
  private static readonly CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'
  private static readonly TOKEN_EXPIRY = 60 * 60 * 1000 // 1 hour

  /**
   * Generate CSRF token
   */
  static generateToken(sessionId: string): string {
    const timestamp = Date.now().toString()
    const data = `${sessionId}:${timestamp}`
    const signature = crypto
      .createHmac('sha256', this.CSRF_SECRET)
      .update(data)
      .digest('hex')
    
    return Buffer.from(`${data}:${signature}`).toString('base64')
  }

  /**
   * Verify CSRF token
   */
  static verifyToken(token: string, sessionId: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8')
      const [receivedSessionId, timestamp, signature] = decoded.split(':')
      
      // Check if token is for the correct session
      if (receivedSessionId !== sessionId) {
        return false
      }

      // Check if token has expired
      const tokenTime = parseInt(timestamp)
      if (Date.now() - tokenTime > this.TOKEN_EXPIRY) {
        return false
      }

      // Verify signature
      const data = `${receivedSessionId}:${timestamp}`
      const expectedSignature = crypto
        .createHmac('sha256', this.CSRF_SECRET)
        .update(data)
        .digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch (error) {
      logger.warn('CSRF token verification failed:', error)
      return false
    }
  }

  /**
   * Middleware to provide CSRF token
   */
  static provideToken() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Generate session ID if not exists
      if (!req.session?.id) {
        if (!req.session) {
          req.session = {} as any
        }
        req.session.id = crypto.randomBytes(32).toString('hex')
      }

      // Generate and attach CSRF token
      const csrfToken = CSRFProtection.generateToken(req.session.id)
      res.locals.csrfToken = csrfToken
      
      // Set CSRF token in cookie for client-side access
      res.cookie('csrf-token', csrfToken, {
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: this.TOKEN_EXPIRY
      })

      next()
    }
  }

  /**
   * Middleware to verify CSRF token
   */
  static verifyToken() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Skip CSRF for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        next()
        return
      }

      // Skip CSRF for API endpoints with valid JWT (already authenticated)
      if (req.headers.authorization && req.user) {
        next()
        return
      }

      const sessionId = req.session?.id
      if (!sessionId) {
        await auditLogger.logSecurityEvent(
          AuditEventType.SUSPICIOUS_ACTIVITY,
          req,
          'MEDIUM',
          { reason: 'Missing session ID for CSRF verification' }
        )

        res.status(403).json({
          success: false,
          error: 'Invalid session',
          code: 'INVALID_SESSION'
        })
        return
      }

      // Get CSRF token from header or body
      const csrfToken = req.headers['x-csrf-token'] as string || 
                       req.body._csrf || 
                       req.query._csrf as string

      if (!csrfToken) {
        await auditLogger.logSecurityEvent(
          AuditEventType.SUSPICIOUS_ACTIVITY,
          req,
          'MEDIUM',
          { reason: 'Missing CSRF token' }
        )

        res.status(403).json({
          success: false,
          error: 'CSRF token required',
          code: 'CSRF_TOKEN_REQUIRED'
        })
        return
      }

      if (!CSRFProtection.verifyToken(csrfToken, sessionId)) {
        await auditLogger.logSecurityEvent(
          AuditEventType.SUSPICIOUS_ACTIVITY,
          req,
          'HIGH',
          { reason: 'Invalid CSRF token' }
        )

        res.status(403).json({
          success: false,
          error: 'Invalid CSRF token',
          code: 'INVALID_CSRF_TOKEN'
        })
        return
      }

      next()
    }
  }
}

/**
 * Security Headers Middleware
 */
export const securityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Content Security Policy
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' data: blob:",
      "connect-src 'self' https://api.openai.com https://api.promptlayer.com wss:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')

    res.setHeader('Content-Security-Policy', cspDirectives)

    // Strict Transport Security
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }

    // X-Frame-Options
    res.setHeader('X-Frame-Options', 'DENY')

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // X-XSS-Protection
    res.setHeader('X-XSS-Protection', '1; mode=block')

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Permissions Policy
    const permissionsPolicy = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()'
    ].join(', ')
    res.setHeader('Permissions-Policy', permissionsPolicy)

    // Remove server information
    res.removeHeader('X-Powered-By')
    res.setHeader('Server', 'Primal-Marc')

    next()
  }
}

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          // Remove potentially dangerous characters
          req.query[key] = value.replace(/[<>'"&]/g, '')
        }
      }
    }

    // Sanitize URL parameters
    if (req.params) {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          req.params[key] = value.replace(/[<>'"&]/g, '')
        }
      }
    }

    // Add request ID for tracking
    req.id = crypto.randomUUID()
    res.setHeader('X-Request-ID', req.id)

    next()
  }
}

/**
 * IP-based security middleware
 */
export const ipSecurity = () => {
  const suspiciousIPs = new Set<string>()
  const ipAttempts = new Map<string, { count: number; lastAttempt: number }>()

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown'

    // Check if IP is marked as suspicious
    if (suspiciousIPs.has(clientIP)) {
      await auditLogger.logSecurityEvent(
        AuditEventType.SUSPICIOUS_ACTIVITY,
        req,
        'HIGH',
        { reason: 'Request from suspicious IP', ip: clientIP }
      )

      res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'IP_BLOCKED'
      })
      return
    }

    // Track failed attempts per IP
    const now = Date.now()
    const attempts = ipAttempts.get(clientIP) || { count: 0, lastAttempt: 0 }

    // Reset counter if last attempt was more than 1 hour ago
    if (now - attempts.lastAttempt > 60 * 60 * 1000) {
      attempts.count = 0
    }

    // Check for too many failed attempts
    if (attempts.count > 20) {
      suspiciousIPs.add(clientIP)
      
      await auditLogger.logSecurityEvent(
        AuditEventType.SUSPICIOUS_ACTIVITY,
        req,
        'CRITICAL',
        { reason: 'Too many failed attempts', ip: clientIP, attempts: attempts.count }
      )

      res.status(429).json({
        success: false,
        error: 'Too many failed attempts',
        code: 'IP_RATE_LIMITED'
      })
      return
    }

    // Track this request
    const originalSend = res.send
    res.send = function(body) {
      if (res.statusCode >= 400) {
        attempts.count++
        attempts.lastAttempt = now
        ipAttempts.set(clientIP, attempts)
      }
      return originalSend.call(this, body)
    }

    next()
  }
}

/**
 * Request size limiting middleware
 */
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0')
    
    if (contentLength > maxSize) {
      logger.warn('Request size limit exceeded', {
        contentLength,
        maxSize,
        ip: req.ip,
        url: req.url
      })

      res.status(413).json({
        success: false,
        error: 'Request too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize
      })
      return
    }

    next()
  }
}

/**
 * Slow request detection middleware
 */
export const slowRequestDetection = (threshold: number = 30000) => { // 30 seconds
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now()

    const timeout = setTimeout(async () => {
      logger.warn('Slow request detected', {
        url: req.url,
        method: req.method,
        duration: Date.now() - startTime,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      })

      await auditLogger.logSecurityEvent(
        AuditEventType.SUSPICIOUS_ACTIVITY,
        req,
        'MEDIUM',
        { reason: 'Slow request detected', duration: Date.now() - startTime }
      )
    }, threshold)

    res.on('finish', () => {
      clearTimeout(timeout)
    })

    next()
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string
      session?: {
        id: string
        [key: string]: any
      }
    }
  }
}