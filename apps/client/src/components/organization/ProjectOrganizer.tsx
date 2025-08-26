import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { useToast } from '../../hooks/use-toast'
import {
  Folder,
  FolderPlus,
  Tag,
  Plus,
  X,
  MoreHorizontal,
  Move,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Label } from '../ui/label'

interface ProjectFolder {
  id: string
  name: string
  parentId?: string
  projects?: any[]
  subfolders?: ProjectFolder[]
}

interface ProjectTag {
  id: string
  name: string
  color?: string
}

interface ProjectOrganizerProps {
  projectId?: string
  onProjectMoved?: () => void
}

export function ProjectOrganizer({ projectId, onProjectMoved }: ProjectOrganizerProps) {
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [tags, setTags] = useState<ProjectTag[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadFolders()
    loadTags()
  }, [])

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/organization/folders', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const result = await response.json()
      if (result.success) {
        setFolders(result.data)
      }
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  }

  const loadTags = async () => {
    try {
      const response = await fetch('/api/organization/tags', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const result = await response.json()
      if (result.success) {
        setTags(result.data)
      }
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return

    setIsCreatingFolder(true)
    try {
      const response = await fetch('/api/organization/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newFolderName.trim()
        })
      })

      const result = await response.json()
      if (result.success) {
        setNewFolderName('')
        loadFolders()
        toast({
          title: 'Folder created',
          description: `"${newFolderName}" has been created successfully`
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: 'Failed to create folder',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const moveProjectToFolder = async (folderId: string | null) => {
    if (!projectId) return

    try {
      const response = await fetch(`/api/organization/projects/${projectId}/folder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          folderId
        })
      })

      const result = await response.json()
      if (result.success) {
        toast({
          title: 'Project moved',
          description: folderId 
            ? 'Project has been moved to the selected folder'
            : 'Project has been moved to the root level'
        })
        onProjectMoved?.()
        setShowMoveDialog(false)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: 'Failed to move project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      })
    }
  }

  const addTagToProject = async (tagName: string) => {
    if (!projectId) return

    try {
      const response = await fetch(`/api/organization/projects/${projectId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tags: [tagName]
        })
      })

      const result = await response.json()
      if (result.success) {
        toast({
          title: 'Tag added',
          description: `"${tagName}" has been added to the project`
        })
        setNewTagName('')
        loadTags()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: 'Failed to add tag',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      })
    }
  }

  const renderFolder = (folder: ProjectFolder, level = 0) => (
    <div key={folder.id} className={`ml-${level * 4}`}>
      <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
        <Folder className="h-4 w-4 text-blue-500" />
        <span className="text-sm">{folder.name}</span>
        <span className="text-xs text-gray-500">
          ({folder.projects?.length || 0})
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
              setSelectedFolder(folder.id)
              setShowMoveDialog(true)
            }}>
              <Move className="mr-2 h-4 w-4" />
              Move project here
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {folder.subfolders?.map(subfolder => renderFolder(subfolder, level + 1))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Folders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Project Folders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create New Folder */}
          <div className="flex gap-2">
            <Input
              placeholder="New folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
            />
            <Button 
              onClick={createFolder} 
              disabled={isCreatingFolder || !newFolderName.trim()}
              size="sm"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          {/* Folder List */}
          <div className="space-y-1">
            {/* Root Level */}
            <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
              <Folder className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Root</span>
              {projectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFolder(null)
                    setShowMoveDialog(true)
                  }}
                >
                  <Move className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {folders.map(folder => renderFolder(folder))}
          </div>
        </CardContent>
      </Card>

      {/* Tags Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Project Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create New Tag */}
          {projectId && (
            <div className="flex gap-2">
              <Input
                placeholder="Add tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTagToProject(newTagName)}
              />
              <Button 
                onClick={() => addTagToProject(newTagName)} 
                disabled={isCreatingTag || !newTagName.trim()}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Separator />

          {/* Tag List */}
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="cursor-pointer hover:bg-gray-200"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Move Project Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Project</DialogTitle>
            <DialogDescription>
              Select a folder to move this project to, or choose root to remove it from all folders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => moveProjectToFolder(null)}
            >
              <Folder className="mr-2 h-4 w-4 text-gray-500" />
              Root (No folder)
            </Button>
            
            {folders.map(folder => (
              <Button
                key={folder.id}
                variant="ghost"
                className="w-full justify-start"
                onClick={() => moveProjectToFolder(folder.id)}
              >
                <Folder className="mr-2 h-4 w-4 text-blue-500" />
                {folder.name}
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}