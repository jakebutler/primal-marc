import { api } from './api'

export interface WorkflowPhase {
  id: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  outputs?: any
}

export interface WorkflowState {
  projectId: string
  currentPhase: WorkflowPhase
  allPhases: WorkflowPhase[]
  availableTransitions: string[]
  canSkipPhases: boolean
  completedPhases: string[]
  pendingPhases: string[]
}

export interface PhaseProgress {
  totalPhases: number
  completedPhases: number
  currentPhaseIndex: number
  progressPercentage: number
}

export interface WorkflowTransitionRequest {
  toPhase: string
  skipValidation?: boolean
}

export interface WorkflowResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export class WorkflowService {
  /**
   * Get current workflow state for a project
   */
  static async getWorkflowState(projectId: string): Promise<WorkflowResponse<WorkflowState>> {
    try {
      const response = await api.request(`/api/workflow/${projectId}/state`)
      return response as WorkflowResponse<WorkflowState>
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get workflow state'
      }
    }
  }

  /**
   * Transition to a specific phase
   */
  static async transitionToPhase(
    projectId: string, 
    request: WorkflowTransitionRequest
  ): Promise<WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>> {
    try {
      const response = await api.request(`/api/workflow/${projectId}/transition`, {
        method: 'POST',
        body: JSON.stringify(request)
      })
      return response as WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to transition phase'
      }
    }
  }

  /**
   * Move to the next phase in sequence
   */
  static async moveToNextPhase(projectId: string): Promise<WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>> {
    try {
      const response = await api.request(`/api/workflow/${projectId}/next`, {
        method: 'POST'
      })
      return response as WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to move to next phase'
      }
    }
  }

  /**
   * Move to the previous phase
   */
  static async moveToPreviousPhase(projectId: string): Promise<WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>> {
    try {
      const response = await api.request(`/api/workflow/${projectId}/previous`, {
        method: 'POST'
      })
      return response as WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to move to previous phase'
      }
    }
  }

  /**
   * Skip to a specific phase
   */
  static async skipToPhase(
    projectId: string, 
    targetPhase: string
  ): Promise<WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>> {
    try {
      const response = await api.request(`/api/workflow/${projectId}/skip`, {
        method: 'POST',
        body: JSON.stringify({ targetPhase })
      })
      return response as WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to skip to phase'
      }
    }
  }

  /**
   * Mark current phase as completed and move to next
   */
  static async completeCurrentPhase(projectId: string): Promise<WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>> {
    try {
      const response = await api.request(`/api/workflow/${projectId}/complete`, {
        method: 'POST'
      })
      return response as WorkflowResponse<{ currentPhase: WorkflowPhase; availableTransitions: string[] }>
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to complete current phase'
      }
    }
  }

  /**
   * Get phase progress information
   */
  static async getPhaseProgress(projectId: string): Promise<WorkflowResponse<PhaseProgress>> {
    try {
      const response = await api.request(`/api/workflow/${projectId}/progress`)
      return response as WorkflowResponse<PhaseProgress>
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get phase progress'
      }
    }
  }
}

// Phase type constants
export const PHASE_TYPES = {
  IDEATION: 'IDEATION',
  REFINEMENT: 'REFINEMENT', 
  MEDIA: 'MEDIA',
  FACTCHECK: 'FACTCHECK'
} as const

export const PHASE_NAMES = {
  [PHASE_TYPES.IDEATION]: 'Ideation',
  [PHASE_TYPES.REFINEMENT]: 'Draft Refinement',
  [PHASE_TYPES.MEDIA]: 'Media Creation',
  [PHASE_TYPES.FACTCHECK]: 'Fact-checking & SEO'
} as const

export const PHASE_DESCRIPTIONS = {
  [PHASE_TYPES.IDEATION]: 'Brainstorm and structure ideas',
  [PHASE_TYPES.REFINEMENT]: 'Improve structure and style',
  [PHASE_TYPES.MEDIA]: 'Add visuals and charts',
  [PHASE_TYPES.FACTCHECK]: 'Verify facts and optimize'
} as const

export type PhaseType = keyof typeof PHASE_TYPES