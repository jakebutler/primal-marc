import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Set up test environment variables
process.env.DATABASE_URL = 'file:./test.db'
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
process.env.NODE_ENV = 'test'

// Test database setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

beforeAll(async () => {
  // Create test database schema
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      firstName TEXT,
      lastName TEXT,
      bio TEXT,
      preferences TEXT,
      writingGenres TEXT,
      experienceLevel TEXT DEFAULT 'BEGINNER'
    )
  `
  
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      refreshToken TEXT UNIQUE NOT NULL,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastUsedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      currentPhase TEXT DEFAULT 'ideation',
      status TEXT DEFAULT 'active',
      metadata TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      agentType TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agentType TEXT,
      metadata TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `
  
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)
  `
  
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt)
  `

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_projects_userId ON projects(userId)
  `

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_conversations_projectId ON conversations(projectId)
  `

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_messages_conversationId ON messages(conversationId)
  `
})

afterAll(async () => {
  // Clean up test database
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Clean database state before each test
  await prisma.$executeRaw`DELETE FROM messages`
  await prisma.$executeRaw`DELETE FROM conversations`
  await prisma.$executeRaw`DELETE FROM projects`
  await prisma.$executeRaw`DELETE FROM sessions`
  await prisma.$executeRaw`DELETE FROM users`
})

afterEach(async () => {
  // Clean up after each test - already handled in beforeEach
})

// Mock external services
global.fetch = async (url: string, options?: RequestInit) => {
  // Mock fetch for external API calls
  return new Response(JSON.stringify({ mocked: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}