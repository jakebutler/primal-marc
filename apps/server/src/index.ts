import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Initialize services
const prisma = new PrismaClient()

// Initialize cache service
const cacheService = new CacheService({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'primal-marc:',
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '1800'), // 30 minutes
  maxRetries: 3,
  retryDelayOnFailover: 100
})

// Initialize database optimization service
const dbOptimizationService = new DatabaseOptimizationService(defaultOptimizationConfig)

// Make services available globally
declare global {
  var cacheService: CacheService
  var dbOptimizationService: DatabaseOptimizationService
}
global.cacheService = cacheService
global.dbOptimizationService = dbOptimizationService

// Import security middleware
import { securityHeaders, sanitizeRequest, requestSizeLimit, slowRequestDetection, ipSecurity } from './middleware/security.js'
import { rateLimiters } from './middleware/rate-limiting.js'
import { auditRequest } from './middleware/audit-middleware.js'

// Security middleware (applied first)
app.use(securityHeaders())
app.use(sanitizeRequest())
app.use(requestSizeLimit(10 * 1024 * 1024)) // 10MB limit
app.use(slowRequestDetection(30000)) // 30 second threshold
app.use(ipSecurity())

// Session configuration for CSRF protection
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Enhanced helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.promptlayer.com", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With']
}))

// General rate limiting
app.use(rateLimiters.general.middleware())

// Audit logging (before other middleware)
app.use(auditRequest())

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Additional verification can be added here
    if (buf.length > 10 * 1024 * 1024) {
      throw new Error('Request entity too large')
    }
  }
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  const cacheStats = cacheService.getStats()
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: {
      healthy: cacheService.isHealthy(),
      stats: cacheStats
    }
  })
})

// Import routes
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import contentVersionRoutes from './routes/content-versions.js'
import llmRoutes from './routes/llm.js'
import mediaRoutes from './routes/media.js'
import workflowRoutes from './routes/workflow.js'
import exportRoutes from './routes/export.js'
import organizationRoutes from './routes/organization.js'
import searchRoutes from './routes/search.js'
import backupRoutes from './routes/backup.js'
import sharingRoutes from './routes/sharing.js'

// Import services
import { ContentVersioningService } from './services/content-versioning.js'
import { SocketHandler } from './services/socket-handler.js'
import { CacheService } from './services/cache-service.js'
import { connectDatabase } from './services/database.js'
import { DatabaseOptimizationService, defaultOptimizationConfig } from './services/database-optimization.js'

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/projects', contentVersionRoutes)
app.use('/api/llm', llmRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/workflow', workflowRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/organization', organizationRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/backup', backupRoutes)
app.use('/api/sharing', sharingRoutes)

app.get('/api/status', (req, res) => {
  res.json({ message: 'Primal Marc API is running' })
})

// Initialize Socket.io handler
const socketHandler = new SocketHandler(io, prisma)

// Import enhanced error handling
import { 
  errorHandler, 
  notFoundHandler, 
  gracefulShutdown, 
  healthCheck as enhancedHealthCheck,
  asyncHandler 
} from './middleware/error-handler.js'

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Enhanced 404 handler
app.use('*', notFoundHandler)

// Enhanced global error handler (must be last)
app.use(errorHandler)

const PORT = process.env.PORT || 3001

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV}`)
  
  // Initialize database with optimizations
  try {
    await connectDatabase()
    console.log('Database connected and optimized')
  } catch (error) {
    console.error('Failed to connect to database:', error)
  }
  
  // Initialize cache service
  try {
    await cacheService.initialize()
    console.log('Cache service initialized')
  } catch (error) {
    console.error('Failed to initialize cache service:', error)
  }
  
  // Initialize database optimization service
  try {
    await dbOptimizationService.initialize()
    console.log('Database optimization service initialized')
  } catch (error) {
    console.error('Failed to initialize database optimization service:', error)
  }
  
  // Initialize content versioning system
  try {
    await ContentVersioningService.initializeVersioningTable()
    console.log('Content versioning system initialized')
  } catch (error) {
    console.error('Failed to initialize content versioning:', error)
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await cacheService.shutdown()
  await prisma.$disconnect()
  server.close(() => {
    console.log('Process terminated')
  })
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  await dbOptimizationService.shutdown()
  await cacheService.shutdown()
  await prisma.$disconnect()
  server.close(() => {
    console.log('Process terminated')
  })
})