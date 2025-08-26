import express from 'express'
import { z } from 'zod'
import { ProjectModel } from '../models/project.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'
import { ProjectMetadata } from '@primal-marc/shared'

const router = express.Router()

// Validation schemas
const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional().default(''),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
  }).optional(),
})

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
  }).optional(),
})

const projectQuerySchema = z.object({
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated tags
})

// GET /api/projects - Get user's projects with filtering and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const query = projectQuerySchema.parse(req.query)
    
    let projects
    
    if (query.search) {
      // Search projects by title or content
      projects = await ProjectModel.search(userId, query.search, query.limit)
    } else {
      // Get projects with filtering
      projects = await ProjectModel.findByUserId(userId, {
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      })
    }
    
    // Filter by tags if provided
    if (query.tags) {
      const searchTags = query.tags.split(',').map(tag => tag.trim().toLowerCase())
      projects = projects.filter(project => {
        if (!project.metadata) return false
        try {
          const metadata = JSON.parse(project.metadata) as ProjectMetadata
          return metadata.tags?.some(tag => 
            searchTags.includes(tag.toLowerCase())
          )
        } catch {
          return false
        }
      })
    }
    
    // Transform projects for response
    const transformedProjects = projects.map(project => ({
      id: project.id,
      title: project.title,
      content: project.content,
      status: project.status,
      metadata: ProjectModel.getProjectMetadata(project),
      currentPhaseId: project.currentPhaseId,
      phases: project.phases || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }))
    
    res.json({
      success: true,
      data: {
        projects: transformedProjects,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: transformedProjects.length,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get projects:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve projects',
    })
  }
})

// GET /api/projects/:id - Get specific project
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    
    const project = await ProjectModel.findById(projectId, userId)
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    res.json({
      success: true,
      data: {
        ...project,
        metadata: ProjectModel.getProjectMetadata(project),
      },
    })
  } catch (error) {
    logger.error('Failed to get project:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve project',
    })
  }
})

// POST /api/projects - Create new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const data = createProjectSchema.parse(req.body)
    
    const project = await ProjectModel.create({
      userId,
      title: data.title,
      content: data.content,
      metadata: data.metadata,
    })
    
    res.status(201).json({
      success: true,
      data: {
        ...project,
        metadata: ProjectModel.getProjectMetadata(project),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }
    
    logger.error('Failed to create project:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
    })
  }
})

// PUT /api/projects/:id - Update project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    const data = updateProjectSchema.parse(req.body)
    
    // Verify project ownership
    const existingProject = await ProjectModel.findById(projectId, userId)
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    const updatedProject = await ProjectModel.updateContent(projectId, data)
    
    res.json({
      success: true,
      data: {
        ...updatedProject,
        metadata: ProjectModel.getProjectMetadata(updatedProject),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }
    
    logger.error('Failed to update project:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update project',
    })
  }
})

// PATCH /api/projects/:id/status - Update project status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    const { status } = z.object({
      status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']),
    }).parse(req.body)
    
    // Verify project ownership
    const existingProject = await ProjectModel.findById(projectId, userId)
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    const updatedProject = await ProjectModel.updateStatus(projectId, status)
    
    res.json({
      success: true,
      data: {
        ...updatedProject,
        metadata: ProjectModel.getProjectMetadata(updatedProject),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }
    
    logger.error('Failed to update project status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update project status',
    })
  }
})

// PATCH /api/projects/:id/phase - Move to next phase
router.patch('/:id/phase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    
    // Verify project ownership
    const existingProject = await ProjectModel.findById(projectId, userId)
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    const nextPhase = await ProjectModel.moveToNextPhase(projectId)
    
    res.json({
      success: true,
      data: {
        nextPhase,
        message: nextPhase ? `Moved to ${nextPhase.type} phase` : 'All phases completed',
      },
    })
  } catch (error) {
    logger.error('Failed to move to next phase:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to move to next phase',
    })
  }
})

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    
    // Verify project ownership
    const existingProject = await ProjectModel.findById(projectId, userId)
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    await ProjectModel.delete(projectId, userId)
    
    res.json({
      success: true,
      message: 'Project deleted successfully',
    })
  } catch (error) {
    logger.error('Failed to delete project:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
    })
  }
})

export default router