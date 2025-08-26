import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDatabaseSize, cleanupOldData, getDatabaseHealth } from '../../services/database-monitor.js'
import { setupTestDatabase, cleanupTestDatabase, clearTestData, createTestUser, createTestProject, testPrisma } from '../database-setup.js'

describe('DatabaseMonitor', () => {
  let testUser: any

  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    await clearTestData()
    testUser = await createTestUser()
  })

  describe('getDatabaseSize', () => {
    it('should return database size information', async () => {
      // Create some test data
      await createTestProject(testUser.id)
      await testPrisma.session.create({
        data: {
          userId: testUser.id,
          refreshToken: 'test-token',
          expiresAt: new Date(Date.now() + 86400000), // 24 hours
        },
      })

      const sizeInfo = await getDatabaseSize()

      expect(sizeInfo).toBeDefined()
      expect(sizeInfo.totalSizeBytes).toBeGreaterThan(0)
      expect(sizeInfo.totalSizeMB).toBeGreaterThan(0)
      expect(sizeInfo.tableStats).toBeDefined()
      expect(Array.isArray(sizeInfo.tableStats)).toBe(true)

      // Check that we have stats for main tables
      const userStats = sizeInfo.tableStats.find(stat => stat.tableName === 'users')
      expect(userStats).toBeDefined()
      expect(userStats?.recordCount).toBeGreaterThan(0)

      const projectStats = sizeInfo.tableStats.find(stat => stat.tableName === 'projects')
      expect(projectStats).toBeDefined()
      expect(projectStats?.recordCount).toBeGreaterThan(0)
    })

    it('should store database statistics', async () => {
      await getDatabaseSize()

      const storedStats = await testPrisma.databaseStats.findMany()
      expect(storedStats.length).toBeGreaterThan(0)

      const userStat = storedStats.find(stat => stat.tableName === 'users')
      expect(userStat).toBeDefined()
      expect(userStat?.recordCount).toBeGreaterThan(0)
    })
  })

  describe('cleanupOldData', () => {
    it('should clean up expired sessions', async () => {
      // Create expired session
      const expiredSession = await testPrisma.session.create({
        data: {
          userId: testUser.id,
          refreshToken: 'expired-token',
          expiresAt: new Date(Date.now() - 86400000), // 24 hours ago
          lastUsedAt: new Date(Date.now() - 86400000),
        },
      })

      // Create valid session
      const validSession = await testPrisma.session.create({
        data: {
          userId: testUser.id,
          refreshToken: 'valid-token',
          expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
          lastUsedAt: new Date(),
        },
      })

      const result = await cleanupOldData({ maxAgeDays: 1, dryRun: false })

      expect(result.deletedRecords).toBeGreaterThan(0)
      expect(result.tablesAffected).toContain('sessions')

      // Check that expired session is deleted
      const expiredCheck = await testPrisma.session.findUnique({ where: { id: expiredSession.id } })
      expect(expiredCheck).toBeNull()

      // Check that valid session still exists
      const validCheck = await testPrisma.session.findUnique({ where: { id: validSession.id } })
      expect(validCheck).toBeDefined()
    })

    it('should clean up old database stats', async () => {
      // Create old database stats
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 35) // 35 days ago

      await testPrisma.databaseStats.create({
        data: {
          tableName: 'test_table',
          recordCount: 100,
          sizeBytes: 1000,
          createdAt: oldDate,
        },
      })

      // Create recent stats
      await testPrisma.databaseStats.create({
        data: {
          tableName: 'test_table',
          recordCount: 200,
          sizeBytes: 2000,
        },
      })

      const result = await cleanupOldData({ maxAgeDays: 30, dryRun: false })

      expect(result.deletedRecords).toBeGreaterThan(0)
      expect(result.tablesAffected).toContain('database_stats')

      // Check that only recent stats remain
      const remainingStats = await testPrisma.databaseStats.findMany()
      expect(remainingStats).toHaveLength(1)
      expect(remainingStats[0].recordCount).toBe(200)
    })

    it('should not delete data in dry run mode', async () => {
      // Create expired session
      await testPrisma.session.create({
        data: {
          userId: testUser.id,
          refreshToken: 'expired-token',
          expiresAt: new Date(Date.now() - 86400000), // 24 hours ago
          lastUsedAt: new Date(Date.now() - 86400000),
        },
      })

      const initialSessionCount = await testPrisma.session.count()

      const result = await cleanupOldData({ maxAgeDays: 1, dryRun: true })

      expect(result.deletedRecords).toBe(0)
      expect(result.tablesAffected).toHaveLength(0)

      // Check that session still exists
      const finalSessionCount = await testPrisma.session.count()
      expect(finalSessionCount).toBe(initialSessionCount)
    })

    it('should skip cleanup if database size is within limit', async () => {
      const result = await cleanupOldData({ maxSizeMB: 1000, dryRun: false }) // Very high limit

      expect(result.deletedRecords).toBe(0)
      expect(result.tablesAffected).toHaveLength(0)
    })
  })

  describe('getDatabaseHealth', () => {
    it('should return database health metrics', async () => {
      // Create some test data
      await createTestProject(testUser.id)
      
      // Create some database stats for growth calculation
      await testPrisma.databaseStats.createMany({
        data: [
          {
            tableName: 'users',
            recordCount: 1,
            sizeBytes: 500,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          },
          {
            tableName: 'users',
            recordCount: 1,
            sizeBytes: 600,
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          },
        ],
      })

      const health = await getDatabaseHealth()

      expect(health).toBeDefined()
      expect(health.currentSize).toBeDefined()
      expect(health.currentSize.totalSizeBytes).toBeGreaterThan(0)
      expect(health.recentGrowth).toBeDefined()
      expect(Array.isArray(health.recommendations)).toBe(true)
    })

    it('should provide recommendations based on size', async () => {
      // Create many projects to increase size
      for (let i = 0; i < 5; i++) {
        await createTestProject(testUser.id, { title: `Project ${i}` })
      }

      // Create many messages to trigger message recommendation
      const conversation = await testPrisma.conversation.create({
        data: {
          projectId: (await createTestProject(testUser.id)).id,
          agentType: 'IDEATION',
        },
      })

      // Create many messages
      for (let i = 0; i < 15; i++) {
        await testPrisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'USER',
            content: `Message ${i}`,
          },
        })
      }

      const health = await getDatabaseHealth()

      expect(health.recommendations).toBeDefined()
      expect(Array.isArray(health.recommendations)).toBe(true)
      // Recommendations will depend on actual database size and message count
    })
  })
})