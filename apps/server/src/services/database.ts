import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger.js'

// SQLite optimization configuration
const prismaConfig = {
  log: [
    { level: 'query' as const, emit: 'event' as const },
    { level: 'error' as const, emit: 'stdout' as const },
    { level: 'warn' as const, emit: 'stdout' as const },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
}

// Create Prisma client with SQLite optimizations
export const prisma = new PrismaClient(prismaConfig)

// SQLite-specific optimizations
export async function optimizeSQLite() {
  try {
    // Enable WAL mode for better concurrency
    await prisma.$executeRaw`PRAGMA journal_mode = WAL;`
    
    // Set synchronous mode to NORMAL for better performance
    await prisma.$executeRaw`PRAGMA synchronous = NORMAL;`
    
    // Set cache size (negative value means KB, positive means pages)
    await prisma.$executeRaw`PRAGMA cache_size = -64000;` // 64MB cache
    
    // Enable foreign key constraints
    await prisma.$executeRaw`PRAGMA foreign_keys = ON;`
    
    // Set temp store to memory for better performance
    await prisma.$executeRaw`PRAGMA temp_store = MEMORY;`
    
    // Set mmap size for memory-mapped I/O (256MB)
    await prisma.$executeRaw`PRAGMA mmap_size = 268435456;`
    
    logger.info('SQLite optimizations applied successfully')
  } catch (error) {
    logger.error('Failed to apply SQLite optimizations:', error)
  }
}

// Database connection management
export async function connectDatabase() {
  try {
    await prisma.$connect()
    await optimizeSQLite()
    logger.info('Database connected successfully')
  } catch (error) {
    logger.error('Failed to connect to database:', error)
    throw error
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect()
    logger.info('Database disconnected successfully')
  } catch (error) {
    logger.error('Failed to disconnect from database:', error)
  }
}

// Query logging for development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug(`Query: ${e.query}`)
    logger.debug(`Duration: ${e.duration}ms`)
  })
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectDatabase()
})

process.on('SIGINT', async () => {
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectDatabase()
  process.exit(0)
})