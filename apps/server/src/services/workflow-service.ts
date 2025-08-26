import { prisma } from './database.js'
import { ProjectModel } from '../models/project.js'
import { logger } from '../utils/logger.js'

export interface PhaseTransitionRequest {
  projectId: string
  userId: string
  fromPhase: string
  toPhase: string
  skipValidation?: boolean
}

export interface PhaseTransitionResult {
  success: boolean
  data?: {
    currentPhase: ProjectPhase
    availableTransitions: string[]
  }
  error?: string
}

export interface ProjectPhase {
  id: string
  type: string
  status: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date | null
  outputs?: any
}

export interface WorkflowState {
  projectId: string
  currentPhase: ProjectPhase
  allPhases: ProjectPhase[]
  availableTransitions: string[]
  canSkipPhases: boolean
  completedPhases: string[]
  pendingPhases: string[]
}

/**
 * Workflow Service - Manages phase transitions and workflow state
 */
export class WorkflowService {
  private static readonly PHASE_ORDER = ['IDEATION', 'REFINEMENT', 'MEDIA', 'FACTCHECK']
  
  /**
   * Get current workflow state for a project
   */
  static async getWorkflowState(projectId: string, userId?: string): Promise<{
    success: boolean
    data?: WorkflowState
    error?: string
  }> {
    try {
      const project = await ProjectModel.findById(projectId, userId)
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      const currentPhase = project.phases.find(p => p.id === project.currentPhaseId)
      if (!currentPhase) {
        return {
          success: false,
          error: 'Current phase not found'
        }
      }

      const completedPhases = project.phases
        .filter(p => p.status === 'COMPLETED')
        .map(p => p.type)

      const pendingPhases = project.phases
        .filter(p => p.status === 'PENDING')
        .map(p => p.type)

      const availableTransitions = this.getAvailableTransitions(
        currentPhase.type,
        completedPhases
      )

      return {
        success: true,
        data: {
          projectId,
          currentPhase,
          allPhases: project.phases,
          availableTransitions,
          canSkipPhases: true, // Allow flexible workflow
          completedPhases,
          pendingPhases
        }
      }
    } catch (error) {
      logger.error('Failed to get workflow state:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Transition to a specific phase
   */
  static async transitionToPhase(request: PhaseTransitionRequest): Promise<PhaseTransitionResult> {
    try {
      const project = await ProjectModel.findById(request.projectId, request.userId)
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      const targetPhase = project.phases.find(p => p.type === request.toPhase)
      if (!targetPhase) {
        return {
          success: false,
          error: `Phase ${request.toPhase} not found`
        }
      }

      // Validate transition if not skipping validation
      if (!request.skipValidation) {
        const currentPhase = project.phases.find(p => p.id === project.currentPhaseId)
        if (!currentPhase) {
          return {
            success: false,
            error: 'Current phase not found'
          }
        }

        const completedPhases = project.phases
          .filter(p => p.status === 'COMPLETED')
          .map(p => p.type)

        const availableTransitions = this.getAvailableTransitions(
          currentPhase.type,
          completedPhases
        )

        if (!availableTransitions.includes(request.toPhase)) {
          return {
            success: false,
            error: `Cannot transition from ${request.fromPhase} to ${request.toPhase}`
          }
        }
      }

      // Perform the transition
      await this.performPhaseTransition(project, request.fromPhase, request.toPhase)

      // Get updated workflow state
      const updatedState = await this.getWorkflowState(request.projectId, request.userId)
      if (!updatedState.success || !updatedState.data) {
        return {
          success: false,
          error: 'Failed to get updated workflow state'
        }
      }

      logger.info(`Phase transition completed: ${request.fromPhase} -> ${request.toPhase}`, {
        projectId: request.projectId,
        userId: request.userId
      })

      return {
        success: true,
        data: {
          currentPhase: updatedState.data.currentPhase,
          availableTransitions: updatedState.data.availableTransitions
        }
      }
    } catch (error) {
      logger.error('Failed to transition phase:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Move to the next phase in sequence
   */
  static async moveToNextPhase(projectId: string, userId?: string): Promise<PhaseTransitionResult> {
    try {
      const workflowState = await this.getWorkflowState(projectId, userId)
      if (!workflowState.success || !workflowState.data) {
        return {
          success: false,
          error: workflowState.error || 'Failed to get workflow state'
        }
      }

      const currentPhaseType = workflowState.data.currentPhase.type
      const currentIndex = this.PHASE_ORDER.indexOf(currentPhaseType)
      
      if (currentIndex === -1) {
        return {
          success: false,
          error: 'Invalid current phase'
        }
      }

      if (currentIndex >= this.PHASE_ORDER.length - 1) {
        // Already at the last phase, mark project as completed
        await ProjectModel.updateStatus(projectId, 'COMPLETED')
        return {
          success: false,
          error: 'Already at the final phase'
        }
      }

      const nextPhaseType = this.PHASE_ORDER[currentIndex + 1]
      
      return await this.transitionToPhase({
        projectId,
        userId: userId!,
        fromPhase: currentPhaseType,
        toPhase: nextPhaseType,
        skipValidation: false
      })
    } catch (error) {
      logger.error('Failed to move to next phase:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Move to the previous phase
   */
  static async moveToPreviousPhase(projectId: string, userId?: string): Promise<PhaseTransitionResult> {
    try {
      const workflowState = await this.getWorkflowState(projectId, userId)
      if (!workflowState.success || !workflowState.data) {
        return {
          success: false,
          error: workflowState.error || 'Failed to get workflow state'
        }
      }

      const currentPhaseType = workflowState.data.currentPhase.type
      const currentIndex = this.PHASE_ORDER.indexOf(currentPhaseType)
      
      if (currentIndex <= 0) {
        return {
          success: false,
          error: 'Already at the first phase'
        }
      }

      const previousPhaseType = this.PHASE_ORDER[currentIndex - 1]
      
      return await this.transitionToPhase({
        projectId,
        userId: userId!,
        fromPhase: currentPhaseType,
        toPhase: previousPhaseType,
        skipValidation: true // Allow backward navigation
      })
    } catch (error) {
      logger.error('Failed to move to previous phase:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Skip to a specific phase
   */
  static async skipToPhase(projectId: string, targetPhase: string, userId?: string): Promise<PhaseTransitionResult> {
    try {
      const workflowState = await this.getWorkflowState(projectId, userId)
      if (!workflowState.success || !workflowState.data) {
        return {
          success: false,
          error: workflowState.error || 'Failed to get workflow state'
        }
      }

      const currentPhaseType = workflowState.data.currentPhase.type
      
      return await this.transitionToPhase({
        projectId,
        userId: userId!,
        fromPhase: currentPhaseType,
        toPhase: targetPhase,
        skipValidation: true // Allow phase skipping
      })
    } catch (error) {
      logger.error('Failed to skip to phase:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Mark current phase as completed
   */
  static async completeCurrentPhase(projectId: string, userId?: string): Promise<PhaseTransitionResult> {
    try {
      const workflowState = await this.getWorkflowState(projectId, userId)
      if (!workflowState.success || !workflowState.data) {
        return {
          success: false,
          error: workflowState.error || 'Failed to get workflow state'
        }
      }

      const currentPhase = workflowState.data.currentPhase

      // Mark current phase as completed
      await prisma.projectPhase.update({
        where: { id: currentPhase.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      // Move to next phase automatically
      return await this.moveToNextPhase(projectId, userId)
    } catch (error) {
      logger.error('Failed to complete current phase:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get available transitions from current phase
   */
  private static getAvailableTransitions(currentPhase: string, completedPhases: string[]): string[] {
    const currentIndex = this.PHASE_ORDER.indexOf(currentPhase)
    if (currentIndex === -1) return []

    const transitions: string[] = []

    // Can always go back to previous phases
    for (let i = 0; i < currentIndex; i++) {
      transitions.push(this.PHASE_ORDER[i])
    }

    // Can go to next phase
    if (currentIndex < this.PHASE_ORDER.length - 1) {
      transitions.push(this.PHASE_ORDER[currentIndex + 1])
    }

    // Can skip to any future phase (flexible workflow)
    for (let i = currentIndex + 2; i < this.PHASE_ORDER.length; i++) {
      transitions.push(this.PHASE_ORDER[i])
    }

    return transitions
  }

  /**
   * Perform the actual phase transition
   */
  private static async performPhaseTransition(
    project: any,
    fromPhase: string,
    toPhase: string
  ): Promise<void> {
    // Find the target phase
    const targetPhase = project.phases.find((p: any) => p.type === toPhase)
    if (!targetPhase) {
      throw new Error(`Target phase ${toPhase} not found`)
    }

    // Update current phase status if moving forward
    const fromPhaseObj = project.phases.find((p: any) => p.type === fromPhase)
    if (fromPhaseObj && fromPhase !== toPhase) {
      const fromIndex = this.PHASE_ORDER.indexOf(fromPhase)
      const toIndex = this.PHASE_ORDER.indexOf(toPhase)
      
      if (toIndex > fromIndex) {
        // Moving forward - mark current phase as completed
        await prisma.projectPhase.update({
          where: { id: fromPhaseObj.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        })
      } else {
        // Moving backward - mark current phase as pending
        await prisma.projectPhase.update({
          where: { id: fromPhaseObj.id },
          data: {
            status: 'PENDING',
            completedAt: null
          }
        })
      }
    }

    // Activate target phase
    await prisma.projectPhase.update({
      where: { id: targetPhase.id },
      data: { status: 'ACTIVE' }
    })

    // Update project's current phase
    await prisma.project.update({
      where: { id: project.id },
      data: {
        currentPhaseId: targetPhase.id,
        status: 'IN_PROGRESS'
      }
    })
  }

  /**
   * Get phase progress information
   */
  static async getPhaseProgress(projectId: string, userId?: string): Promise<{
    success: boolean
    data?: {
      totalPhases: number
      completedPhases: number
      currentPhaseIndex: number
      progressPercentage: number
    }
    error?: string
  }> {
    try {
      const workflowState = await this.getWorkflowState(projectId, userId)
      if (!workflowState.success || !workflowState.data) {
        return {
          success: false,
          error: workflowState.error || 'Failed to get workflow state'
        }
      }

      const totalPhases = this.PHASE_ORDER.length
      const completedPhases = workflowState.data.completedPhases.length
      const currentPhaseIndex = this.PHASE_ORDER.indexOf(workflowState.data.currentPhase.type)
      const progressPercentage = Math.round((completedPhases / totalPhases) * 100)

      return {
        success: true,
        data: {
          totalPhases,
          completedPhases,
          currentPhaseIndex,
          progressPercentage
        }
      }
    } catch (error) {
      logger.error('Failed to get phase progress:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

