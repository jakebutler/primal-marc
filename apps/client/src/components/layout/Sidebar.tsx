import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  Plus,
  Folder
} from 'lucide-react'
import { WorkflowNavigation } from '@/components/workflow'

interface SidebarProps {
  className?: string
  projectId?: string
  onPhaseChange?: (phase: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '', projectId, onPhaseChange }) => {
  return (
    <div className={`w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      <div className="flex h-full flex-col">
        {/* Projects Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Projects</h2>
            <Button 
              size="sm" 
              variant="outline"
              className="touch-target"
            >
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
          <Card className="gesture-feedback">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Current Project
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">
                No active project
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Navigation Section */}
        <div className="flex-1 p-4 mobile-scroll">
          {projectId ? (
            <WorkflowNavigation 
              projectId={projectId} 
              onPhaseChange={onPhaseChange}
            />
          ) : (
            <Card className="gesture-feedback">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Select a project to view workflow
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Files Section */}
        <div className="p-4 border-t safe-area-bottom">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Folder className="h-4 w-4 mr-2" />
            Recent Files
          </h3>
          <div className="text-sm text-muted-foreground">
            No recent files
          </div>
        </div>
      </div>
    </div>
  )
}