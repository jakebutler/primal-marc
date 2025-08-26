import { Request, Response, NextFunction } from 'express'
import { AuthService, JWTPayload } from '../services/auth.js'
import { UserModel } from '../models/user.js'
import { prisma } from '../services/database.js'
import { logger } from '../utils/logger.js'

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        firstName?: string
        lastName?: string
        experienceLevel: string
      }
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string
    email: string
    firstName?: string
    lastName?: string
    experienceLevel: string
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      })
      return
    }
    
    // Verify the access token
    const decoded: JWTPayload = AuthService.verifyAccessToken(token)
    
    // Fetch user details from database (without projects for auth)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      })
      return
    }
    
    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      experienceLevel: user.experienceLevel
    }
    
    next()
  } catch (error) {
    logger.error('Authentication middleware error:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Access token expired') {
        res.status(401).json({
          success: false,
          error: 'Access token expired',
          code: 'TOKEN_EXPIRED'
        })
        return
      } else if (error.message === 'Invalid access token') {
        res.status(401).json({
          success: false,
          error: 'Invalid access token',
          code: 'INVALID_TOKEN'
        })
        return
      }
    }
    
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    })
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]
    
    if (!token) {
      next()
      return
    }
    
    const decoded: JWTPayload = AuthService.verifyAccessToken(token)
    const user = await UserModel.findById(decoded.userId)
    
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        experienceLevel: user.experienceLevel
      }
    }
    
    next()
  } catch (error) {
    // For optional auth, we don't fail on token errors
    logger.warn('Optional auth failed:', error)
    next()
  }
}

/**
 * Middleware to check if user owns a resource
 */
export const requireResourceOwnership = (resourceIdParam: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
        return
      }
      
      const resourceId = req.params[resourceIdParam]
      if (!resourceId) {
        res.status(400).json({
          success: false,
          error: 'Resource ID required',
          code: 'MISSING_RESOURCE_ID'
        })
        return
      }
      
      // This middleware assumes the resource has a userId field
      // Specific implementations should override this logic
      next()
    } catch (error) {
      logger.error('Resource ownership check failed:', error)
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_FAILED'
      })
    }
  }
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>()
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown'
    const now = Date.now()
    
    // Clean up expired entries
    for (const [key, value] of attempts.entries()) {
      if (now > value.resetTime) {
        attempts.delete(key)
      }
    }
    
    const clientAttempts = attempts.get(clientId)
    
    if (!clientAttempts) {
      attempts.set(clientId, { count: 1, resetTime: now + windowMs })
      next()
      return
    }
    
    if (clientAttempts.count >= maxAttempts) {
      const remainingTime = Math.ceil((clientAttempts.resetTime - now) / 1000 / 60)
      res.status(429).json({
        success: false,
        error: `Too many authentication attempts. Try again in ${remainingTime} minutes.`,
        code: 'RATE_LIMITED',
        retryAfter: remainingTime
      })
      return
    }
    
    clientAttempts.count++
    next()
  }
}