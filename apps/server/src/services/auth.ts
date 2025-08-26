import jwt from 'jsonwebtoken'
import { prisma } from './database.js'
import { logger } from '../utils/logger.js'
import crypto from 'crypto'

export interface JWTPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m' // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  
  private static getJWTSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required')
    }
    return secret
  }
  
  /**
   * Generate access token
   */
  static generateAccessToken(payload: JWTPayload): string {
    try {
      return jwt.sign(
        { userId: payload.userId, email: payload.email },
        this.getJWTSecret(),
        { 
          expiresIn: this.ACCESS_TOKEN_EXPIRY,
          issuer: 'primal-marc',
          audience: 'primal-marc-client'
        }
      )
    } catch (error) {
      logger.error('Failed to generate access token:', error)
      throw new Error('Token generation failed')
    }
  }
  
  /**
   * Generate refresh token and store in database
   */
  static async generateRefreshToken(userId: string): Promise<string> {
    try {
      const refreshToken = crypto.randomBytes(64).toString('hex')
      const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY)
      
      // Clean up old sessions for this user (keep only the 5 most recent)
      const existingSessions = await prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 4, // Keep 4 most recent, delete the rest
      })
      
      if (existingSessions.length > 0) {
        await prisma.session.deleteMany({
          where: {
            id: { in: existingSessions.map(s => s.id) }
          }
        })
      }
      
      // Create new session
      await prisma.session.create({
        data: {
          userId,
          refreshToken,
          expiresAt,
        }
      })
      
      logger.info(`Refresh token generated for user: ${userId}`)
      return refreshToken
    } catch (error) {
      logger.error('Failed to generate refresh token:', error)
      throw new Error('Refresh token generation failed')
    }
  }
  
  /**
   * Generate both access and refresh tokens
   */
  static async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    try {
      const accessToken = this.generateAccessToken({ userId, email })
      const refreshToken = await this.generateRefreshToken(userId)
      
      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
      }
    } catch (error) {
      logger.error('Failed to generate tokens:', error)
      throw error
    }
  }
  
  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.getJWTSecret(), {
        issuer: 'primal-marc',
        audience: 'primal-marc-client'
      }) as JWTPayload
      
      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token')
      }
      logger.error('Token verification failed:', error)
      throw new Error('Token verification failed')
    }
  }
  
  /**
   * Verify refresh token and return associated user
   */
  static async verifyRefreshToken(refreshToken: string) {
    try {
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: { user: true }
      })
      
      if (!session) {
        throw new Error('Invalid refresh token')
      }
      
      if (session.expiresAt < new Date()) {
        // Clean up expired session
        await prisma.session.delete({
          where: { id: session.id }
        })
        throw new Error('Refresh token expired')
      }
      
      // Update last used timestamp
      await prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() }
      })
      
      return session.user
    } catch (error) {
      logger.error('Refresh token verification failed:', error)
      throw error
    }
  }
  
  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const user = await this.verifyRefreshToken(refreshToken)
      return await this.generateTokens(user.id, user.email)
    } catch (error) {
      logger.error('Token refresh failed:', error)
      throw error
    }
  }
  
  /**
   * Revoke refresh token (logout)
   */
  static async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await prisma.session.delete({
        where: { refreshToken }
      })
      logger.info('Refresh token revoked')
    } catch (error) {
      // Don't throw error if token doesn't exist (already logged out)
      logger.warn('Failed to revoke refresh token:', error)
    }
  }
  
  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      await prisma.session.deleteMany({
        where: { userId }
      })
      logger.info(`All tokens revoked for user: ${userId}`)
    } catch (error) {
      logger.error('Failed to revoke all user tokens:', error)
      throw error
    }
  }
  
  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      })
      logger.info(`Cleaned up ${result.count} expired sessions`)
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error)
    }
  }
}