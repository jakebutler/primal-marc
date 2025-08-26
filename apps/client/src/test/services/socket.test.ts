import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { io } from 'socket.io-client'
import socketService from '@/services/socket'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn()
}))

describe('SocketService', () => {
  let mockSocket: any

  beforeEach(() => {
    mockSocket = {
      id: 'mock-socket-id',
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      join: vi.fn(),
      leave: vi.fn()
    }

    ;(io as any).mockReturnValue(mockSocket)
    
    // Mock environment variables
    vi.stubEnv('VITE_SERVER_URL', 'http://localhost:3001')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    socketService.disconnect()
  })

  describe('Connection Management', () => {
    it('should connect successfully with token', async () => {
      const token = 'test-token'
      
      // Mock successful connection
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0)
        }
      })

      const connectPromise = socketService.connect(token)
      
      await expect(connectPromise).resolves.toBeUndefined()
      
      expect(io).toHaveBeenCalledWith('http://localhost:3001', {
        auth: { token },
        transports: ['websocket', 'polling']
      })
    })

    it('should handle connection errors', async () => {
      const token = 'invalid-token'
      const error = new Error('Authentication failed')
      
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(error), 0)
        }
      })

      const connectPromise = socketService.connect(token)
      
      await expect(connectPromise).rejects.toThrow('Authentication failed')
    })

    it('should disconnect properly', () => {
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0)
        }
      })

      socketService.connect('test-token')
      socketService.disconnect()
      
      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('should handle reconnection attempts', async () => {
      let connectionStatusCallback: Function | undefined

      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0)
        } else if (event === 'reconnect_attempt') {
          setTimeout(() => callback(), 0)
        }
      })

      // Set up connection status listener
      socketService.on('connectionStatusChanged', (status) => {
        connectionStatusCallback = status
      })

      await socketService.connect('test-token')
      
      // Simulate reconnection attempt
      const reconnectHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'reconnect_attempt'
      )?.[1]
      
      if (reconnectHandler) {
        reconnectHandler()
      }

      expect(socketService.status.reconnecting).toBe(true)
    })
  })

  describe('Conversation Management', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0)
        }
      })
      
      await socketService.connect('test-token')
    })

    it('should join conversation', () => {
      const conversationId = 'test-conversation'
      const projectId = 'test-project'
      
      socketService.joinConversation(conversationId, projectId)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('joinConversation', {
        conversationId,
        projectId
      })
    })

    it('should leave conversation', () => {
      const conversationId = 'test-conversation'
      
      socketService.leaveConversation(conversationId)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('leaveConversation', {
        conversationId
      })
    })
  })

  describe('Message Handling', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0)
        }
      })
      
      await socketService.connect('test-token')
    })

    it('should send message', () => {
      const conversationId = 'test-conversation'
      const message = {
        role: 'user' as const,
        content: 'Hello, world!'
      }
      
      socketService.sendMessage(conversationId, message)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('sendMessage', {
        conversationId,
        message: expect.objectContaining({
          ...message,
          id: expect.any(String),
          timestamp: expect.any(Date)
        })
      })
    })

    it('should send typing indicator', () => {
      const conversationId = 'test-conversation'
      const isTyping = true
      
      socketService.sendTypingIndicator(conversationId, isTyping)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('typing', {
        conversationId,
        isTyping
      })
    })

    it('should request agent response', () => {
      const conversationId = 'test-conversation'
      const agentType = 'ideation'
      const context = { projectId: 'test-project' }
      
      socketService.requestAgentResponse(conversationId, agentType, context)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('requestAgentResponse', {
        conversationId,
        agentType,
        context
      })
    })

    it('should handle incoming messages', () => {
      const messageHandler = vi.fn()
      socketService.on('message', messageHandler)
      
      const mockMessage = {
        id: 'msg-1',
        role: 'agent',
        content: 'Hello from agent',
        timestamp: new Date(),
        agentType: 'ideation'
      }
      
      // Simulate receiving message
      const socketMessageHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1]
      
      if (socketMessageHandler) {
        socketMessageHandler(mockMessage)
      }
      
      expect(messageHandler).toHaveBeenCalledWith(mockMessage)
    })

    it('should handle message streaming', () => {
      const streamHandler = vi.fn()
      socketService.on('messageStream', streamHandler)
      
      const streamData = {
        messageId: 'stream-1',
        chunk: 'Hello ',
        isComplete: false
      }
      
      // Simulate receiving stream data
      const socketStreamHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'messageStream'
      )?.[1]
      
      if (socketStreamHandler) {
        socketStreamHandler(streamData)
      }
      
      expect(streamHandler).toHaveBeenCalledWith(streamData)
    })
  })

  describe('Event Listener Management', () => {
    it('should add event listeners', () => {
      const callback = vi.fn()
      
      socketService.on('test-event', callback)
      
      // Trigger the event internally
      socketService['emit']('test-event', { data: 'test' })
      
      expect(callback).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should remove specific event listener', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      socketService.on('test-event', callback1)
      socketService.on('test-event', callback2)
      
      socketService.off('test-event', callback1)
      
      // Trigger the event
      socketService['emit']('test-event', { data: 'test' })
      
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should remove all event listeners for an event', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      socketService.on('test-event', callback1)
      socketService.on('test-event', callback2)
      
      socketService.off('test-event')
      
      // Trigger the event
      socketService['emit']('test-event', { data: 'test' })
      
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    })
  })

  describe('Status Properties', () => {
    it('should return connection status', () => {
      expect(socketService.isConnected).toBe(false)
      expect(socketService.status).toEqual({
        connected: false,
        reconnecting: false
      })
    })

    it('should return socket ID when connected', async () => {
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0)
        }
      })
      
      await socketService.connect('test-token')
      
      expect(socketService.socketId).toBe('mock-socket-id')
    })
  })
})