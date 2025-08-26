import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { UserModel } from '../../models/user.js'
import { setupTestDatabase, cleanupTestDatabase, clearTestData, testPrisma } from '../database-setup.js'

describe('UserModel', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    await clearTestData()
  })

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        experienceLevel: 'INTERMEDIATE' as const,
      }

      const user = await UserModel.create(userData)

      expect(user).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.firstName).toBe('John')
      expect(user.lastName).toBe('Doe')
      expect(user.experienceLevel).toBe('INTERMEDIATE')
      expect(user.passwordHash).not.toBe('password123') // Should be hashed
      expect(user.preferences).toBeDefined()
      expect(user.writingGenres).toBeDefined()
    })

    it('should normalize email to lowercase', async () => {
      const userData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      }

      const user = await UserModel.create(userData)
      expect(user.email).toBe('test@example.com')
    })

    it('should set default experience level to BEGINNER', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      }

      const user = await UserModel.create(userData)
      expect(user.experienceLevel).toBe('BEGINNER')
    })

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      }

      await UserModel.create(userData)
      
      await expect(UserModel.create(userData)).rejects.toThrow()
    })
  })

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
      }

      const createdUser = await UserModel.create(userData)
      const foundUser = await UserModel.findByEmail('test@example.com')

      expect(foundUser).toBeDefined()
      expect(foundUser?.id).toBe(createdUser.id)
      expect(foundUser?.firstName).toBe('John')
    })

    it('should return null for non-existent email', async () => {
      const user = await UserModel.findByEmail('nonexistent@example.com')
      expect(user).toBeNull()
    })

    it('should be case insensitive', async () => {
      await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
      })

      const user = await UserModel.findByEmail('TEST@EXAMPLE.COM')
      expect(user).toBeDefined()
    })
  })

  describe('findById', () => {
    it('should find user by ID', async () => {
      const createdUser = await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
      })

      const foundUser = await UserModel.findById(createdUser.id)

      expect(foundUser).toBeDefined()
      expect(foundUser?.id).toBe(createdUser.id)
      expect(foundUser?.firstName).toBe('John')
    })

    it('should return null for non-existent ID', async () => {
      const user = await UserModel.findById('non-existent-id')
      expect(user).toBeNull()
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const user = await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
      })

      const isValid = await UserModel.verifyPassword(user, 'password123')
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const user = await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
      })

      const isValid = await UserModel.verifyPassword(user, 'wrongpassword')
      expect(isValid).toBe(false)
    })
  })

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const user = await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
      })

      const newPreferences = {
        preferredAgentPersonality: 'formal' as const,
        autoSaveInterval: 60000,
      }

      const updatedUser = await UserModel.updatePreferences(user.id, newPreferences)

      expect(updatedUser).toBeDefined()
      
      const preferences = UserModel.getUserPreferences(updatedUser)
      expect(preferences.preferredAgentPersonality).toBe('formal')
      expect(preferences.autoSaveInterval).toBe(60000)
    })

    it('should merge with existing preferences', async () => {
      const user = await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
      })

      // Update only one preference
      await UserModel.updatePreferences(user.id, {
        preferredAgentPersonality: 'formal' as const,
      })

      const updatedUser = await testPrisma.user.findUnique({ where: { id: user.id } })
      const preferences = UserModel.getUserPreferences(updatedUser!)
      
      expect(preferences.preferredAgentPersonality).toBe('formal')
      expect(preferences.autoSaveInterval).toBe(30000) // Should keep default
    })
  })

  describe('updateProfile', () => {
    it('should update user profile fields', async () => {
      const user = await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
      })

      const profileUpdate = {
        firstName: 'Jane',
        lastName: 'Smith',
        bio: 'A passionate writer',
        experienceLevel: 'ADVANCED' as const,
        writingGenres: ['fiction', 'poetry'],
      }

      const updatedUser = await UserModel.updateProfile(user.id, profileUpdate)

      expect(updatedUser.firstName).toBe('Jane')
      expect(updatedUser.lastName).toBe('Smith')
      expect(updatedUser.bio).toBe('A passionate writer')
      expect(updatedUser.experienceLevel).toBe('ADVANCED')
      
      const genres = UserModel.getUserGenres(updatedUser)
      expect(genres).toEqual(['fiction', 'poetry'])
    })
  })

  describe('getUserPreferences', () => {
    it('should return default preferences for user without preferences', async () => {
      const user = { preferences: null }
      const preferences = UserModel.getUserPreferences(user)

      expect(preferences).toEqual({
        preferredAgentPersonality: 'casual',
        autoSaveInterval: 30000,
        notificationSettings: {
          emailNotifications: true,
          pushNotifications: false,
          weeklyDigest: true,
        },
      })
    })

    it('should parse and merge with defaults', async () => {
      const user = {
        preferences: JSON.stringify({
          preferredAgentPersonality: 'formal',
          customSetting: 'value',
        }),
      }

      const preferences = UserModel.getUserPreferences(user)

      expect(preferences.preferredAgentPersonality).toBe('formal')
      expect(preferences.autoSaveInterval).toBe(30000) // Default
      expect((preferences as any).customSetting).toBe('value') // Custom setting preserved
    })

    it('should handle invalid JSON gracefully', async () => {
      const user = { preferences: 'invalid json' }
      const preferences = UserModel.getUserPreferences(user)

      expect(preferences.preferredAgentPersonality).toBe('casual')
    })
  })

  describe('getUserGenres', () => {
    it('should return empty array for user without genres', async () => {
      const user = { writingGenres: null }
      const genres = UserModel.getUserGenres(user)

      expect(genres).toEqual([])
    })

    it('should parse genres from JSON', async () => {
      const user = {
        writingGenres: JSON.stringify(['fiction', 'non-fiction', 'poetry']),
      }

      const genres = UserModel.getUserGenres(user)
      expect(genres).toEqual(['fiction', 'non-fiction', 'poetry'])
    })

    it('should handle invalid JSON gracefully', async () => {
      const user = { writingGenres: 'invalid json' }
      const genres = UserModel.getUserGenres(user)

      expect(genres).toEqual([])
    })
  })

  describe('delete', () => {
    it('should delete user and cascade to related data', async () => {
      const user = await UserModel.create({
        email: 'test@example.com',
        password: 'password123',
      })

      // Create related data
      await testPrisma.project.create({
        data: {
          userId: user.id,
          title: 'Test Project',
          content: 'Test content',
        },
      })

      await UserModel.delete(user.id)

      // Verify user is deleted
      const deletedUser = await testPrisma.user.findUnique({ where: { id: user.id } })
      expect(deletedUser).toBeNull()

      // Verify related projects are also deleted (cascade)
      const projects = await testPrisma.project.findMany({ where: { userId: user.id } })
      expect(projects).toHaveLength(0)
    })
  })
})