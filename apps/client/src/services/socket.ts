import { io, Socket } from 'socket.io-client'

export interface SocketMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  agentType?: string
  isStreaming?: boolean
  isComplete?: boolean
}

export interface TypingIndicator {
  userId: string
  isTyping: boolean
  agentType?: string
}

export interface ConnectionStatus {
  connected: boolean
  reconnecting: boolean
  error?: string
}

class SocketService {
  private socket: Socket | null = null
  private connectionStatus: ConnectionStatus = { connected: false, reconnecting: false }
  private listeners: Map<string, Function[]> = new Map()

  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
      
      this.socket = io(serverUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling']
      })

      this.socket.on('connect', () => {
        console.log('Connected to server:', this.socket?.id)
        this.connectionStatus = { connected: true, reconnecting: false }
        this.emit('connectionStatusChanged', this.connectionStatus)
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error)
        this.connectionStatus = { connected: false, reconnecting: false, error: error.message }
        this.emit('connectionStatusChanged', this.connectionStatus)
        reject(error)
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason)
        this.connectionStatus = { connected: false, reconnecting: reason === 'io server disconnect' ? false : true }
        this.emit('connectionStatusChanged', this.connectionStatus)
      })

      this.socket.on('reconnect', () => {
        console.log('Reconnected to server')
        this.connectionStatus = { connected: true, reconnecting: false }
        this.emit('connectionStatusChanged', this.connectionStatus)
      })

      this.socket.on('reconnect_attempt', () => {
        console.log('Attempting to reconnect...')
        this.connectionStatus = { connected: false, reconnecting: true }
        this.emit('connectionStatusChanged', this.connectionStatus)
      })

      // Set up message handlers
      this.setupMessageHandlers()
    })
  }

  private setupMessageHandlers() {
    if (!this.socket) return

    this.socket.on('message', (message: SocketMessage) => {
      this.emit('message', message)
    })

    this.socket.on('messageStream', (data: { messageId: string; chunk: string; isComplete: boolean }) => {
      this.emit('messageStream', data)
    })

    this.socket.on('typingIndicator', (data: TypingIndicator) => {
      this.emit('typingIndicator', data)
    })

    this.socket.on('conversationJoined', (data: { conversationId: string; participants: string[] }) => {
      this.emit('conversationJoined', data)
    })

    this.socket.on('conversationLeft', (data: { conversationId: string; userId: string }) => {
      this.emit('conversationLeft', data)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connectionStatus = { connected: false, reconnecting: false }
      this.emit('connectionStatusChanged', this.connectionStatus)
    }
  }

  // Join a conversation room
  joinConversation(conversationId: string, projectId: string) {
    if (this.socket) {
      this.socket.emit('joinConversation', { conversationId, projectId })
    }
  }

  // Leave a conversation room
  leaveConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('leaveConversation', { conversationId })
    }
  }

  // Send a message
  sendMessage(conversationId: string, message: Omit<SocketMessage, 'id' | 'timestamp'>) {
    if (this.socket) {
      this.socket.emit('sendMessage', {
        conversationId,
        message: {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date()
        }
      })
    }
  }

  // Send typing indicator
  sendTypingIndicator(conversationId: string, isTyping: boolean) {
    if (this.socket) {
      this.socket.emit('typing', { conversationId, isTyping })
    }
  }

  // Request AI agent response
  requestAgentResponse(conversationId: string, agentType: string, context: any) {
    if (this.socket) {
      this.socket.emit('requestAgentResponse', {
        conversationId,
        agentType,
        context
      })
    }
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback?: Function) {
    if (!callback) {
      this.listeners.delete(event)
      return
    }
    
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  // Getters
  get isConnected() {
    return this.connectionStatus.connected
  }

  get status() {
    return this.connectionStatus
  }

  get socketId() {
    return this.socket?.id
  }
}

// Export singleton instance
export const socketService = new SocketService()
export default socketService