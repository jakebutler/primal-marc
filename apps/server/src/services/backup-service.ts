import { prisma } from './database.js'
import { ProjectModel } from '../models/project.js'
import { logger } from '../utils/logger.js'
import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

export interface BackupOptions {
  includeConversations?: boolean
  includeMetadata?: boolean
  compression?: boolean
}

export interface BackupInfo {
  id: string
  userId: string
  projectId?: string
  type: 'project' | 'user' | 'system'
  size: number
  checksum: string
  createdAt: Date
  metadata?: any
}

export interface RestoreOptions {
  overwrite?: boolean
  preserveIds?: boolean
}

export class BackupService {
  private static readonly BACKUP_DIR = path.join(process.cwd(), 'backups')
  private static readonly MAX_BACKUP_AGE_DAYS = 30
  private static readonly MAX_BACKUPS_PER_USER = 10
  
  /**
   * Initialize backup service
   */
  static async initialize() {
    try {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true })
      
      // Schedule cleanup of old backups
      setInterval(() => {
        this.cleanupOldBackups().catch(error => 
          logger.error('Backup cleanup failed:', error)
        )
      }, 24 * 60 * 60 * 1000) // Daily cleanup
      
      logger.info('Backup service initialized')
    } catch (error) {
      logger.error('Failed to initialize backup service:', error)
      throw error
    }
  }
  
  /**
   * Create project backup
   */
  static async backupProject(
    projectId: string,
    userId: string,
    options: BackupOptions = {}
  ): Promise<BackupInfo> {
    try {
      const project = await ProjectModel.findById(projectId, userId)
      if (!project) {
        throw new Error('Project not found')
      }
      
      // Prepare backup data
      const backupData: any = {
        project: {
          id: project.id,
          title: project.title,
          content: project.content,
          status: project.status,
          metadata: project.metadata,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        phases: project.phases,
        version: '1.0',
        createdAt: new Date().toISOString()
      }
      
      // Include conversations if requested
      if (options.includeConversations) {
        backupData.conversations = project.conversations
      }
      
      // Generate backup file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `project_${projectId}_${timestamp}.json`
      const filePath = path.join(this.BACKUP_DIR, fileName)
      
      const jsonData = JSON.stringify(backupData, null, 2)
      await fs.writeFile(filePath, jsonData, 'utf-8')
      
      // Calculate file size and checksum
      const stats = await fs.stat(filePath)
      const checksum = this.calculateChecksum(jsonData)
      
      // Store backup info in database
      const backupInfo = await prisma.backup.create({
        data: {
          userId,
          projectId,
          type: 'project',
          fileName,
          size: stats.size,
          checksum,
          metadata: JSON.stringify({
            projectTitle: project.title,
            includeConversations: options.includeConversations,
            version: '1.0'
          })
        }
      })
      
      // Update project metadata with backup info
      const projectMetadata = ProjectModel.getProjectMetadata(project)
      await ProjectModel.updateContent(projectId, {
        metadata: {
          ...projectMetadata,
          lastBackup: new Date().toISOString()
        }
      })
      
      logger.info(`Project backup created: ${fileName}`)
      return backupInfo
    } catch (error) {
      logger.error('Project backup failed:', error)
      throw error
    }
  }
  
  /**
   * Create user data backup
   */
  static async backupUserData(
    userId: string,
    options: BackupOptions = {}
  ): Promise<BackupInfo> {
    try {
      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          bio: true,
          preferences: true,
          writingGenres: true,
          experienceLevel: true,
          createdAt: true
        }
      })
      
      if (!user) {
        throw new Error('User not found')
      }
      
      // Get all projects
      const projects = await prisma.project.findMany({
        where: { userId },
        include: {
          phases: true,
          conversations: options.includeConversations ? {
            include: {
              messages: true
            }
          } : false
        }
      })
      
      // Get folders and tags
      const folders = await prisma.projectFolder.findMany({
        where: { userId }
      })
      
      const tags = await prisma.projectTag.findMany({
        where: { userId }
      })
      
      // Prepare backup data
      const backupData = {
        user,
        projects,
        folders,
        tags,
        version: '1.0',
        createdAt: new Date().toISOString()
      }
      
      // Generate backup file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `user_${userId}_${timestamp}.json`
      const filePath = path.join(this.BACKUP_DIR, fileName)
      
      const jsonData = JSON.stringify(backupData, null, 2)
      await fs.writeFile(filePath, jsonData, 'utf-8')
      
      // Calculate file size and checksum
      const stats = await fs.stat(filePath)
      const checksum = this.calculateChecksum(jsonData)
      
      // Store backup info in database
      const backupInfo = await prisma.backup.create({
        data: {
          userId,
          type: 'user',
          fileName,
          size: stats.size,
          checksum,
          metadata: JSON.stringify({
            projectCount: projects.length,
            includeConversations: options.includeConversations,
            version: '1.0'
          })
        }
      })
      
      logger.info(`User backup created: ${fileName}`)
      return backupInfo
    } catch (error) {
      logger.error('User backup failed:', error)
      throw error
    }
  }
  
  /**
   * Restore project from backup
   */
  static async restoreProject(
    backupId: string,
    userId: string,
    options: RestoreOptions = {}
  ): Promise<string> {
    try {
      const backup = await prisma.backup.findFirst({
        where: {
          id: backupId,
          userId,
          type: 'project'
        }
      })
      
      if (!backup) {
        throw new Error('Backup not found')
      }
      
      // Read backup file
      const filePath = path.join(this.BACKUP_DIR, backup.fileName)
      const jsonData = await fs.readFile(filePath, 'utf-8')
      
      // Verify checksum
      const checksum = this.calculateChecksum(jsonData)
      if (checksum !== backup.checksum) {
        throw new Error('Backup file corrupted')
      }
      
      const backupData = JSON.parse(jsonData)
      
      // Check if project already exists
      let projectId = backupData.project.id
      
      if (!options.preserveIds) {
        // Generate new ID
        projectId = undefined
      } else {
        const existingProject = await prisma.project.findFirst({
          where: {
            id: projectId,
            userId
          }
        })
        
        if (existingProject && !options.overwrite) {
          throw new Error('Project already exists. Use overwrite option to replace.')
        }
      }
      
      // Restore project
      const restoredProject = await prisma.project.upsert({
        where: {
          id: projectId || 'new'
        },
        create: {
          userId,
          title: backupData.project.title,
          content: backupData.project.content,
          status: backupData.project.status,
          metadata: backupData.project.metadata
        },
        update: {
          title: backupData.project.title,
          content: backupData.project.content,
          status: backupData.project.status,
          metadata: backupData.project.metadata
        }
      })
      
      // Restore phases
      if (backupData.phases) {
        // Delete existing phases if overwriting
        if (options.overwrite) {
          await prisma.projectPhase.deleteMany({
            where: { projectId: restoredProject.id }
          })
        }
        
        for (const phase of backupData.phases) {
          await prisma.projectPhase.create({
            data: {
              projectId: restoredProject.id,
              type: phase.type,
              status: phase.status,
              outputs: phase.outputs,
              completedAt: phase.completedAt
            }
          })
        }
      }
      
      // Restore conversations if included
      if (backupData.conversations) {
        // Delete existing conversations if overwriting
        if (options.overwrite) {
          await prisma.conversation.deleteMany({
            where: { projectId: restoredProject.id }
          })
        }
        
        for (const conversation of backupData.conversations) {
          const restoredConversation = await prisma.conversation.create({
            data: {
              projectId: restoredProject.id,
              agentType: conversation.agentType,
              context: conversation.context
            }
          })
          
          // Restore messages
          if (conversation.messages) {
            for (const message of conversation.messages) {
              await prisma.message.create({
                data: {
                  conversationId: restoredConversation.id,
                  role: message.role,
                  content: message.content,
                  agentType: message.agentType,
                  metadata: message.metadata,
                  timestamp: new Date(message.timestamp)
                }
              })
            }
          }
        }
      }
      
      logger.info(`Project restored from backup: ${restoredProject.id}`)
      return restoredProject.id
    } catch (error) {
      logger.error('Project restore failed:', error)
      throw error
    }
  }
  
  /**
   * Get user backups
   */
  static async getUserBackups(userId: string): Promise<BackupInfo[]> {
    try {
      return await prisma.backup.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      })
    } catch (error) {
      logger.error('Failed to get user backups:', error)
      throw error
    }
  }
  
  /**
   * Delete backup
   */
  static async deleteBackup(backupId: string, userId: string): Promise<void> {
    try {
      const backup = await prisma.backup.findFirst({
        where: {
          id: backupId,
          userId
        }
      })
      
      if (!backup) {
        throw new Error('Backup not found')
      }
      
      // Delete file
      const filePath = path.join(this.BACKUP_DIR, backup.fileName)
      try {
        await fs.unlink(filePath)
      } catch (error) {
        logger.warn(`Failed to delete backup file: ${backup.fileName}`)
      }
      
      // Delete database record
      await prisma.backup.delete({
        where: { id: backupId }
      })
      
      logger.info(`Backup deleted: ${backupId}`)
    } catch (error) {
      logger.error('Failed to delete backup:', error)
      throw error
    }
  }
  
  /**
   * Auto-backup projects (scheduled task)
   */
  static async autoBackupProjects(): Promise<void> {
    try {
      // Get projects that haven't been backed up recently
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 7) // 7 days ago
      
      const projects = await prisma.project.findMany({
        where: {
          updatedAt: {
            gte: cutoffDate
          }
        },
        select: {
          id: true,
          userId: true,
          metadata: true
        }
      })
      
      for (const project of projects) {
        const metadata = ProjectModel.getProjectMetadata(project)
        const lastBackup = metadata.lastBackup ? new Date(metadata.lastBackup) : null
        
        // Skip if backed up recently
        if (lastBackup && lastBackup > cutoffDate) {
          continue
        }
        
        try {
          await this.backupProject(project.id, project.userId, {
            includeConversations: false
          })
        } catch (error) {
          logger.error(`Auto-backup failed for project ${project.id}:`, error)
        }
      }
      
      logger.info('Auto-backup completed')
    } catch (error) {
      logger.error('Auto-backup failed:', error)
    }
  }
  
  /**
   * Clean up old backups
   */
  private static async cleanupOldBackups(): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.MAX_BACKUP_AGE_DAYS)
      
      const oldBackups = await prisma.backup.findMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      })
      
      for (const backup of oldBackups) {
        try {
          const filePath = path.join(this.BACKUP_DIR, backup.fileName)
          await fs.unlink(filePath)
        } catch (error) {
          logger.warn(`Failed to delete old backup file: ${backup.fileName}`)
        }
        
        await prisma.backup.delete({
          where: { id: backup.id }
        })
      }
      
      // Also enforce per-user backup limits
      const users = await prisma.user.findMany({
        select: { id: true }
      })
      
      for (const user of users) {
        const userBackups = await prisma.backup.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' }
        })
        
        if (userBackups.length > this.MAX_BACKUPS_PER_USER) {
          const excessBackups = userBackups.slice(this.MAX_BACKUPS_PER_USER)
          
          for (const backup of excessBackups) {
            try {
              const filePath = path.join(this.BACKUP_DIR, backup.fileName)
              await fs.unlink(filePath)
            } catch (error) {
              logger.warn(`Failed to delete excess backup file: ${backup.fileName}`)
            }
            
            await prisma.backup.delete({
              where: { id: backup.id }
            })
          }
        }
      }
      
      logger.info('Old backups cleaned up')
    } catch (error) {
      logger.error('Backup cleanup failed:', error)
    }
  }
  
  /**
   * Calculate checksum for data integrity
   */
  private static calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex')
  }
}