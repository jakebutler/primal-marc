import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageCircle, FileText, Sparkles, Plus, Smartphone, Monitor } from 'lucide-react'
import { useCreateProject, useProjects } from '@/hooks/use-projects'
import { cn } from '@/lib/utils'

export const MainCanvas: React.FC = () => {
  const navigate = useNavigate()
  const createProjectMutation = useCreateProject()
  const { data: projectsData } = useProjects({ limit: 5 })
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleCreateProject = async () => {
    try {
      const result = await createProjectMutation.mutateAsync({
        title: 'Untitled Project',
        content: '# Welcome to your new project\n\nStart writing your amazing content here...',
      })
      
      if (result) {
        navigate(`/projects/${result.data?.id}`)
      }
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const recentProjects = projectsData?.projects || []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Canvas Header */}
      <div className={cn(
        "border-b bg-background/95 backdrop-blur",
        isMobile ? "p-4" : "p-6"
      )}>
        <div className={cn(
          "flex items-center justify-between",
          isMobile && "flex-col space-y-3"
        )}>
          <div className={isMobile ? "text-center" : ""}>
            <h1 className={cn(
              "font-bold",
              isMobile ? "text-xl" : "text-2xl"
            )}>
              Writing Canvas
            </h1>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-sm" : ""
            )}>
              Collaborate with AI agents to create amazing content
            </p>
          </div>
          <Button 
            className={isMobile ? "w-full" : ""}
            onClick={handleCreateProject}
            disabled={createProjectMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {createProjectMutation.isPending ? 'Creating...' : 'Start Writing'}
          </Button>
        </div>
      </div>

      {/* Canvas Content */}
      <div className={cn(
        "flex-1 overflow-auto",
        isMobile ? "p-4" : "p-6"
      )}>
        <div className={cn(
          "mx-auto",
          isMobile ? "max-w-full" : "max-w-4xl"
        )}>
          {/* Mobile optimization notice */}
          {isMobile && (
            <Card className="mb-4 bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    Optimized for mobile! Tap and hold for gestures, swipe to navigate.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Welcome State */}
          <Card className="mb-6">
            <CardHeader className="text-center">
              <CardTitle className={cn(
                "flex items-center justify-center space-x-2",
                isMobile ? "text-lg" : "text-xl"
              )}>
                <MessageCircle className={cn(
                  isMobile ? "h-5 w-5" : "h-6 w-6"
                )} />
                <span>Welcome to Primal Marc</span>
              </CardTitle>
              <CardDescription className={isMobile ? "text-sm" : ""}>
                Your AI-powered writing assistant is ready to help you through every phase of the writing process
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className={cn(
                "grid gap-4 mb-6",
                isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
              )}>
                <Card className={cn(
                  "p-4 transition-all duration-200 hover:shadow-md",
                  isMobile && "active:scale-95"
                )}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">1</span>
                    </div>
                    <h3 className="font-medium">Ideation</h3>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Brainstorm ideas and structure your concepts with AI guidance
                  </p>
                </Card>
                <Card className={cn(
                  "p-4 transition-all duration-200 hover:shadow-md",
                  isMobile && "active:scale-95"
                )}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">2</span>
                    </div>
                    <h3 className="font-medium">Draft Refinement</h3>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Improve structure, style, and flow with personalized feedback
                  </p>
                </Card>
                <Card className={cn(
                  "p-4 transition-all duration-200 hover:shadow-md",
                  isMobile && "active:scale-95"
                )}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold text-sm">3</span>
                    </div>
                    <h3 className="font-medium">Media Creation</h3>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Add engaging visuals, memes, and charts to your content
                  </p>
                </Card>
                <Card className={cn(
                  "p-4 transition-all duration-200 hover:shadow-md",
                  isMobile && "active:scale-95"
                )}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-semibold text-sm">4</span>
                    </div>
                    <h3 className="font-medium">Fact-checking & SEO</h3>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Verify facts and optimize your content for search engines
                  </p>
                </Card>
              </div>
              <div className="space-y-3">
                <Button 
                  size={isMobile ? "default" : "lg"}
                  className="w-full"
                  onClick={handleCreateProject}
                  disabled={createProjectMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createProjectMutation.isPending ? 'Creating...' : 'Create New Project'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Start with a blank canvas or import existing content
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className={isMobile ? "text-base" : "text-lg"}>
                  Recent Projects
                </CardTitle>
                <CardDescription className={isMobile ? "text-sm" : ""}>
                  Continue working on your recent projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentProjects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all duration-200",
                        "hover:bg-muted/50 hover:shadow-sm",
                        isMobile && "active:scale-98 active:bg-muted/70"
                      )}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className={cn(
                          "font-medium truncate",
                          isMobile ? "text-sm" : ""
                        )}>
                          {project.title}
                        </h4>
                        <p className={cn(
                          "text-muted-foreground truncate",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {project.metadata.wordCount} words • Updated {new Date(project.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size={isMobile ? "sm" : "sm"}
                        className="shrink-0"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat Interface Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-base" : "text-lg"}>
                AI Assistant
              </CardTitle>
              <CardDescription className={isMobile ? "text-sm" : ""}>
                Your writing companion is ready to help
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "bg-muted/20 rounded-lg flex items-center justify-center",
                isMobile ? "min-h-[200px]" : "min-h-[300px]"
              )}>
                <div className="text-center p-4">
                  <MessageCircle className={cn(
                    "text-muted-foreground mx-auto mb-4",
                    isMobile ? "h-8 w-8" : "h-12 w-12"
                  )} />
                  <p className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-sm" : ""
                  )}>
                    Create a project to start collaborating with your AI writing assistant
                  </p>
                  <p className={cn(
                    "text-muted-foreground mt-2",
                    isMobile ? "text-xs" : "text-xs"
                  )}>
                    Real-time chat interface with AI agents is now available!
                  </p>
                  {isMobile && (
                    <div className="flex items-center justify-center mt-3 text-xs text-muted-foreground">
                      <Monitor className="h-3 w-3 mr-1" />
                      <span>Best experienced on mobile</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}