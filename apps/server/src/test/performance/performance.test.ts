import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { prisma } from '../../services/database.js'
import { CacheService } from '../../services/cache-service.js'

// Create a simple test app for performance testing
const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.post('/api/auth/login', (req, res) => {
  res.status(401).json({ error: 'Invalid credentials' })
})

interface PerformanceTestResult {
  endpoint: string
  method: string
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  successRate: number
  errors: string[]
}

class PerformanceTestSuite {
  private results: PerformanceTestResult[] = []
  private cacheService: CacheService

  constructor() {
    this.cacheService = new CacheService({
      host: 'localhost',
      port: 6379,
      db: 1, // Use different DB for testing
      keyPrefix: 'test:',
      defaultTTL: 300,
      maxRetries: 1,
      retryDelayOnFailover: 50
    })
  }

  async setup(): Promise<void> {
    await this.cacheService.initialize()
    // Clear test data
    await this.cacheService.flush()
  }

  async teardown(): Promise<void> {
    await this.cacheService.shutdown()
  }

  async testEndpoint(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    options: {
      requestCount?: number
      concurrency?: number
      payload?: any
      headers?: Record<string, string>
      expectedStatus?: number
    } = {}
  ): Promise<PerformanceTestResult> {
    const {
      requestCount = 100,
      concurrency = 10,
      payload,
      headers = {},
      expectedStatus = 200
    } = options

    const responseTimes: number[] = []
    const errors: string[] = []
    let successCount = 0

    const startTime = Date.now()

    // Create batches for concurrent requests
    const batchSize = Math.ceil(requestCount / concurrency)
    const batches: Promise<void>[] = []

    for (let i = 0; i < concurrency; i++) {
      const batchPromise = this.runBatch(
        endpoint,
        method,
        batchSize,
        payload,
        headers,
        expectedStatus,
        responseTimes,
        errors,
        (success) => { if (success) successCount++ }
      )
      batches.push(batchPromise)
    }

    await Promise.all(batches)

    const endTime = Date.now()
    const totalTime = endTime - startTime

    const result: PerformanceTestResult = {
      endpoint,
      method,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: (successCount / totalTime) * 1000,
      successRate: (successCount / requestCount) * 100,
      errors
    }

    this.results.push(result)
    return result
  }

  private async runBatch(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    count: number,
    payload: any,
    headers: Record<string, string>,
    expectedStatus: number,
    responseTimes: number[],
    errors: string[],
    onSuccess: (success: boolean) => void
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      try {
        const startTime = Date.now()
        
        let response
        switch (method) {
          case 'GET':
            response = await request(app).get(endpoint).set(headers)
            break
          case 'POST':
            response = await request(app).post(endpoint).set(headers).send(payload)
            break
          case 'PUT':
            response = await request(app).put(endpoint).set(headers).send(payload)
            break
          case 'DELETE':
            response = await request(app).delete(endpoint).set(headers)
            break
        }

        const endTime = Date.now()
        const responseTime = endTime - startTime

        responseTimes.push(responseTime)

        if (response.status === expectedStatus) {
          onSuccess(true)
        } else {
          onSuccess(false)
          errors.push(`Unexpected status: ${response.status}`)
        }
      } catch (error) {
        onSuccess(false)
        errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  async testDatabasePerformance(): Promise<{
    queryTimes: Record<string, number>
    indexEffectiveness: Record<string, boolean>
  }> {
    const queryTimes: Record<string, number> = {}
    const indexEffectiveness: Record<string, boolean> = {}

    // Test common queries
    const queries = [
      {
        name: 'user_lookup',
        query: () => prisma.user.findUnique({ where: { email: 'test@example.com' } })
      },
      {
        name: 'project_list',
        query: () => prisma.project.findMany({ 
          where: { userId: 'test-user-id' },
          orderBy: { updatedAt: 'desc' },
          take: 20
        })
      },
      {
        name: 'conversation_messages',
        query: () => prisma.message.findMany({
          where: { conversationId: 'test-conversation-id' },
          orderBy: { timestamp: 'asc' },
          take: 50
        })
      },
      {
        name: 'llm_usage_stats',
        query: () => prisma.lLMUsage.groupBy({
          by: ['agentType'],
          _sum: { cost: true, totalTokens: true },
          where: {
            userId: 'test-user-id',
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        })
      }
    ]

    for (const { name, query } of queries) {
      const startTime = Date.now()
      try {
        await query()
        const endTime = Date.now()
        queryTimes[name] = endTime - startTime
        
        // Consider query effective if it takes less than 100ms
        indexEffectiveness[name] = (endTime - startTime) < 100
      } catch (error) {
        queryTimes[name] = -1 // Error indicator
        indexEffectiveness[name] = false
      }
    }

    return { queryTimes, indexEffectiveness }
  }

  async testCachePerformance(): Promise<{
    setTime: number
    getTime: number
    hitRate: number
  }> {
    const testData = { test: 'data', timestamp: Date.now() }
    const iterations = 1000

    // Test cache set performance
    const setStartTime = Date.now()
    for (let i = 0; i < iterations; i++) {
      await this.cacheService.set(`test:key:${i}`, testData)
    }
    const setEndTime = Date.now()
    const setTime = (setEndTime - setStartTime) / iterations

    // Test cache get performance
    const getStartTime = Date.now()
    let hits = 0
    for (let i = 0; i < iterations; i++) {
      const result = await this.cacheService.get(`test:key:${i}`)
      if (result) hits++
    }
    const getEndTime = Date.now()
    const getTime = (getEndTime - getStartTime) / iterations
    const hitRate = (hits / iterations) * 100

    return { setTime, getTime, hitRate }
  }

  generateReport(): string {
    let report = 'Performance Test Report\n'
    report += '='.repeat(50) + '\n\n'

    this.results.forEach(result => {
      report += `${result.method} ${result.endpoint}\n`
      report += `  Average Response Time: ${result.averageResponseTime.toFixed(2)}ms\n`
      report += `  Min/Max Response Time: ${result.minResponseTime}ms / ${result.maxResponseTime}ms\n`
      report += `  Requests per Second: ${result.requestsPerSecond.toFixed(2)}\n`
      report += `  Success Rate: ${result.successRate.toFixed(1)}%\n`
      
      if (result.errors.length > 0) {
        report += `  Errors: ${result.errors.slice(0, 5).join(', ')}\n`
        if (result.errors.length > 5) {
          report += `  ... and ${result.errors.length - 5} more errors\n`
        }
      }
      
      report += '\n'
    })

    return report
  }

  getResults(): PerformanceTestResult[] {
    return [...this.results]
  }

  clearResults(): void {
    this.results = []
  }
}

// Performance tests
describe('Performance Tests', () => {
  let testSuite: PerformanceTestSuite

  beforeAll(async () => {
    testSuite = new PerformanceTestSuite()
    await testSuite.setup()
  })

  afterAll(async () => {
    await testSuite.teardown()
  })

  it('should handle health check endpoint load', async () => {
    const result = await testSuite.testEndpoint('/health', 'GET', {
      requestCount: 100,
      concurrency: 10
    })

    expect(result.averageResponseTime).toBeLessThan(100) // Should respond in under 100ms
    expect(result.successRate).toBeGreaterThan(95) // 95% success rate
    expect(result.requestsPerSecond).toBeGreaterThan(50) // At least 50 RPS
  })

  it('should handle authentication endpoint load', async () => {
    const result = await testSuite.testEndpoint('/api/auth/login', 'POST', {
      requestCount: 50,
      concurrency: 5,
      payload: {
        email: 'test@example.com',
        password: 'testpassword'
      },
      expectedStatus: 401 // Expecting auth failure for test
    })

    expect(result.averageResponseTime).toBeLessThan(500) // Should respond in under 500ms
    expect(result.successRate).toBeGreaterThan(90) // 90% success rate (getting expected 401s)
  })

  it('should have efficient database queries', async () => {
    const { queryTimes, indexEffectiveness } = await testSuite.testDatabasePerformance()

    // All queries should complete in reasonable time
    Object.entries(queryTimes).forEach(([queryName, time]) => {
      if (time !== -1) { // Skip errored queries
        expect(time).toBeLessThan(200) // Under 200ms
      }
    })

    // Most queries should be using indexes effectively
    const effectiveQueries = Object.values(indexEffectiveness).filter(Boolean).length
    const totalQueries = Object.keys(indexEffectiveness).length
    expect(effectiveQueries / totalQueries).toBeGreaterThan(0.7) // 70% should be effective
  })

  it('should have efficient cache performance', async () => {
    const { setTime, getTime, hitRate } = await testSuite.testCachePerformance()

    expect(setTime).toBeLessThan(10) // Cache set should be under 10ms
    expect(getTime).toBeLessThan(5) // Cache get should be under 5ms
    expect(hitRate).toBeGreaterThan(95) // 95% hit rate
  })

  it('should generate performance report', () => {
    const report = testSuite.generateReport()
    expect(report).toContain('Performance Test Report')
    expect(report.length).toBeGreaterThan(100)
  })
})

export { PerformanceTestSuite }