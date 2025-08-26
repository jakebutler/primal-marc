import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Server } from 'socket.io'
import { createServer } from 'http'
import jwt from 'jsonwebtoken'
import { SocketHandler } from '../../services/socket-handler.js'
import { testPrisma, setupTestDatabase, cleanupTestDatabase, createTestUser, createTestProject } from '../database-setup.js'

describe('SocketHandler', () => {
  let httpServer: any
  let io: Server
  let socketHandler: SocketHandler
  let testUser: any
  let testProject: any
  let authToken: string

  beforeEach(async () => {
    // Set up test database
    await setupTestDatabase()
    
    // Create test user
    testUser = await createTestUser()

    // Create test project
    testProject = await createTestProject(testUser.id)

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET || 'test-secret'
    )

    // Set up Socket.io server
    httpServer = createServer()
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Initialize socket handler
    socketHandler = new SocketHandler(io, testPrisma)

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve)
    })
  })

  afterEach(async () => {
    if (httpServer) {
      httpServer.close()
    }
    if (io) {
      io.close()
    }
    await cleanupTestDatabase()
  })

  describe('Authentication', () => {
    it('should authenticate valid token', (done) => {
      const Client = require('socket.io-client')
      const client = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: authToken
        }
      })

      client.on('connect', () => {
        expect(client.connected).toBe(true)
        client.disconnect()
        done()
      })

      client.on('connect_error', (error: Error) => {
        done(error)
      })
    })

    it('should reject invalid token', (done) => {
      const Client = require('socket.io-client')
      const client = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: 'invalid-token'
        }
      })

      client.on('connect', () => {
        done(new Error('Should not connect with invalid token'))
      })

      client.on('connect_error', (error: Error) => {
        expect(error.message).toContain('Invalid authentication token')
        done()
      })
    })

    it('should reject missing token', (done) => {
      const Client = require('socket.io-client')
      const client = Client(`http://localhost:${httpServer.address().port}`)

      client.on('connect', () => {
        done(new Error('Should not connect without token'))
      })

      client.on('connect_error', (error: Error) => {
        expect(error.message).toContain('Authentication token required')
        done()
      })
    })
  })

  describe('Conversation Management', () => {
    let client: any

    beforeEach((done) => {
      const Client = require('socket.io-client')
      client = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: authToken
        }
      })

      client.on('connect', () => {
        done()
      })
    })

    afterEach(() => {
      if (client) {
        client.disconnect()
      }
    })

    it('should join conversation successfully', (done) => {
      const conversationId = 'test-conversation-1'

      client.emit('joinConversation', {
        conversationId,
        projectId: testProject.id
      })

      client.on('conversationJoined', (data: any) => {
        expect(data.conversationId).toBe(conversationId)
        expect(data.participants).toContain(testUser.id)
        done()
      })

      client.on('error', (error: any) => {
        done(new Error(error.message))
      })
    })

    it('should reject joining conversation for unauthorized project', (done) => {
      const conversationId = 'test-conversation-2'
      const unauthorizedProjectId = 'unauthorized-project-id'

      client.emit('joinConversation', {
        conversationId,
        projectId: unauthorizedProjectId
      })

      client.on('error', (error: any) => {
        expect(error.message).toContain('Project not found or access denied')
        done()
      })
    })

    it('should leave conversation successfully', (done) => {
      const conversationId = 'test-conversation-3'

      // First join the conversation
      client.emit('joinConversation', {
        conversationId,
        projectId: testProject.id
      })

      client.on('conversationJoined', () => {
        // Then leave the conversation
        client.emit('leaveConversation', {
          conversationId
        })

        client.on('conversationLeft', (data: any) => {
          expect(data.conversationId).toBe(conversationId)
          expect(data.userId).toBe(testUser.id)
          done()
        })
      })
    })
  })

  describe('Message Handling', () => {
    let client: any
    const conversationId = 'test-conversation-messages'

    beforeEach((done) => {
      const Client = require('socket.io-client')
      client = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: authToken
        }
      })

      client.on('connect', () => {
        // Join conversation
        client.emit('joinConversation', {
          conversationId,
          projectId: testProject.id
        })

        client.on('conversationJoined', () => {
          done()
        })
      })
    })

    afterEach(() => {
      if (client) {
        client.disconnect()
      }
    })

    it('should send and receive messages', (done) => {
      const testMessage = {
        role: 'user',
        content: 'Hello, this is a test message'
      }

      client.emit('sendMessage', {
        conversationId,
        message: testMessage
      })

      client.on('message', (message: any) => {
        expect(message.role).toBe(testMessage.role)
        expect(message.content).toBe(testMessage.content)
        expect(message.id).toBeDefined()
        expect(message.timestamp).toBeDefined()
        done()
      })
    })

    it('should handle typing indicators', (done) => {
      client.emit('typing', {
        conversationId,
        isTyping: true
      })

      client.on('typingIndicator', (data: any) => {
        expect(data.userId).toBe(testUser.id)
        expect(data.isTyping).toBe(true)
        done()
      })
    })

    it('should store messages in database', async () => {
      const testMessage = {
        role: 'user',
        content: 'Database test message'
      }

      // Send message
      client.emit('sendMessage', {
        conversationId,
        message: testMessage
      })

      // Wait for message to be processed
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check database
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: true }
      })

      expect(conversation).toBeDefined()
      expect(conversation!.messages).toHaveLength(1)
      expect(conversation!.messages[0].content).toBe(testMessage.content)
      expect(conversation!.messages[0].role).toBe(testMessage.role)
    })
  })

  describe('Agent Response Handling', () => {
    let client: any
    const conversationId = 'test-conversation-agent'

    beforeEach((done) => {
      const Client = require('socket.io-client')
      client = Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: authToken
        }
      })

      client.on('connect', () => {
        client.emit('joinConversation', {
          conversationId,
          projectId: testProject.id
        })

        client.on('conversationJoined', () => {
          done()
        })
      })
    })

    afterEach(() => {
      if (client) {
        client.disconnect()
      }
    })

    it('should handle agent response request', (done) => {
      let typingReceived = false
      let streamReceived = false

      client.on('typingIndicator', (data: any) => {
        if (data.userId === 'agent' && data.agentType === 'ideation') {
          typingReceived = true
        }
      })

      client.on('messageStream', (data: any) => {
        expect(data.messageId).toBeDefined()
        streamReceived = true
        
        if (data.isComplete) {
          expect(typingReceived).toBe(true)
          expect(streamReceived).toBe(true)
          done()
        }
      })

      client.emit('requestAgentResponse', {
        conversationId,
        agentType: 'ideation',
        context: {
          projectId: testProject.id,
          recentMessages: []
        }
      })
    })
  })
})