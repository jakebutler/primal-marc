import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import request from 'supertest'
import express from 'express'
import workflowRoutes from '../../routes/workflow.js'
import { WorkflowService } from '../../services/workflow-service.js'
import { authenticateToken } from '../../middleware/auth.js'

// Mock dependencies
vi.mock('../../services/workflow-service.js')
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn()
}))
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

describe('Workflow Routes', () => {
  let app: express.Application

  const mockUser = {
    id: 'user123',
    email: 'test@example.com'
  }

  const mockWorkflowState = {
    projectId: 'project123',
    currentPhase: {
      id: 'phase-ideation',
      type: 'IDEATION',
      status: 'ACTIVE',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      completedAt: null,
      outputs: null
    },
    allPhases: [],
    availableTransitions: ['REFINEMENT', 'MEDIA', 'FACTCHECK'],
    canSkipPhases: true,
    completedPhases: [],
    pendingPhases: ['REFINEMENT', 'MEDIA', 'FACTCHECK']
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    app = express()
    app.use(express.json())
    
    // Mock auth middleware to add user to request
    ;(authenticateToken as Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = mockUser
      next()
    })
    
    app.use('/api/workflow', workflowRoutes)
  })

  describe('GET /:projectId/state', () => {
    it('should return workflow state for valid project', async () => {
      ;(WorkflowService.getWorkflowState as Mock).mockResolvedValue({
        success: true,
        data: mockWorkflowState
      })

      const response = await request(app)
        .get('/api/workflow/project123/state')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.projectId).toBe('project123')
      expect(WorkflowService.getWorkflowState).toHaveBeenCalledWith('project123', 'user123')
    })

    it('should return 404 for non-existent project', async () => {
      ;(WorkflowService.getWorkflowState as Mock).mockResolvedValue({
        success: false,
        error: 'Project not found'
      })

      const response = await request(app)
        .get('/api/workflow/nonexistent/state')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Project not found')
    })

    it('should return 401 when user not authenticated', async () => {
      ;(authenticateToken as Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = null
        next()
      })

      await request(app)
        .get('/api/workflow/project123/state')
        .expect(401)
    })
  })

  describe('POST /:projectId/transition', () => {
    it('should transition to specified phase', async () => {
      ;(WorkflowService.getWorkflowState as Mock).mockResolvedValue({
        success: true,
        data: mockWorkflowState
      })
      ;(WorkflowService.transitionToPhase as Mock).mockResolvedValue({
        success: true,
        data: {
          currentPhase: { type: 'REFINEMENT' },
          availableTransitions: ['IDEATION', 'MEDIA', 'FACTCHECK']
        }
      })

      const response = await request(app)
        .post('/api/workflow/project123/transition')
        .send({ toPhase: 'REFINEMENT' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(WorkflowService.transitionToPhase).toHaveBeenCalledWith({
        projectId: 'project123',
        userId: 'user123',
        fromPhase: 'IDEATION',
        toPhase: 'REFINEMENT',
        skipValidation: false
      })
    })

    it('should allow skipping validation', async () => {
      ;(WorkflowService.getWorkflowState as Mock).mockResolvedValue({
        success: true,
        data: mockWorkflowState
      })
      ;(WorkflowService.transitionToPhase as Mock).mockResolvedValue({
        success: true,
        data: {
          currentPhase: { type: 'FACTCHECK' },
          availableTransitions: []
        }
      })

      await request(app)
        .post('/api/workflow/project123/transition')
        .send({ toPhase: 'FACTCHECK', skipValidation: true })
        .expect(200)

      expect(WorkflowService.transitionToPhase).toHaveBeenCalledWith({
        projectId: 'project123',
        userId: 'user123',
        fromPhase: 'IDEATION',
        toPhase: 'FACTCHECK',
        skipValidation: true
      })
    })

    it('should return 400 when toPhase is missing', async () => {
      const response = await request(app)
        .post('/api/workflow/project123/transition')
        .send({})
        .expect(400)

      expect(response.body.error).toBe('toPhase is required')
    })

    it('should return 400 for invalid transition', async () => {
      ;(WorkflowService.getWorkflowState as Mock).mockResolvedValue({
        success: true,
        data: mockWorkflowState
      })
      ;(WorkflowService.transitionToPhase as Mock).mockResolvedValue({
        success: false,
        error: 'Cannot transition from IDEATION to FACTCHECK'
      })

      const response = await request(app)
        .post('/api/workflow/project123/transition')
        .send({ toPhase: 'FACTCHECK' })
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /:projectId/next', () => {
    it('should move to next phase', async () => {
      ;(WorkflowService.moveToNextPhase as Mock).mockResolvedValue({
        success: true,
        data: {
          currentPhase: { type: 'REFINEMENT' },
          availableTransitions: ['IDEATION', 'MEDIA', 'FACTCHECK']
        }
      })

      const response = await request(app)
        .post('/api/workflow/project123/next')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(WorkflowService.moveToNextPhase).toHaveBeenCalledWith('project123', 'user123')
    })

    it('should handle final phase case', async () => {
      ;(WorkflowService.moveToNextPhase as Mock).mockResolvedValue({
        success: false,
        error: 'Already at the final phase'
      })

      const response = await request(app)
        .post('/api/workflow/project123/next')
        .expect(400)

      expect(response.body.error).toBe('Already at the final phase')
    })
  })

  describe('POST /:projectId/previous', () => {
    it('should move to previous phase', async () => {
      ;(WorkflowService.moveToPreviousPhase as Mock).mockResolvedValue({
        success: true,
        data: {
          currentPhase: { type: 'IDEATION' },
          availableTransitions: ['REFINEMENT', 'MEDIA', 'FACTCHECK']
        }
      })

      const response = await request(app)
        .post('/api/workflow/project123/previous')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(WorkflowService.moveToPreviousPhase).toHaveBeenCalledWith('project123', 'user123')
    })
  })

  describe('POST /:projectId/skip', () => {
    it('should skip to specified phase', async () => {
      ;(WorkflowService.skipToPhase as Mock).mockResolvedValue({
        success: true,
        data: {
          currentPhase: { type: 'MEDIA' },
          availableTransitions: ['IDEATION', 'REFINEMENT', 'FACTCHECK']
        }
      })

      const response = await request(app)
        .post('/api/workflow/project123/skip')
        .send({ targetPhase: 'MEDIA' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(WorkflowService.skipToPhase).toHaveBeenCalledWith('project123', 'MEDIA', 'user123')
    })

    it('should return 400 when targetPhase is missing', async () => {
      const response = await request(app)
        .post('/api/workflow/project123/skip')
        .send({})
        .expect(400)

      expect(response.body.error).toBe('targetPhase is required')
    })
  })

  describe('POST /:projectId/complete', () => {
    it('should complete current phase', async () => {
      ;(WorkflowService.completeCurrentPhase as Mock).mockResolvedValue({
        success: true,
        data: {
          currentPhase: { type: 'REFINEMENT' },
          availableTransitions: ['IDEATION', 'MEDIA', 'FACTCHECK']
        }
      })

      const response = await request(app)
        .post('/api/workflow/project123/complete')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(WorkflowService.completeCurrentPhase).toHaveBeenCalledWith('project123', 'user123')
    })
  })

  describe('GET /:projectId/progress', () => {
    it('should return phase progress', async () => {
      const mockProgress = {
        totalPhases: 4,
        completedPhases: 1,
        currentPhaseIndex: 1,
        progressPercentage: 25
      }

      ;(WorkflowService.getPhaseProgress as Mock).mockResolvedValue({
        success: true,
        data: mockProgress
      })

      const response = await request(app)
        .get('/api/workflow/project123/progress')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.progressPercentage).toBe(25)
      expect(WorkflowService.getPhaseProgress).toHaveBeenCalledWith('project123', 'user123')
    })
  })

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      ;(WorkflowService.getWorkflowState as Mock).mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/workflow/project123/state')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Internal server error')
    })
  })
})