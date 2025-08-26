import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Clock, AlertCircle, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { Sidebar } from '@/components/layout/Sidebar'
import { useProject, useUpdateProject, useAutoSave } from '@/hooks/use-projects'
import { useToast } from '@/hooks/use-toast'

export const ProjectEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPhase, setCurrentPhase] = useState<string>('')

  // Queries and mutations
  const { data: project, isLoading, error } = useProject(id!)
  const updateProjectMutation = useUpdateProject(id!)
  const autoSaveMutation = useAutoSave(id!)

  // Handle save
  const handleSave = useCallback(async (content: string, title: string) => {
    if (!id) return

    try {
      // Use auto-save API for debounced saves
      await autoSaveMutation.mutateAsync({
        content,
        title,
        metadata: JSON.stringify(project?.metadata || {}),
      })
    } catch (error) {
      console.error('Auto-save failed:', error)
      throw error
    }
  }, [id, autoSaveMutation, project?.metadata])

  // Handle manual save
  const handleManualSave = useCallback(async () => {
    if (!project) return

    try {
      await updateProjectMutation.mutateAsync({
        title: project.title,
        content: project.content,
        metadata: project.metadata,
      })

      toast({
        title: "Saved",
        description: "Your project has been saved successfully.",
      })
    } catch (error) {
      // Error handling is done in the mutation
    }
  }, [project, updateProjectMutation, toast])

  // Handle content changes
  const handleContentChange = useCallback((content: string) => {
    // Update local state through React Query cache
    // This is handled by the MarkdownEditor component
  }, [])

  // Handle title changes
  const handleTitleChange = useCallback((title: string) => {
    // Update local state through React Query cache
    // This is handled by the MarkdownEditor component
  }, [])

  // Handle phase changes
  const handlePhaseChange = useCallback((phase: string) => {
    setCurrentPhase(phase)
    // You could add additional logic here, like switching to a phase-specific view
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
      // Toggle sidebar with Ctrl/Cmd + B
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading your project...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-center h-64">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center space-x-2">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <span>Project Not Found</span>
                </CardTitle>
                <CardDescription>
                  The project you're looking for doesn't exist or you don't have access to it.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Sidebar 
            projectId={id}
            onPhaseChange={handlePhaseChange}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-lg font-semibold truncate max-w-md">
                    {project.title || 'Untitled Project'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(project.updatedAt).toLocaleString()}
                    {currentPhase && ` • Current phase: ${currentPhase}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSave}
                  disabled={updateProjectMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateProjectMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-4">
          <MarkdownEditor
            content={project.content}
            title={project.title}
            onChange={handleContentChange}
            onTitleChange={handleTitleChange}
            onSave={handleSave}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}

export default ProjectEditorPage