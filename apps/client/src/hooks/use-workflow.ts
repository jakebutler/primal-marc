import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WorkflowService, WorkflowState, PhaseProgress, WorkflowTransitionRequest } from '@/services/workflow'
import { useToast } from './use-toast'

/**
 * Hook to get workflow state for a project
 */
export function useWorkflowState(projectId: string) {
  return useQuery({
    queryKey: ['workflow', projectId, 'state'],
    queryFn: async () => {
      const result = await WorkflowService.getWorkflowState(projectId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to get workflow state')
      }
      return result.data!
    },
    enabled: !!projectId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false
  })
}

/**
 * Hook to get phase progress for a project
 */
export function usePhaseProgress(projectId: string) {
  return useQuery({
    queryKey: ['workflow', projectId, 'progress'],
    queryFn: async () => {
      const result = await WorkflowService.getPhaseProgress(projectId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to get phase progress')
      }
      return result.data!
    },
    enabled: !!projectId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false
  })
}

/**
 * Hook to transition to a specific phase
 */
export function useTransitionToPhase(projectId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (request: WorkflowTransitionRequest) => {
      const result = await WorkflowService.transitionToPhase(projectId, request)
      if (!result.success) {
        throw new Error(result.error || 'Failed to transition phase')
      }
      return result.data!
    },
    onSuccess: (data) => {
      // Invalidate and refetch workflow-related queries
      queryClient.invalidateQueries({ queryKey: ['workflow', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      
      toast({
        title: "Phase Changed",
        description: `Successfully moved to ${data.currentPhase.type.toLowerCase()} phase.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Phase Transition Failed",
        description: error.message,
        variant: "destructive",
      })
    }
  })
}

/**
 * Hook to move to the next phase
 */
export function useMoveToNextPhase(projectId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async () => {
      const result = await WorkflowService.moveToNextPhase(projectId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to move to next phase')
      }
      return result.data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      
      toast({
        title: "Moved to Next Phase",
        description: `Successfully moved to ${data.currentPhase.type.toLowerCase()} phase.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Move to Next Phase",
        description: error.message,
        variant: "destructive",
      })
    }
  })
}

/**
 * Hook to move to the previous phase
 */
export function useMoveToPreviousPhase(projectId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async () => {
      const result = await WorkflowService.moveToPreviousPhase(projectId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to move to previous phase')
      }
      return result.data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      
      toast({
        title: "Moved to Previous Phase",
        description: `Successfully moved back to ${data.currentPhase.type.toLowerCase()} phase.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Move to Previous Phase",
        description: error.message,
        variant: "destructive",
      })
    }
  })
}

/**
 * Hook to skip to a specific phase
 */
export function useSkipToPhase(projectId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (targetPhase: string) => {
      const result = await WorkflowService.skipToPhase(projectId, targetPhase)
      if (!result.success) {
        throw new Error(result.error || 'Failed to skip to phase')
      }
      return result.data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      
      toast({
        title: "Skipped to Phase",
        description: `Successfully skipped to ${data.currentPhase.type.toLowerCase()} phase.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Skip to Phase",
        description: error.message,
        variant: "destructive",
      })
    }
  })
}

/**
 * Hook to complete the current phase
 */
export function useCompleteCurrentPhase(projectId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async () => {
      const result = await WorkflowService.completeCurrentPhase(projectId)
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete current phase')
      }
      return result.data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      
      toast({
        title: "Phase Completed",
        description: `Successfully completed phase and moved to ${data.currentPhase.type.toLowerCase()}.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Complete Phase",
        description: error.message,
        variant: "destructive",
      })
    }
  })
}