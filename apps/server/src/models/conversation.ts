import { prisma } from '../services/database.js'
import { ConversationContext, MessageMetadata } from '@primal-marc/shared'
import { logger } from '../utils/logger.js'

export class ConversationModel {
  /**
   * Create a new conversation
   */
  static async create(data: {
    projectId: string
    agentType: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'
    context?: ConversationContext
  }) {
    try {
      const conversation = await prisma.conversation.create({
        data: {
          projectId: data.projectId,
          agentType: data.agentType,
          context: data.context ? JSON.stringify(data.context) : null,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      
      logger.info(`Conversation created: ${conversation.id} for project ${data.projectId}`)
      return conversation
    } catch (error) {
      logger.error('Failed to create conversation:', error)
      throw error
    }
  }
  
  /**
   * Find conversation by ID
   */
  static async findById(id: string) {
    try {
      return await prisma.conversation.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              userId: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    } catch (error) {
      logger.error('Failed to find conversation:', error)
      throw error
    }
  }
  
  /**
   * Find conversations by project ID
   */
  static async findByProjectId(projectId: string, agentType?: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER') {
    try {
      const where: any = { projectId }
      if (agentType) where.agentType = agentType
      
      return await prisma.conversation.findMany({
        where,
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10, // Limit for performance
          },
        },
        orderBy: { updatedAt: 'desc' },
      })
    } catch (error) {
      logger.error('Failed to find conversations by project:', error)
      throw error
    }
  }
  
  /**
   * Update conversation context
   */
  static async updateContext(id: string, context: ConversationContext) {
    try {
      return await prisma.conversation.update({
        where: { id },
        data: {
          context: JSON.stringify(context),
        },
      })
    } catch (error) {
      logger.error('Failed to update conversation context:', error)
      throw error
    }
  }
  
  /**
   * Add message to conversation
   */
  static async addMessage(conversationId: string, data: {
    role: 'USER' | 'AGENT' | 'SYSTEM'
    content: string
    metadata?: MessageMetadata
  }) {
    try {
      const message = await prisma.message.create({
        data: {
          conversationId,
          role: data.role,
          content: data.content,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
      })
      
      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })
      
      return message
    } catch (error) {
      logger.error('Failed to add message to conversation:', error)
      throw error
    }
  }
  
  /**
   * Get conversation context with defaults
   */
  static getConversationContext(conversation: { context?: string | null }): ConversationContext | null {
    if (!conversation.context) return null
    
    try {
      return JSON.parse(conversation.context)
    } catch {
      return null
    }
  }
  
  /**
   * Get message metadata with defaults
   */
  static getMessageMetadata(message: { metadata?: string | null }): MessageMetadata | null {
    if (!message.metadata) return null
    
    try {
      return JSON.parse(message.metadata)
    } catch {
      return null
    }
  }
  
  /**
   * Get conversation summary for context
   */
  static async getSummary(conversationId: string, maxMessages = 10) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: maxMessages,
          },
        },
      })
      
      if (!conversation) return null
      
      const messages = conversation.messages.reverse() // Chronological order
      const summary = {
        id: conversation.id,
        agentType: conversation.agentType,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1],
        context: this.getConversationContext(conversation),
      }
      
      return summary
    } catch (error) {
      logger.error('Failed to get conversation summary:', error)
      throw error
    }
  }
  
  /**
   * Delete conversation and all messages
   */
  static async delete(id: string) {
    try {
      await prisma.conversation.delete({
        where: { id },
      })
      
      logger.info(`Conversation deleted: ${id}`)
    } catch (error) {
      logger.error('Failed to delete conversation:', error)
      throw error
    }
  }
}

export class MessageModel {
  /**
   * Find messages by conversation ID with pagination
   */
  static async findByConversationId(conversationId: string, options: {
    limit?: number
    offset?: number
    before?: Date
  } = {}) {
    try {
      const { limit = 50, offset = 0, before } = options
      
      const where: any = { conversationId }
      if (before) where.createdAt = { lt: before }
      
      return await prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
    } catch (error) {
      logger.error('Failed to find messages by conversation:', error)
      throw error
    }
  }
  
  /**
   * Update message content
   */
  static async update(id: string, data: {
    content?: string
    metadata?: MessageMetadata
  }) {
    try {
      const updateData: any = {}
      
      if (data.content !== undefined) updateData.content = data.content
      if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)
      
      return await prisma.message.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      logger.error('Failed to update message:', error)
      throw error
    }
  }
  
  /**
   * Delete message
   */
  static async delete(id: string) {
    try {
      await prisma.message.delete({
        where: { id },
      })
      
      logger.info(`Message deleted: ${id}`)
    } catch (error) {
      logger.error('Failed to delete message:', error)
      throw error
    }
  }
  
  /**
   * Get messages with token count for cost tracking
   */
  static async getTokenUsage(conversationId: string) {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        select: {
          id: true,
          role: true,
          content: true,
          metadata: true,
          createdAt: true,
        },
      })
      
      let totalTokens = 0
      let totalCost = 0
      
      messages.forEach(message => {
        const metadata = this.getMessageMetadata(message)
        if (metadata?.tokenCount) totalTokens += metadata.tokenCount
        if (metadata?.cost) totalCost += metadata.cost
      })
      
      return {
        messageCount: messages.length,
        totalTokens,
        totalCost,
        messages: messages.map(msg => ({
          ...msg,
          metadata: this.getMessageMetadata(msg),
        })),
      }
    } catch (error) {
      logger.error('Failed to get token usage:', error)
      throw error
    }
  }
  
  /**
   * Get message metadata with defaults
   */
  static getMessageMetadata(message: { metadata?: string | null }): MessageMetadata | null {
    if (!message.metadata) return null
    
    try {
      return JSON.parse(message.metadata)
    } catch {
      return null
    }
  }
}