import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { randomBytes } from 'crypto'
import path from 'path'
import fs from 'fs'

// Create a unique test database for each test run
const testDbName = `test_${randomBytes(8).toString('hex')}.db`
const testDbPath = path.join(process.cwd(), 'test-databases', testDbName)
const testDbUrl = `file:${testDbPath}`

// Ensure test databases directory exists
const testDbDir = path.dirname(testDbPath)
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true })
}

// Set test database URL
process.env.DATABASE_URL = testDbUrl

// Create test Prisma client
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
})

/**
 * Setup test database with schema
 */
export async function setupTestDatabase() {
  try {
    // Run migrations to create schema
    execSync(`npx prisma db push --schema=../../prisma/schema.prisma --force-reset`, {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'pipe',
    })
    
    // Connect to database
    await testPrisma.$connect()
    
    console.log(`Test database created: ${testDbName}`)
  } catch (error) {
    console.error('Failed to setup test database:', error)
    throw error
  }
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase() {
  try {
    await testPrisma.$disconnect()
    
    // Remove test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    
    console.log(`Test database cleaned up: ${testDbName}`)
  } catch (error) {
    console.error('Failed to cleanup test database:', error)
  }
}

/**
 * Clear all data from test database
 */
export async function clearTestData() {
  try {
    // Delete in order to respect foreign key constraints
    await testPrisma.message.deleteMany()
    await testPrisma.conversation.deleteMany()
    await testPrisma.lLMUsage.deleteMany()
    await testPrisma.projectPhase.deleteMany()
    await testPrisma.project.deleteMany()
    await testPrisma.session.deleteMany()
    await testPrisma.databaseStats.deleteMany()
    await testPrisma.user.deleteMany()
  } catch (error) {
    console.error('Failed to clear test data:', error)
    throw error
  }
}

/**
 * Create test user
 */
export async function createTestUser(overrides: any = {}) {
  const uniqueEmail = `test-${randomBytes(4).toString('hex')}@example.com`
  return await testPrisma.user.create({
    data: {
      email: uniqueEmail,
      passwordHash: 'hashed_password',
      firstName: 'Test',
      lastName: 'User',
      experienceLevel: 'BEGINNER',
      preferences: JSON.stringify({
        preferredAgentPersonality: 'casual',
        autoSaveInterval: 30000,
        notificationSettings: {
          emailNotifications: true,
          pushNotifications: false,
          weeklyDigest: true,
        },
      }),
      writingGenres: JSON.stringify(['fiction', 'blog']),
      ...overrides,
    },
  })
}

/**
 * Create test project
 */
export async function createTestProject(userId: string, overrides: any = {}) {
  return await testPrisma.project.create({
    data: {
      userId,
      title: 'Test Project',
      content: 'This is test content for the project.',
      status: 'DRAFT',
      metadata: JSON.stringify({
        wordCount: 8,
        estimatedReadTime: 1,
        tags: ['test'],
        targetAudience: 'developers',
      }),
      ...overrides,
    },
  })
}