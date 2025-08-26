import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, Project } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

// Query keys
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  versions: (id: string) => [...projectKeys.detail(id), 'versions'] as const,
}

// Get projects list
export function useProjects(params?: {
  status?: string
  limit?: number
  offset?: number
  search?: string
  tags?: string
}) {
  return useQuery({
    queryKey: projectKeys.list(params || {}),
    queryFn: () => apiClient.getProjects(params),
    select: (data) => data.data,
  })
}

// Get single project
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => apiClient.getProject(id),
    select: (data) => data.data,
    enabled: !!id,
  })
}

// Create project mutation
export function useCreateProject() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (data: {
      title: string
      content?: string
      metadata?: {
        tags?: string[]
        targetAudience?: string
      }
    }) => apiClient.createProject(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      toast({
        title: "Project created",
        description: "Your new project has been created successfully.",
      })
      return response.data
    },
    onError: (error) => {
      toast({
        title: "Failed to create project",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    },
  })
}

// Update project mutation
export function useUpdateProject(id: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (data: {
      title?: string
      content?: string
      metadata?: {
        tags?: string[]
        targetAudience?: string
      }
    }) => apiClient.updateProject(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      return response.data
    },
    onError: (error) => {
      toast({
        title: "Failed to update project",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    },
  })
}

// Delete project mutation
export function useDeleteProject() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      toast({
        title: "Project deleted",
        description: "Your project has been deleted successfully.",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to delete project",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    },
  })
}

// Auto-save mutations
export function useAutoSave(id: string) {
  return useMutation({
    mutationFn: (data: {
      content: string
      title: string
      metadata?: string
    }) => apiClient.scheduleAutoSave(id, data),
  })
}

export function useForceSave(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiClient.forceSave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
    },
  })
}

// Version management
export function useProjectVersions(id: string, limit?: number) {
  return useQuery({
    queryKey: projectKeys.versions(id),
    queryFn: () => apiClient.getVersions(id, limit),
    select: (data) => data.data,
    enabled: !!id,
  })
}

export function useRestoreVersion(id: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (version: number) => apiClient.restoreVersion(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
      toast({
        title: "Version restored",
        description: "Your project has been restored to the selected version.",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to restore version",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    },
  })
}