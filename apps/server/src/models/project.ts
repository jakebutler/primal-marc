import { prisma } from '../services/database.js'
import { ProjectMetadata, PhaseOutput } from '@primal-marc/shared'
import { logger } from '../utils/logger.js'

export class ProjectModel {
  /**
   * Create a new project
   */
  static async create(data: {
    userId: string
    title: string
    content?: string
    metadata?: Partial<ProjectMetadata>
  }) {
    try {
      const defaultMetadata: ProjectMetadata = {
        wordCount: 0,
        estimatedReadTime: 0,
        tags: [],
        targetAudience: '',
        ...data.metadata,
      }
      
      const project = await prisma.project.create({
        data: {
          userId: data.userId,
          title: data.title,
          content: data.content || '',
          metadata: JSON.stringify(defaultMetadata),
          status: 'DRAFT',
        },
        include: {
          phases: true,
          conversations: true,
        },
      })
      
      // Create initial phases
      await this.initializePhases(project.id)
      
      logger.info(`Project created: ${project.id} for user ${data.userId}`)
      return project
    } catch (error) {
      logger.error('Failed to create project:', error)
      throw error
    }
  }
  
  /**
   * Initialize project phases
   */
  static async initializePhases(projectId: string) {
    try {
      const phases = [
        { type: 'IDEATION' as const, status: 'ACTIVE' as const },
        { type: 'REFINEMENT' as const, status: 'PENDING' as const },
        { type: 'MEDIA' as const, status: 'PENDING' as const },
        { type: 'FACTCHECK' as const, status: 'PENDING' as const },
      ]
      
      await prisma.projectPhase.createMany({
        data: phases.map(phase => ({
          projectId,
          type: phase.type,
          status: phase.status,
        })),
      })
      
      // Set current phase to ideation
      const ideationPhase = await prisma.projectPhase.findFirst({
        where: { projectId, type: 'IDEATION' },
      })
      
      if (ideationPhase) {
        await prisma.project.update({
          where: { id: projectId },
          data: { currentPhaseId: ideationPhase.id },
        })
      }
    } catch (error) {
      logger.error('Failed to initialize project phases:', error)
      throw error
    }
  }
  
  /**
   * Find project by ID with full relations
   */
  static async findById(id: string, userId?: string) {
    try {
      const where: any = { id }
      if (userId) where.userId = userId
      
      return await prisma.project.findUnique({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          phases: {
            orderBy: { createdAt: 'asc' },
          },
          conversations: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 50, // Limit messages for performance
              },
            },
          },
        },
      })
    } catch (error) {
      logger.error('Failed to find project:', error)
      throw error
    }
  }
  
  /**
   * Find projects by user ID
   */
  static async findByUserId(userId: string, options: {
    status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED'
    limit?: number
    offset?: number
  } = {}) {
    try {
      const { status, limit = 20, offset = 0 } = options
      
      const where: any = { userId }
      if (status) where.status = status
      
      return await prisma.project.findMany({
        where,
        include: {
          phases: {
            select: {
              type: true,
              status: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      })
    } catch (error) {
      logger.error('Failed to find projects by user:', error)
      throw error
    }
  }
  
  /**
   * Update project content and metadata
   */
  static async updateContent(id: string, data: {
    title?: string
    content?: string
    metadata?: Partial<ProjectMetadata>
  }) {
    try {
      const project = await prisma.project.findUnique({ where: { id } })
      if (!project) throw new Error('Project not found')
      
      const updateData: any = {}
      
      if (data.title !== undefined) updateData.title = data.title
      if (data.content !== undefined) {
        updateData.content = data.content
        
        // Update word count and reading time
        const wordCount = data.content.split(/\s+/).filter(word => word.length > 0).length
        const estimatedReadTime = Math.ceil(wordCount / 200) // 200 words per minute
        
        const currentMetadata = project.metadata ? JSON.parse(project.metadata) : {}
        const updatedMetadata = {
          ...currentMetadata,
          ...data.metadata,
          wordCount,
          estimatedReadTime,
        }
        
        updateData.metadata = JSON.stringify(updatedMetadata)
      } else if (data.metadata) {
        const currentMetadata = project.metadata ? JSON.parse(project.metadata) : {}
        updateData.metadata = JSON.stringify({ ...currentMetadata, ...data.metadata })
      }
      
      return await prisma.project.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      logger.error('Failed to update project content:', error)
      throw error
    }
  }
  
  /**
   * Update project status
   */
  static async updateStatus(id: string, status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED') {
    try {
      return await prisma.project.update({
        where: { id },
        data: { status },
      })
    } catch (error) {
      logger.error('Failed to update project status:', error)
      throw error
    }
  }
  
  /**
   * Move to next phase
   */
  static async moveToNextPhase(projectId: string) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { phases: true },
      })
      
      if (!project) throw new Error('Project not found')
      
      const phaseOrder = ['IDEATION', 'REFINEMENT', 'MEDIA', 'FACTCHECK']
      const currentPhase = project.phases.find(p => p.id === project.currentPhaseId)
      
      if (!currentPhase) throw new Error('Current phase not found')
      
      const currentIndex = phaseOrder.indexOf(currentPhase.type)
      const nextIndex = currentIndex + 1
      
      if (nextIndex >= phaseOrder.length) {
        // All phases completed
        await prisma.project.update({
          where: { id: projectId },
          data: { status: 'COMPLETED' },
        })
        return null
      }
      
      // Mark current phase as completed
      await prisma.projectPhase.update({
        where: { id: currentPhase.id },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
      
      // Activate next phase
      const nextPhase = project.phases.find(p => p.type === phaseOrder[nextIndex])
      if (nextPhase) {
        await prisma.projectPhase.update({
          where: { id: nextPhase.id },
          data: { status: 'ACTIVE' },
        })
        
        await prisma.project.update({
          where: { id: projectId },
          data: { 
            currentPhaseId: nextPhase.id,
            status: 'IN_PROGRESS',
          },
        })
        
        return nextPhase
      }
      
      return null
    } catch (error) {
      logger.error('Failed to move to next phase:', error)
      throw error
    }
  }
  
  /**
   * Get project metadata with defaults
   */
  static getProjectMetadata(project: { metadata?: string | null }): ProjectMetadata {
    const defaultMetadata: ProjectMetadata = {
      wordCount: 0,
      estimatedReadTime: 0,
      tags: [],
      targetAudience: '',
    }
    
    if (!project.metadata) return defaultMetadata
    
    try {
      const parsed = JSON.parse(project.metadata)
      return { ...defaultMetadata, ...parsed }
    } catch {
      return defaultMetadata
    }
  }
  
  /**
   * Delete project and all associated data
   */
  static async delete(id: string, userId?: string) {
    try {
      const where: any = { id }
      if (userId) where.userId = userId
      
      await prisma.project.delete({ where })
      
      logger.info(`Project deleted: ${id}`)
    } catch (error) {
      logger.error('Failed to delete project:', error)
      throw error
    }
  }
  
  /**
   * Search projects by title or content
   */
  static async search(userId: string, query: string, limit = 10) {
    try {
      return await prisma.project.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: query } },
            { content: { contains: query } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      })
    } catch (error) {
      logger.error('Failed to search projects:', error)
      throw error
    }
  }
}