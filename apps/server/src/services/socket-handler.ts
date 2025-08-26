import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { AgentService } from './agent-service.js'

interface AuthenticatedSocket extends Socket {
  userId?: string
  user?: {
    id: string
    email: string
  }
}

interface SocketMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  agentType?: string
  isStreaming?: boolean
  isComplete?: boolean
}

interface ConversationRoom {
  conversationId: string
  projectId: string
  participants: Set<string>
}

export class SocketHandler {
  private io: Server
  private prisma: PrismaClient
  private agentService: AgentService
  private conversations: Map<string, ConversationRoom> = new Map()
  private userSockets: Map<string, AuthenticatedSocket> = new Map()

  constructor(io: Server, prisma: PrismaClient) {
    this.io = io
    this.prisma = prisma
    this.agentService = new AgentService()
    this.setupSocketHandlers()
  }

  private setupSocketHandlers() {
    this.io.use(this.authenticateSocket.bind(this))
    this.io.on('connection', this.handleConnection.bind(this))
  }

  private async authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth.token
      
      if (!token) {
        return next(new Error('Authentication token required'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      
      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      })

      if (!user) {
        return next(new Error('User not found'))
      }

      socket.userId = user.id
      socket.user = user
      next()
    } catch (error) {
      next(new Error('Invalid authentication token'))
    }
  }

  private handleConnection(socket: AuthenticatedSocket) {
    console.log(`User ${socket.user?.email} connected:`, socket.id)
    
    // Store user socket reference
    if (socket.userId) {
      this.userSockets.set(socket.userId, socket)
    }

    // Set up event handlers
    socket.on('joinConversation', this.handleJoinConversation.bind(this, socket))
    socket.on('leaveConversation', this.handleLeaveConversation.bind(this, socket))
    socket.on('sendMessage', this.handleSendMessage.bind(this, socket))
    socket.on('typing', this.handleTyping.bind(this, socket))
    socket.on('requestAgentResponse', this.handleAgentRequest.bind(this, socket))
    socket.on('disconnect', this.handleDisconnect.bind(this, socket))
  }

  private async handleJoinConversation(
    socket: AuthenticatedSocket, 
    data: { conversationId: string; projectId: string }
  ) {
    try {
      const { conversationId, projectId } = data

      // Verify user has access to the project
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          userId: socket.userId
        }
      })

      if (!project) {
        socket.emit('error', { message: 'Project not found or access denied' })
        return
      }

      // Join the conversation room
      socket.join(conversationId)

      // Track conversation
      if (!this.conversations.has(conversationId)) {
        this.conversations.set(conversationId, {
          conversationId,
          projectId,
          participants: new Set()
        })
      }

      const conversation = this.conversations.get(conversationId)!
      conversation.participants.add(socket.userId!)

      // Notify others in the conversation
      socket.to(conversationId).emit('conversationJoined', {
        conversationId,
        userId: socket.userId,
        participants: Array.from(conversation.participants)
      })

      console.log(`User ${socket.user?.email} joined conversation ${conversationId}`)
    } catch (error) {
      console.error('Error joining conversation:', error)
      socket.emit('error', { message: 'Failed to join conversation' })
    }
  }

  private handleLeaveConversation(
    socket: AuthenticatedSocket, 
    data: { conversationId: string }
  ) {
    const { conversationId } = data
    
    socket.leave(conversationId)
    
    const conversation = this.conversations.get(conversationId)
    if (conversation && socket.userId) {
      conversation.participants.delete(socket.userId)
      
      // Notify others
      socket.to(conversationId).emit('conversationLeft', {
        conversationId,
        userId: socket.userId
      })

      // Clean up empty conversations
      if (conversation.participants.size === 0) {
        this.conversations.delete(conversationId)
      }
    }

    console.log(`User ${socket.user?.email} left conversation ${conversationId}`)
  }

  private async handleSendMessage(
    socket: AuthenticatedSocket, 
    data: { conversationId: string; message: Omit<SocketMessage, 'id' | 'timestamp'> }
  ) {
    try {
      const { conversationId, message } = data

      const fullMessage: SocketMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: new Date()
      }

      // Store message in database
      const conversation = this.conversations.get(conversationId)
      if (conversation) {
        await this.prisma.conversation.upsert({
          where: { id: conversationId },
          update: {
            updatedAt: new Date()
          },
          create: {
            id: conversationId,
            projectId: conversation.projectId,
            agentType: message.agentType || 'general',
            messages: {
              create: {
                id: fullMessage.id,
                role: fullMessage.role,
                content: fullMessage.content,
                agentType: fullMessage.agentType,
                timestamp: fullMessage.timestamp
              }
            }
          }
        })
      }

      // Broadcast message to all participants
      this.io.to(conversationId).emit('message', fullMessage)

      console.log(`Message sent in conversation ${conversationId}:`, fullMessage.content.substring(0, 50))
    } catch (error) {
      console.error('Error sending message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  }

  private handleTyping(
    socket: AuthenticatedSocket, 
    data: { conversationId: string; isTyping: boolean }
  ) {
    const { conversationId, isTyping } = data
    
    socket.to(conversationId).emit('typingIndicator', {
      userId: socket.userId,
      isTyping,
      agentType: undefined // User typing
    })
  }

  private async handleAgentRequest(
    socket: AuthenticatedSocket, 
    data: { conversationId: string; agentType: string; context: any }
  ) {
    try {
      const { conversationId, agentType, context } = data

      // Send typing indicator for agent
      this.io.to(conversationId).emit('typingIndicator', {
        userId: 'agent',
        isTyping: true,
        agentType
      })

      // Get conversation context
      const conversation = this.conversations.get(conversationId)
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' })
        return
      }

      // Get project and recent messages for context
      const project = await this.prisma.project.findUnique({
        where: { id: conversation.projectId },
        include: {
          conversations: {
            where: { id: conversationId },
            include: {
              messages: {
                orderBy: { timestamp: 'desc' },
                take: 10
              }
            }
          }
        }
      })

      if (!project) {
        socket.emit('error', { message: 'Project not found' })
        return
      }

      // Prepare agent context
      const agentContext = {
        projectId: conversation.projectId,
        projectContent: project.content,
        recentMessages: project.conversations[0]?.messages || [],
        userContext: context
      }

      // Generate agent response with streaming
      const messageId = crypto.randomUUID()
      let fullResponse = ''

      const responseStream = await this.agentService.generateResponse(
        agentType,
        agentContext,
        (chunk: string) => {
          fullResponse += chunk
          this.io.to(conversationId).emit('messageStream', {
            messageId,
            chunk,
            isComplete: false
          })
        }
      )

      // Send final complete message
      this.io.to(conversationId).emit('messageStream', {
        messageId,
        chunk: '',
        isComplete: true
      })

      // Stop typing indicator
      this.io.to(conversationId).emit('typingIndicator', {
        userId: 'agent',
        isTyping: false,
        agentType
      })

      // Store agent response in database
      await this.prisma.message.create({
        data: {
          id: messageId,
          conversationId,
          role: 'agent',
          content: fullResponse,
          agentType,
          timestamp: new Date()
        }
      })

      console.log(`Agent ${agentType} responded in conversation ${conversationId}`)
    } catch (error) {
      console.error('Error generating agent response:', error)
      
      // Stop typing indicator on error
      this.io.to(data.conversationId).emit('typingIndicator', {
        userId: 'agent',
        isTyping: false,
        agentType: data.agentType
      })
      
      socket.emit('error', { message: 'Failed to generate agent response' })
    }
  }

  private handleDisconnect(socket: AuthenticatedSocket) {
    console.log(`User ${socket.user?.email} disconnected:`, socket.id)
    
    // Clean up user socket reference
    if (socket.userId) {
      this.userSockets.delete(socket.userId)
    }

    // Remove from all conversations
    for (const [conversationId, conversation] of this.conversations.entries()) {
      if (socket.userId && conversation.participants.has(socket.userId)) {
        conversation.participants.delete(socket.userId)
        
        // Notify others
        socket.to(conversationId).emit('conversationLeft', {
          conversationId,
          userId: socket.userId
        })

        // Clean up empty conversations
        if (conversation.participants.size === 0) {
          this.conversations.delete(conversationId)
        }
      }
    }
  }

  // Public methods for external use
  public sendMessageToUser(userId: string, event: string, data: any) {
    const userSocket = this.userSockets.get(userId)
    if (userSocket) {
      userSocket.emit(event, data)
    }
  }

  public sendMessageToConversation(conversationId: string, event: string, data: any) {
    this.io.to(conversationId).emit(event, data)
  }

  public getConversationParticipants(conversationId: string): string[] {
    const conversation = this.conversations.get(conversationId)
    return conversation ? Array.from(conversation.participants) : []
  }
}