import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, cleanupTestDatabase, clearTestData, testPrisma } from './database-setup.js'

describe('Database Schema', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    await clearTestData()
  })

  describe('User Model', () => {
    it('should create and retrieve a user', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        firstName: 'John',
        lastName: 'Doe',
        experienceLevel: 'INTERMEDIATE' as const,
        preferences: JSON.stringify({
          preferredAgentPersonality: 'casual',
          autoSaveInterval: 30000,
        }),
        writingGenres: JSON.stringify(['fiction', 'blog']),
      }

      const user = await testPrisma.user.create({
        data: userData,
      })

      expect(user).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.firstName).toBe('John')
      expect(user.experienceLevel).toBe('INTERMEDIATE')

      const foundUser = await testPrisma.user.findUnique({
        where: { email: 'test@example.com' },
      })

      expect(foundUser).toBeDefined()
      expect(foundUser?.id).toBe(user.id)
    })

    it('should enforce unique email constraint', async () => {
      const userData = {
        email: 'duplicate@example.com',
        passwordHash: 'hashed_password',
      }

      await testPrisma.user.create({ data: userData })

      await expect(
        testPrisma.user.create({ data: userData })
      ).rejects.toThrow()
    })
  })

  describe('Project Model', () => {
    it('should create project with user relationship', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'user@example.com',
          passwordHash: 'hashed_password',
        },
      })

      const project = await testPrisma.project.create({
        data: {
          userId: user.id,
          title: 'Test Project',
          content: 'Test content',
          metadata: JSON.stringify({
            wordCount: 2,
            estimatedReadTime: 1,
            tags: ['test'],
          }),
        },
      })

      expect(project).toBeDefined()
      expect(project.userId).toBe(user.id)
      expect(project.title).toBe('Test Project')

      const projectWithUser = await testPrisma.project.findUnique({
        where: { id: project.id },
        include: { user: true },
      })

      expect(projectWithUser?.user.email).toBe('user@example.com')
    })

    it('should cascade delete when user is deleted', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'user@example.com',
          passwordHash: 'hashed_password',
        },
      })

      const project = await testPrisma.project.create({
        data: {
          userId: user.id,
          title: 'Test Project',
          content: 'Test content',
        },
      })

      await testPrisma.user.delete({
        where: { id: user.id },
      })

      const deletedProject = await testPrisma.project.findUnique({
        where: { id: project.id },
      })

      expect(deletedProject).toBeNull()
    })
  })

  describe('Project Phases', () => {
    it('should create project phases with proper relationships', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'user@example.com',
          passwordHash: 'hashed_password',
        },
      })

      const project = await testPrisma.project.create({
        data: {
          userId: user.id,
          title: 'Test Project',
          content: 'Test content',
        },
      })

      const phases = await Promise.all([
        testPrisma.projectPhase.create({
          data: {
            projectId: project.id,
            type: 'IDEATION',
            status: 'ACTIVE',
          },
        }),
        testPrisma.projectPhase.create({
          data: {
            projectId: project.id,
            type: 'REFINEMENT',
            status: 'PENDING',
          },
        }),
      ])

      expect(phases).toHaveLength(2)
      expect(phases[0].type).toBe('IDEATION')
      expect(phases[1].type).toBe('REFINEMENT')

      const projectWithPhases = await testPrisma.project.findUnique({
        where: { id: project.id },
        include: { phases: true },
      })

      expect(projectWithPhases?.phases).toHaveLength(2)
    })
  })

  describe('Conversations and Messages', () => {
    it('should create conversation with messages', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'user@example.com',
          passwordHash: 'hashed_password',
        },
      })

      const project = await testPrisma.project.create({
        data: {
          userId: user.id,
          title: 'Test Project',
          content: 'Test content',
        },
      })

      const conversation = await testPrisma.conversation.create({
        data: {
          projectId: project.id,
          agentType: 'IDEATION',
          context: JSON.stringify({
            phaseType: 'IDEATION',
            userGoals: ['brainstorm ideas'],
            previousOutputs: [],
          }),
        },
      })

      const messages = await Promise.all([
        testPrisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'USER',
            content: 'Hello, I need help with ideas',
          },
        }),
        testPrisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'AGENT',
            content: 'I can help you brainstorm!',
            metadata: JSON.stringify({
              tokenCount: 10,
              cost: 0.001,
            }),
          },
        }),
      ])

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('USER')
      expect(messages[1].role).toBe('AGENT')

      const conversationWithMessages = await testPrisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { messages: true },
      })

      expect(conversationWithMessages?.messages).toHaveLength(2)
    })
  })

  describe('LLM Usage Tracking', () => {
    it('should track LLM usage', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'user@example.com',
          passwordHash: 'hashed_password',
        },
      })

      const usage = await testPrisma.lLMUsage.create({
        data: {
          userId: user.id,
          agentType: 'IDEATION',
          model: 'gpt-3.5-turbo',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.003,
          requestId: 'test-request-123',
          metadata: JSON.stringify({
            temperature: 0.7,
            maxTokens: 100,
          }),
        },
      })

      expect(usage).toBeDefined()
      expect(usage.userId).toBe(user.id)
      expect(usage.model).toBe('gpt-3.5-turbo')
      expect(usage.totalTokens).toBe(150)
      expect(usage.cost).toBe(0.003)
    })
  })

  describe('Database Stats', () => {
    it('should store database statistics', async () => {
      const stats = await testPrisma.databaseStats.createMany({
        data: [
          {
            tableName: 'users',
            recordCount: 10,
            sizeBytes: 5000,
          },
          {
            tableName: 'projects',
            recordCount: 25,
            sizeBytes: 12000,
          },
        ],
      })

      expect(stats.count).toBe(2)

      const storedStats = await testPrisma.databaseStats.findMany()
      expect(storedStats).toHaveLength(2)

      const userStats = storedStats.find(s => s.tableName === 'users')
      expect(userStats?.recordCount).toBe(10)
      expect(userStats?.sizeBytes).toBe(5000)
    })
  })
})