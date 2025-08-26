import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-agent-workflow.db'
    }
  }
})

// Mock external services
vi.mock('../../services/llm', () => ({
  LLMService: {
    generateResponse: vi.fn().mockResolvedValue({
      content: 'Mock AI response',
      usage: { tokens: 100, cost: 0.001 }
    })
  }
}))

vi.mock('promptlayer', () => ({
  PromptLayer: vi.fn().mockImplementation(() => ({
    track: vi.fn(),
    log: vi.fn()
  }))
}))

describe('Agent Workflow Integration Tests', () => {
  let authToken: string
  let userId: string
  let projectId: string

  beforeEach(async () => {
    // Clean database
    await prisma.user.deleteMany()
    await prisma.project.deleteMany()
    await prisma.conversation.deleteMany()

    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      })

    authToken = userResponse.body.token
    userId = userResponse.body.user.id

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Project',
        content: 'Initial content'
      })

    projectId = projectResponse.body.id
  })

  afterEach(async () => {
    await prisma.user.deleteMany()
    await prisma.project.deleteMany()
    await prisma.conversation.deleteMany()
  })

  test('Complete ideation workflow', async () => {
    // Start ideation phase
    const phaseResponse = await request(app)
      .post(`/api/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'ideation'
      })

    expect(phaseResponse.status).toBe(201)
    expect(phaseResponse.body.type).toBe('ideation')

    // Send message to ideation agent
    const messageResponse = await request(app)
      .post(`/api/projects/${projectId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'I want to write about sustainable technology',
        agentType: 'ideation'
      })

    expect(messageResponse.status).toBe(201)
    expect(messageResponse.body.role).toBe('user')
    expect(messageResponse.body.content).toBe('I want to write about sustainable technology')

    // Check that agent response was generated
    const conversationResponse = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(conversationResponse.status).toBe(200)
    expect(conversationResponse.body.length).toBeGreaterThan(0)
    
    const messages = conversationResponse.body[0].messages
    expect(messages).toHaveLength(2) // User message + agent response
    expect(messages[1].role).toBe('agent')
    expect(messages[1].agentType).toBe('ideation')
  })

  test('Phase transition from ideation to refinement', async () => {
    // Create ideation phase
    await request(app)
      .post(`/api/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ type: 'ideation' })

    // Complete ideation phase
    await request(app)
      .patch(`/api/projects/${projectId}/phases/ideation`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' })

    // Start refinement phase
    const refinementResponse = await request(app)
      .post(`/api/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ type: 'refinement' })

    expect(refinementResponse.status).toBe(201)
    expect(refinementResponse.body.type).toBe('refinement')

    // Send message to refiner agent
    const messageResponse = await request(app)
      .post(`/api/projects/${projectId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Please help me improve the structure of my draft',
        agentType: 'refiner'
      })

    expect(messageResponse.status).toBe(201)
    expect(messageResponse.body.agentType).toBe('refiner')
  })

  test('Media agent integration', async () => {
    // Start media phase
    await request(app)
      .post(`/api/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ type: 'media' })

    // Request meme generation
    const memeResponse = await request(app)
      .post(`/api/projects/${projectId}/media/meme`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        context: 'sustainable technology',
        memeType: 'drake'
      })

    expect(memeResponse.status).toBe(201)
    expect(memeResponse.body.type).toBe('meme')
    expect(memeResponse.body.url).toBeDefined()

    // Request image search
    const imageResponse = await request(app)
      .post(`/api/projects/${projectId}/media/images`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        query: 'renewable energy solar panels'
      })

    expect(imageResponse.status).toBe(200)
    expect(imageResponse.body.images).toBeDefined()
    expect(Array.isArray(imageResponse.body.images)).toBe(true)
  })

  test('Fact-checker agent integration', async () => {
    // Start fact-checking phase
    await request(app)
      .post(`/api/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ type: 'factcheck' })

    // Submit content for fact-checking
    const factCheckResponse = await request(app)
      .post(`/api/projects/${projectId}/factcheck`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Solar panels can generate electricity even on cloudy days. Wind turbines produce 50% of global renewable energy.'
      })

    expect(factCheckResponse.status).toBe(200)
    expect(factCheckResponse.body.claims).toBeDefined()
    expect(Array.isArray(factCheckResponse.body.claims)).toBe(true)
    expect(factCheckResponse.body.claims.length).toBeGreaterThan(0)

    // Check SEO suggestions
    const seoResponse = await request(app)
      .post(`/api/projects/${projectId}/seo`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Article about renewable energy and sustainable technology',
        targetKeywords: ['renewable energy', 'sustainable technology']
      })

    expect(seoResponse.status).toBe(200)
    expect(seoResponse.body.suggestions).toBeDefined()
    expect(seoResponse.body.keywords).toBeDefined()
  })

  test('Cost tracking and budget management', async () => {
    // Check initial cost tracking
    const costResponse = await request(app)
      .get(`/api/users/${userId}/usage`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(costResponse.status).toBe(200)
    expect(costResponse.body.totalCost).toBeDefined()
    expect(costResponse.body.tokenUsage).toBeDefined()

    // Make multiple agent requests to accumulate costs
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/projects/${projectId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: `Test message ${i}`,
          agentType: 'ideation'
        })
    }

    // Check updated costs
    const updatedCostResponse = await request(app)
      .get(`/api/users/${userId}/usage`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(updatedCostResponse.body.totalCost).toBeGreaterThan(costResponse.body.totalCost)
  })

  test('Error handling and recovery', async () => {
    // Test with invalid agent type
    const invalidAgentResponse = await request(app)
      .post(`/api/projects/${projectId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Test message',
        agentType: 'invalid-agent'
      })

    expect(invalidAgentResponse.status).toBe(400)
    expect(invalidAgentResponse.body.error).toContain('Invalid agent type')

    // Test with non-existent project
    const invalidProjectResponse = await request(app)
      .post('/api/projects/non-existent/messages')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Test message',
        agentType: 'ideation'
      })

    expect(invalidProjectResponse.status).toBe(404)
  })

  test('Concurrent agent requests handling', async () => {
    // Send multiple concurrent requests
    const promises = Array.from({ length: 3 }, (_, i) =>
      request(app)
        .post(`/api/projects/${projectId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: `Concurrent message ${i}`,
          agentType: 'ideation'
        })
    )

    const responses = await Promise.all(promises)

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(201)
    })

    // Check that all messages were processed
    const conversationResponse = await request(app)
      .get(`/api/projects/${projectId}/conversations`)
      .set('Authorization', `Bearer ${authToken}`)

    const totalMessages = conversationResponse.body.reduce(
      (total: number, conv: any) => total + conv.messages.length,
      0
    )

    expect(totalMessages).toBeGreaterThanOrEqual(6) // 3 user messages + 3 agent responses
  })
})