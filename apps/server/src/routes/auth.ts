import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { UserModel } from '../models/user.js'
import { AuthService } from '../services/auth.js'
import { authenticateToken, authRateLimit } from '../middleware/auth.js'
import { validateRequest, secureValidationSchemas } from '../middleware/validation.js'
import { rateLimiters } from '../middleware/rate-limiting.js'
import { auditLogger, AuditEventType } from '../services/audit-logger.js'
import { prisma } from '../services/database.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional()
})

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', 
  rateLimiters.auth.middleware(),
  validateRequest({ body: secureValidationSchemas.userRegistration }),
  async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body)
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() }
    })
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      })
      return
    }
    
    // Create new user
    const user = await UserModel.create({
      email: validatedData.email,
      password: validatedData.password,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      bio: validatedData.bio,
      experienceLevel: validatedData.experienceLevel
    })
    
    // Generate tokens
    const tokens = await AuthService.generateTokens(user.id, user.email)
    
    // Return user data (without password hash) and tokens
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          experienceLevel: user.experienceLevel,
          createdAt: user.createdAt
        },
        tokens
      },
      message: 'User registered successfully'
    })
    
    logger.info(`User registered: ${user.email}`)
  } catch (error) {
    logger.error('Registration error:', error)
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      })
      return
    }
    
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_FAILED'
    })
  }
})

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', authRateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { email, password } = loginSchema.parse(req.body)
    
    // Find user by email (without projects for auth)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      })
      return
    }
    
    // Verify password
    const isValidPassword = await UserModel.verifyPassword(user, password)
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      })
      return
    }
    
    // Generate tokens
    const tokens = await AuthService.generateTokens(user.id, user.email)
    
    // Return user data and tokens
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          experienceLevel: user.experienceLevel,
          preferences: UserModel.getUserPreferences(user),
          writingGenres: UserModel.getUserGenres(user)
        },
        tokens
      },
      message: 'Login successful'
    })
    
    logger.info(`User logged in: ${user.email}`)
  } catch (error) {
    logger.error('Login error:', error)
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      })
      return
    }
    
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_FAILED'
    })
  }
})

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body)
    
    // Generate new tokens
    const tokens = await AuthService.refreshAccessToken(refreshToken)
    
    res.json({
      success: true,
      data: { tokens },
      message: 'Token refreshed successfully'
    })
    
    logger.info('Token refreshed successfully')
  } catch (error) {
    logger.error('Token refresh error:', error)
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      })
      return
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid refresh token') || error.message.includes('expired')) {
        res.status(401).json({
          success: false,
          error: error.message,
          code: 'INVALID_REFRESH_TOKEN'
        })
        return
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED'
    })
  }
})

/**
 * POST /auth/logout
 * Logout user by revoking refresh token
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body)
    
    await AuthService.revokeRefreshToken(refreshToken)
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    })
    
    logger.info('User logged out')
  } catch (error) {
    logger.error('Logout error:', error)
    
    // Even if logout fails, we return success to avoid client-side issues
    res.json({
      success: true,
      message: 'Logged out successfully'
    })
  }
})

/**
 * POST /auth/logout-all
 * Logout user from all devices
 */
router.post('/logout-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
      return
    }
    
    await AuthService.revokeAllUserTokens(req.user.id)
    
    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    })
    
    logger.info(`User logged out from all devices: ${req.user.email}`)
  } catch (error) {
    logger.error('Logout all error:', error)
    
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_FAILED'
    })
  }
})

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
      return
    }
    
    // Fetch full user details (without projects for auth)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    })
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      })
      return
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          experienceLevel: user.experienceLevel,
          preferences: UserModel.getUserPreferences(user),
          writingGenres: UserModel.getUserGenres(user),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    })
  } catch (error) {
    logger.error('Get user profile error:', error)
    
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
      code: 'PROFILE_FETCH_FAILED'
    })
  }
})

/**
 * GET /auth/sessions
 * Get user's active sessions
 */
router.get('/sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
      return
    }
    
    const sessions = await prisma.session.findMany({
      where: { 
        userId: req.user.id,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true
      },
      orderBy: { lastUsedAt: 'desc' }
    })
    
    res.json({
      success: true,
      data: { sessions }
    })
  } catch (error) {
    logger.error('Get sessions error:', error)
    
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
      code: 'SESSIONS_FETCH_FAILED'
    })
  }
})

export default router