import { prisma } from './database.js'
import { ProjectModel } from '../models/project.js'
import { logger } from '../utils/logger.js'

export interface ProjectFolder {
  id: string
  name: string
  userId: string
  parentId?: string
  createdAt: Date
  updatedAt: Date
  projects?: any[]
  subfolders?: ProjectFolder[]
}

export interface ProjectTag {
  id: string
  name: string
  color?: string
  userId: string
  createdAt: Date
}

export interface OrganizationStats {
  totalProjects: number
  projectsByStatus: Record<string, number>
  projectsByFolder: Record<string, number>
  topTags: Array<{ name: string; count: number }>
}

export class ProjectOrganizationService {
  /**
   * Create a new folder
   */
  static async createFolder(data: {
    name: string
    userId: string
    parentId?: string
  }): Promise<ProjectFolder> {
    try {
      // Check if parent folder exists and belongs to user
      if (data.parentId) {
        const parentFolder = await prisma.projectFolder.findFirst({
          where: {
            id: data.parentId,
            userId: data.userId
          }
        })
        
        if (!parentFolder) {
          throw new Error('Parent folder not found')
        }
      }
      
      const folder = await prisma.projectFolder.create({
        data: {
          name: data.name,
          userId: data.userId,
          parentId: data.parentId
        }
      })
      
      logger.info(`Folder created: ${folder.id} for user ${data.userId}`)
      return folder
    } catch (error) {
      logger.error('Failed to create folder:', error)
      throw error
    }
  }
  
  /**
   * Get folder hierarchy for user
   */
  static async getFolderHierarchy(userId: string): Promise<ProjectFolder[]> {
    try {
      const folders = await prisma.projectFolder.findMany({
        where: { userId },
        include: {
          projects: {
            select: {
              id: true,
              title: true,
              status: true,
              updatedAt: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })
      
      // Build hierarchy
      const folderMap = new Map<string, ProjectFolder>()
      const rootFolders: ProjectFolder[] = []
      
      // First pass: create folder objects
      folders.forEach(folder => {
        folderMap.set(folder.id, {
          ...folder,
          subfolders: []
        })
      })
      
      // Second pass: build hierarchy
      folders.forEach(folder => {
        const folderObj = folderMap.get(folder.id)!
        
        if (folder.parentId) {
          const parent = folderMap.get(folder.parentId)
          if (parent) {
            parent.subfolders!.push(folderObj)
          }
        } else {
          rootFolders.push(folderObj)
        }
      })
      
      return rootFolders
    } catch (error) {
      logger.error('Failed to get folder hierarchy:', error)
      throw error
    }
  }
  
  /**
   * Move project to folder
   */
  static async moveProjectToFolder(
    projectId: string,
    folderId: string | null,
    userId: string
  ): Promise<void> {
    try {
      // Verify project belongs to user
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          userId
        }
      })
      
      if (!project) {
        throw new Error('Project not found')
      }
      
      // Verify folder belongs to user (if specified)
      if (folderId) {
        const folder = await prisma.projectFolder.findFirst({
          where: {
            id: folderId,
            userId
          }
        })
        
        if (!folder) {
          throw new Error('Folder not found')
        }
      }
      
      await prisma.project.update({
        where: { id: projectId },
        data: { folderId }
      })
      
      logger.info(`Project ${projectId} moved to folder ${folderId}`)
    } catch (error) {
      logger.error('Failed to move project to folder:', error)
      throw error
    }
  }
  
  /**
   * Delete folder (and optionally move projects)
   */
  static async deleteFolder(
    folderId: string,
    userId: string,
    moveProjectsToFolderId?: string
  ): Promise<void> {
    try {
      const folder = await prisma.projectFolder.findFirst({
        where: {
          id: folderId,
          userId
        },
        include: {
          projects: true,
          subfolders: true
        }
      })
      
      if (!folder) {
        throw new Error('Folder not found')
      }
      
      // Check if folder has subfolders
      if (folder.subfolders.length > 0) {
        throw new Error('Cannot delete folder with subfolders')
      }
      
      // Move projects if specified
      if (folder.projects.length > 0) {
        if (moveProjectsToFolderId) {
          await prisma.project.updateMany({
            where: { folderId },
            data: { folderId: moveProjectsToFolderId }
          })
        } else {
          // Move to root (no folder)
          await prisma.project.updateMany({
            where: { folderId },
            data: { folderId: null }
          })
        }
      }
      
      await prisma.projectFolder.delete({
        where: { id: folderId }
      })
      
      logger.info(`Folder deleted: ${folderId}`)
    } catch (error) {
      logger.error('Failed to delete folder:', error)
      throw error
    }
  }
  
  /**
   * Create or get tag
   */
  static async createOrGetTag(name: string, userId: string, color?: string): Promise<ProjectTag> {
    try {
      // Try to find existing tag
      let tag = await prisma.projectTag.findFirst({
        where: {
          name: name.toLowerCase(),
          userId
        }
      })
      
      if (!tag) {
        tag = await prisma.projectTag.create({
          data: {
            name: name.toLowerCase(),
            color: color || this.generateTagColor(name),
            userId
          }
        })
        
        logger.info(`Tag created: ${tag.name} for user ${userId}`)
      }
      
      return tag
    } catch (error) {
      logger.error('Failed to create or get tag:', error)
      throw error
    }
  }
  
  /**
   * Add tags to project
   */
  static async addTagsToProject(
    projectId: string,
    tagNames: string[],
    userId: string
  ): Promise<void> {
    try {
      const project = await ProjectModel.findById(projectId, userId)
      if (!project) {
        throw new Error('Project not found')
      }
      
      const metadata = ProjectModel.getProjectMetadata(project)
      const currentTags = new Set(metadata.tags || [])
      
      // Add new tags
      tagNames.forEach(tagName => {
        currentTags.add(tagName.toLowerCase())
      })
      
      // Create tags in database if they don't exist
      for (const tagName of tagNames) {
        await this.createOrGetTag(tagName, userId)
      }
      
      // Update project metadata
      await ProjectModel.updateContent(projectId, {
        metadata: {
          ...metadata,
          tags: Array.from(currentTags)
        }
      })
      
      logger.info(`Tags added to project ${projectId}: ${tagNames.join(', ')}`)
    } catch (error) {
      logger.error('Failed to add tags to project:', error)
      throw error
    }
  }
  
  /**
   * Remove tags from project
   */
  static async removeTagsFromProject(
    projectId: string,
    tagNames: string[],
    userId: string
  ): Promise<void> {
    try {
      const project = await ProjectModel.findById(projectId, userId)
      if (!project) {
        throw new Error('Project not found')
      }
      
      const metadata = ProjectModel.getProjectMetadata(project)
      const currentTags = new Set(metadata.tags || [])
      
      // Remove tags
      tagNames.forEach(tagName => {
        currentTags.delete(tagName.toLowerCase())
      })
      
      // Update project metadata
      await ProjectModel.updateContent(projectId, {
        metadata: {
          ...metadata,
          tags: Array.from(currentTags)
        }
      })
      
      logger.info(`Tags removed from project ${projectId}: ${tagNames.join(', ')}`)
    } catch (error) {
      logger.error('Failed to remove tags from project:', error)
      throw error
    }
  }
  
  /**
   * Get all tags for user
   */
  static async getUserTags(userId: string): Promise<ProjectTag[]> {
    try {
      return await prisma.projectTag.findMany({
        where: { userId },
        orderBy: { name: 'asc' }
      })
    } catch (error) {
      logger.error('Failed to get user tags:', error)
      throw error
    }
  }
  
  /**
   * Get projects by tag
   */
  static async getProjectsByTag(
    userId: string,
    tagName: string,
    limit = 20,
    offset = 0
  ): Promise<any[]> {
    try {
      const projects = await prisma.project.findMany({
        where: {
          userId,
          metadata: {
            contains: `"${tagName.toLowerCase()}"`
          }
        },
        include: {
          phases: {
            select: {
              type: true,
              status: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset
      })
      
      // Filter projects that actually have the tag (more precise filtering)
      return projects.filter(project => {
        const metadata = ProjectModel.getProjectMetadata(project)
        return metadata.tags.includes(tagName.toLowerCase())
      })
    } catch (error) {
      logger.error('Failed to get projects by tag:', error)
      throw error
    }
  }
  
  /**
   * Get organization statistics
   */
  static async getOrganizationStats(userId: string): Promise<OrganizationStats> {
    try {
      const projects = await prisma.project.findMany({
        where: { userId },
        select: {
          status: true,
          folderId: true,
          metadata: true
        }
      })
      
      const stats: OrganizationStats = {
        totalProjects: projects.length,
        projectsByStatus: {},
        projectsByFolder: {},
        topTags: []
      }
      
      // Count by status
      projects.forEach(project => {
        stats.projectsByStatus[project.status] = 
          (stats.projectsByStatus[project.status] || 0) + 1
      })
      
      // Count by folder
      projects.forEach(project => {
        const folderId = project.folderId || 'root'
        stats.projectsByFolder[folderId] = 
          (stats.projectsByFolder[folderId] || 0) + 1
      })
      
      // Count tags
      const tagCounts = new Map<string, number>()
      projects.forEach(project => {
        const metadata = ProjectModel.getProjectMetadata(project)
        metadata.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        })
      })
      
      // Get top 10 tags
      stats.topTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))
      
      return stats
    } catch (error) {
      logger.error('Failed to get organization stats:', error)
      throw error
    }
  }
  
  /**
   * Generate a color for a tag based on its name
   */
  private static generateTagColor(name: string): string {
    const colors = [
      '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
    ]
    
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colors[Math.abs(hash) % colors.length]
  }
}