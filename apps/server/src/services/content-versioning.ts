import { prisma } from './database.js'
import { logger } from '../utils/logger.js'

export interface ContentVersion {
  id: string
  projectId: string
  content: string
  title: string
  metadata?: string
  version: number
  createdAt: Date
  isAutoSave: boolean
}

export class ContentVersioningService {
  private static readonly MAX_VERSIONS = 50 // Keep last 50 versions
  private static readonly AUTO_SAVE_INTERVAL = 30000 // 30 seconds
  
  /**
   * Create a new content version
   */
  static async createVersion(data: {
    projectId: string
    content: string
    title: string
    metadata?: string
    isAutoSave?: boolean
  }): Promise<ContentVersion> {
    try {
      // Get the latest version number
      const latestVersion = await prisma.$queryRaw<{ version: number }[]>`
        SELECT MAX(version) as version 
        FROM content_versions 
        WHERE projectId = ${data.projectId}
      `
      
      const nextVersion = (latestVersion[0]?.version || 0) + 1
      
      // Create the version record using raw SQL since we don't have a Prisma model
      const versionId = `cv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await prisma.$executeRaw`
        INSERT INTO content_versions (
          id, projectId, content, title, metadata, version, createdAt, isAutoSave
        ) VALUES (
          ${versionId},
          ${data.projectId},
          ${data.content},
          ${data.title},
          ${data.metadata || null},
          ${nextVersion},
          ${new Date().toISOString()},
          ${data.isAutoSave || false}
        )
      `
      
      // Clean up old versions
      await this.cleanupOldVersions(data.projectId)
      
      const version: ContentVersion = {
        id: versionId,
        projectId: data.projectId,
        content: data.content,
        title: data.title,
        metadata: data.metadata,
        version: nextVersion,
        createdAt: new Date(),
        isAutoSave: data.isAutoSave || false,
      }
      
      logger.info(`Content version created: ${versionId} (v${nextVersion}) for project ${data.projectId}`)
      return version
    } catch (error) {
      logger.error('Failed to create content version:', error)
      throw error
    }
  }
  
  /**
   * Get all versions for a project
   */
  static async getVersions(projectId: string, limit = 20): Promise<ContentVersion[]> {
    try {
      const versions = await prisma.$queryRaw<ContentVersion[]>`
        SELECT * FROM content_versions 
        WHERE projectId = ${projectId}
        ORDER BY version DESC
        LIMIT ${limit}
      `
      
      return versions.map(v => ({
        ...v,
        createdAt: new Date(v.createdAt),
      }))
    } catch (error) {
      logger.error('Failed to get content versions:', error)
      throw error
    }
  }
  
  /**
   * Get a specific version
   */
  static async getVersion(projectId: string, version: number): Promise<ContentVersion | null> {
    try {
      const versions = await prisma.$queryRaw<ContentVersion[]>`
        SELECT * FROM content_versions 
        WHERE projectId = ${projectId} AND version = ${version}
        LIMIT 1
      `
      
      if (versions.length === 0) return null
      
      return {
        ...versions[0],
        createdAt: new Date(versions[0].createdAt),
      }
    } catch (error) {
      logger.error('Failed to get content version:', error)
      throw error
    }
  }
  
  /**
   * Restore a project to a specific version
   */
  static async restoreVersion(projectId: string, version: number): Promise<void> {
    try {
      const versionData = await this.getVersion(projectId, version)
      if (!versionData) {
        throw new Error('Version not found')
      }
      
      // Update the project with the version data
      await prisma.project.update({
        where: { id: projectId },
        data: {
          content: versionData.content,
          title: versionData.title,
          metadata: versionData.metadata,
          updatedAt: new Date(),
        },
      })
      
      // Create a new version marking this as a restore
      await this.createVersion({
        projectId,
        content: versionData.content,
        title: versionData.title,
        metadata: versionData.metadata,
        isAutoSave: false,
      })
      
      logger.info(`Project ${projectId} restored to version ${version}`)
    } catch (error) {
      logger.error('Failed to restore version:', error)
      throw error
    }
  }
  
  /**
   * Clean up old versions, keeping only the most recent ones
   */
  private static async cleanupOldVersions(projectId: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        DELETE FROM content_versions 
        WHERE projectId = ${projectId}
        AND version NOT IN (
          SELECT version FROM content_versions 
          WHERE projectId = ${projectId}
          ORDER BY version DESC 
          LIMIT ${this.MAX_VERSIONS}
        )
      `
    } catch (error) {
      logger.error('Failed to cleanup old versions:', error)
      // Don't throw here as this is a cleanup operation
    }
  }
  
  /**
   * Initialize the content_versions table if it doesn't exist
   */
  static async initializeVersioningTable(): Promise<void> {
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS content_versions (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          content TEXT NOT NULL,
          title TEXT NOT NULL,
          metadata TEXT,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          isAutoSave BOOLEAN NOT NULL DEFAULT FALSE,
          FOREIGN KEY (projectId) REFERENCES projects (id) ON DELETE CASCADE
        )
      `
      
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_content_versions_project_version 
        ON content_versions (projectId, version)
      `
      
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_content_versions_created_at 
        ON content_versions (createdAt)
      `
      
      logger.info('Content versioning table initialized')
    } catch (error) {
      logger.error('Failed to initialize versioning table:', error)
      throw error
    }
  }
}

// Auto-save manager for handling periodic saves
export class AutoSaveManager {
  private static saveTimers = new Map<string, NodeJS.Timeout>()
  private static pendingChanges = new Map<string, {
    content: string
    title: string
    metadata?: string
    lastChange: number
  }>()
  
  /**
   * Schedule an auto-save for a project
   */
  static scheduleAutoSave(projectId: string, data: {
    content: string
    title: string
    metadata?: string
  }): void {
    // Clear existing timer
    const existingTimer = this.saveTimers.get(projectId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    
    // Store pending changes
    this.pendingChanges.set(projectId, {
      ...data,
      lastChange: Date.now(),
    })
    
    // Schedule new save
    const timer = setTimeout(async () => {
      await this.performAutoSave(projectId)
    }, ContentVersioningService['AUTO_SAVE_INTERVAL'])
    
    this.saveTimers.set(projectId, timer)
  }
  
  /**
   * Perform the actual auto-save
   */
  private static async performAutoSave(projectId: string): Promise<void> {
    try {
      const pendingData = this.pendingChanges.get(projectId)
      if (!pendingData) return
      
      // Check if changes are recent enough (within last 5 minutes)
      const timeSinceLastChange = Date.now() - pendingData.lastChange
      if (timeSinceLastChange > 5 * 60 * 1000) {
        // Changes are too old, skip auto-save
        this.cleanup(projectId)
        return
      }
      
      // Create version
      await ContentVersioningService.createVersion({
        projectId,
        content: pendingData.content,
        title: pendingData.title,
        metadata: pendingData.metadata,
        isAutoSave: true,
      })
      
      // Update the project
      await prisma.project.update({
        where: { id: projectId },
        data: {
          content: pendingData.content,
          title: pendingData.title,
          metadata: pendingData.metadata,
          updatedAt: new Date(),
        },
      })
      
      logger.info(`Auto-save completed for project ${projectId}`)
      this.cleanup(projectId)
    } catch (error) {
      logger.error(`Auto-save failed for project ${projectId}:`, error)
      this.cleanup(projectId)
    }
  }
  
  /**
   * Force save immediately
   */
  static async forceSave(projectId: string): Promise<void> {
    const existingTimer = this.saveTimers.get(projectId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      await this.performAutoSave(projectId)
    }
  }
  
  /**
   * Cancel auto-save for a project
   */
  static cancelAutoSave(projectId: string): void {
    this.cleanup(projectId)
  }
  
  /**
   * Clean up timers and pending changes
   */
  private static cleanup(projectId: string): void {
    const timer = this.saveTimers.get(projectId)
    if (timer) {
      clearTimeout(timer)
      this.saveTimers.delete(projectId)
    }
    this.pendingChanges.delete(projectId)
  }
  
  /**
   * Get pending changes for a project
   */
  static getPendingChanges(projectId: string) {
    return this.pendingChanges.get(projectId)
  }
  
  /**
   * Check if project has pending auto-save
   */
  static hasPendingAutoSave(projectId: string): boolean {
    return this.saveTimers.has(projectId)
  }
}