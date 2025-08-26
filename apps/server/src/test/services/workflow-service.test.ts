import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { WorkflowService } from '../../services/workflow-service.js'
import { ProjectModel } from '../../models/project.js'
import { prisma } from '../../services/database.js'

// Mock dependencies
vi.mock('../../models/project.js')
vi.mock('../../services/database.js', () => ({
  prisma: {
    projectPhase: {
      update: vi.fn()
    },
    project: {
      update: vi.fn()
    }
  }
}))
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

describe('WorkflowService', () => {
  const mockProject = {
    id: 'project123',
    userId: 'user123',
    title: 'Test Project',
    content: 'Test content',
    status: 'IN_PROGRESS',
    currentPhaseId: 'phase-ideation',
    phases: [
      {
        id: 'phase-ideation',
        type: 'IDEATION',
        status: 'ACTIVE',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        completedAt: null,
        outputs: null
      },
      {
        id: 'phase-refinement',
        type: 'REFINEMENT',
        status: 'PENDING',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        completedAt: null,
        outputs: null
      },
      {
        id: 'phase-media',
        type: 'MEDIA',
        status: 'PENDING',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        completedAt: null,
        outputs: null
      },
      {
        id: 'phase-factcheck',
        type: 'FACTCHECK',
        status: 'PENDING',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        completedAt: null,
        outputs: null
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getWorkflowState', () => {
    it('should return workflow state for valid project', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue(mockProject)

      const result = await WorkflowService.getWorkflowState('project123', 'user123')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.projectId).toBe('project123')
      expect(result.data?.currentPhase.type).toBe('IDEATION')
      expect(result.data?.availableTransitions).toContain('REFINEMENT')
      expect(result.data?.completedPhases).toEqual([])
      expect(result.data?.pendingPhases).toEqual(['REFINEMENT', 'MEDIA', 'FACTCHECK'])
    })

    it('should return error for non-existent project', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue(null)

      const result = await WorkflowService.getWorkflowState('nonexistent', 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })

    it('should return error when current phase not found', async () => {
      const projectWithoutCurrentPhase = {
        ...mockProject,
        currentPhaseId: 'nonexistent-phase'
      }
      ;(ProjectModel.findById as Mock).mockResolvedValue(projectWithoutCurrentPhase)

      const result = await WorkflowService.getWorkflowState('project123', 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Current phase not found')
    })
  })

  describe('transitionToPhase', () => {
    beforeEach(() => {
      ;(ProjectModel.findById as Mock).mockResolvedValue(mockProject)
      ;(prisma.projectPhase.update as Mock).mockResolvedValue({})
      ;(prisma.project.update as Mock).mockResolvedValue({})
    })

    it('should transition to next phase successfully', async () => {
      const result = await WorkflowService.transitionToPhase({
        projectId: 'project123',
        userId: 'user123',
        fromPhase: 'IDEATION',
        toPhase: 'REFINEMENT'
      })

      expect(result.success).toBe(true)
      expect(result.data?.currentPhase.type).toBe('REFINEMENT')
    })

    it('should allow skipping phases when skipValidation is true', async () => {
      const result = await WorkflowService.transitionToPhase({
        projectId: 'project123',
        userId: 'user123',
        fromPhase: 'IDEATION',
        toPhase: 'FACTCHECK',
        skipValidation: true
      })

      expect(result.success).toBe(true)
    })

    it('should prevent invalid transitions when validation is enabled', async () => {
      const result = await WorkflowService.transitionToPhase({
        projectId: 'project123',
        userId: 'user123',
        fromPhase: 'IDEATION',
        toPhase: 'FACTCHECK',
        skipValidation: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot transition')
    })

    it('should return error for non-existent target phase', async () => {
      const result = await WorkflowService.transitionToPhase({
        projectId: 'project123',
        userId: 'user123',
        fromPhase: 'IDEATION',
        toPhase: 'NONEXISTENT',
        skipValidation: true
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Phase NONEXISTENT not found')
    })
  })

  describe('moveToNextPhase', () => {
    it('should move to next phase in sequence', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue(mockProject)
      ;(prisma.projectPhase.update as Mock).mockResolvedValue({})
      ;(prisma.project.update as Mock).mockResolvedValue({})

      const result = await WorkflowService.moveToNextPhase('project123', 'user123')

      expect(result.success).toBe(true)
      expect(result.data?.currentPhase.type).toBe('REFINEMENT')
    })

    it('should handle final phase completion', async () => {
      const finalPhaseProject = {
        ...mockProject,
        currentPhaseId: 'phase-factcheck',
        phases: mockProject.phases.map(p => 
          p.id === 'phase-factcheck' ? { ...p, status: 'ACTIVE' } : p
        )
      }
      ;(ProjectModel.findById as Mock).mockResolvedValue(finalPhaseProject)
      ;(ProjectModel.updateStatus as Mock).mockResolvedValue({})

      const result = await WorkflowService.moveToNextPhase('project123', 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Already at the final phase')
      expect(ProjectModel.updateStatus).toHaveBeenCalledWith('project123', 'COMPLETED')
    })
  })

  describe('moveToPreviousPhase', () => {
    it('should move to previous phase', async () => {
      const refinementPhaseProject = {
        ...mockProject,
        currentPhaseId: 'phase-refinement',
        phases: mockProject.phases.map(p => 
          p.id === 'phase-refinement' ? { ...p, status: 'ACTIVE' } : p
        )
      }
      ;(ProjectModel.findById as Mock).mockResolvedValue(refinementPhaseProject)
      ;(prisma.projectPhase.update as Mock).mockResolvedValue({})
      ;(prisma.project.update as Mock).mockResolvedValue({})

      const result = await WorkflowService.moveToPreviousPhase('project123', 'user123')

      expect(result.success).toBe(true)
      expect(result.data?.currentPhase.type).toBe('IDEATION')
    })

    it('should handle first phase case', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue(mockProject)

      const result = await WorkflowService.moveToPreviousPhase('project123', 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Already at the first phase')
    })
  })

  describe('completeCurrentPhase', () => {
    it('should complete current phase and move to next', async () => {
      ;(ProjectModel.findById as Mock).mockResolvedValue(mockProject)
      ;(prisma.projectPhase.update as Mock).mockResolvedValue({})
      ;(prisma.project.update as Mock).mockResolvedValue({})

      const result = await WorkflowService.completeCurrentPhase('project123', 'user123')

      expect(result.success).toBe(true)
      expect(prisma.projectPhase.update).toHaveBeenCalledWith({
        where: { id: 'phase-ideation' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date)
        }
      })
    })
  })

  describe('getPhaseProgress', () => {
    it('should return correct progress information', async () => {
      const projectWithCompletedPhases = {
        ...mockProject,
        currentPhaseId: 'phase-refinement',
        phases: [
          { ...mockProject.phases[0], status: 'COMPLETED' },
          { ...mockProject.phases[1], status: 'ACTIVE' },
          { ...mockProject.phases[2], status: 'PENDING' },
          { ...mockProject.phases[3], status: 'PENDING' }
        ]
      }
      ;(ProjectModel.findById as Mock).mockResolvedValue(projectWithCompletedPhases)

      const result = await WorkflowService.getPhaseProgress('project123', 'user123')

      expect(result.success).toBe(true)
      expect(result.data?.totalPhases).toBe(4)
      expect(result.data?.completedPhases).toBe(1)
      expect(result.data?.currentPhaseIndex).toBe(1)
      expect(result.data?.progressPercentage).toBe(25)
    })
  })

  describe('getAvailableTransitions', () => {
    it('should return correct available transitions for ideation phase', () => {
      const transitions = (WorkflowService as any).getAvailableTransitions('IDEATION', [])
      
      expect(transitions).toContain('REFINEMENT')
      expect(transitions).toContain('MEDIA')
      expect(transitions).toContain('FACTCHECK')
      expect(transitions).not.toContain('IDEATION')
    })

    it('should allow backward transitions', () => {
      const transitions = (WorkflowService as any).getAvailableTransitions('REFINEMENT', ['IDEATION'])
      
      expect(transitions).toContain('IDEATION')
      expect(transitions).toContain('MEDIA')
      expect(transitions).toContain('FACTCHECK')
    })
  })
})