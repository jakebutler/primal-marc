import { prisma } from '../services/database.js'
import { UserPreferences, UserProfile } from '@primal-marc/shared'
import bcrypt from 'bcryptjs'
import { logger } from '../utils/logger.js'

export class UserModel {
  /**
   * Create a new user with hashed password
   */
  static async create(data: {
    email: string
    password: string
    firstName?: string
    lastName?: string
    bio?: string
    experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  }) {
    try {
      const passwordHash = await bcrypt.hash(data.password, 12)
      
      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          bio: data.bio,
          experienceLevel: data.experienceLevel || 'BEGINNER',
          preferences: JSON.stringify({
            preferredAgentPersonality: 'casual',
            autoSaveInterval: 30000,
            notificationSettings: {
              emailNotifications: true,
              pushNotifications: false,
              weeklyDigest: true,
            },
          }),
          writingGenres: JSON.stringify([]),
        },
      })
      
      logger.info(`User created: ${user.email}`)
      return user
    } catch (error) {
      logger.error('Failed to create user:', error)
      throw error
    }
  }
  
  /**
   * Find user by email
   */
  static async findByEmail(email: string) {
    try {
      return await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          projects: {
            orderBy: { updatedAt: 'desc' },
            take: 5, // Recent projects only
          },
        },
      })
    } catch (error) {
      logger.error('Failed to find user by email:', error)
      throw error
    }
  }
  
  /**
   * Find user by ID
   */
  static async findById(id: string) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include: {
          projects: {
            orderBy: { updatedAt: 'desc' },
          },
        },
      })
    } catch (error) {
      logger.error('Failed to find user by ID:', error)
      throw error
    }
  }
  
  /**
   * Verify user password
   */
  static async verifyPassword(user: { passwordHash: string }, password: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, user.passwordHash)
    } catch (error) {
      logger.error('Failed to verify password:', error)
      return false
    }
  }
  
  /**
   * Update user preferences
   */
  static async updatePreferences(userId: string, preferences: Partial<UserPreferences>) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) throw new Error('User not found')
      
      const currentPreferences = user.preferences ? JSON.parse(user.preferences) : {}
      const updatedPreferences = { ...currentPreferences, ...preferences }
      
      return await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: JSON.stringify(updatedPreferences),
        },
      })
    } catch (error) {
      logger.error('Failed to update user preferences:', error)
      throw error
    }
  }
  
  /**
   * Update user profile
   */
  static async updateProfile(userId: string, profile: Partial<UserProfile>) {
    try {
      const updateData: any = {}
      
      if (profile.firstName !== undefined) updateData.firstName = profile.firstName
      if (profile.lastName !== undefined) updateData.lastName = profile.lastName
      if (profile.bio !== undefined) updateData.bio = profile.bio
      if (profile.experienceLevel !== undefined) updateData.experienceLevel = profile.experienceLevel
      if (profile.writingGenres !== undefined) updateData.writingGenres = JSON.stringify(profile.writingGenres)
      
      return await prisma.user.update({
        where: { id: userId },
        data: updateData,
      })
    } catch (error) {
      logger.error('Failed to update user profile:', error)
      throw error
    }
  }
  
  /**
   * Get user preferences with defaults
   */
  static getUserPreferences(user: { preferences?: string | null }): UserPreferences {
    const defaultPreferences: UserPreferences = {
      preferredAgentPersonality: 'casual',
      autoSaveInterval: 30000,
      notificationSettings: {
        emailNotifications: true,
        pushNotifications: false,
        weeklyDigest: true,
      },
    }
    
    if (!user.preferences) return defaultPreferences
    
    try {
      const parsed = JSON.parse(user.preferences)
      return { ...defaultPreferences, ...parsed }
    } catch {
      return defaultPreferences
    }
  }
  
  /**
   * Get user writing genres
   */
  static getUserGenres(user: { writingGenres?: string | null }): string[] {
    if (!user.writingGenres) return []
    
    try {
      return JSON.parse(user.writingGenres)
    } catch {
      return []
    }
  }
  
  /**
   * Delete user and all associated data
   */
  static async delete(userId: string) {
    try {
      // Prisma will handle cascading deletes based on schema
      await prisma.user.delete({
        where: { id: userId },
      })
      
      logger.info(`User deleted: ${userId}`)
    } catch (error) {
      logger.error('Failed to delete user:', error)
      throw error
    }
  }
}