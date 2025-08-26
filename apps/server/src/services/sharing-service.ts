import { prisma } from './database.js'
import { ProjectModel } from '../models/project.js'
import { logger } from '../utils/logger.js'
import { randomBytes } from 'crypto'

export interface ShareOptions {
  permissions: 'read' | 'comment' | 'edit'
  expiresAt?: Date
  password?: string
  allowDownload?: boolean
}

export interface ShareLink {
  id: string
  projectId: string
  token: string
  permissions: string
  expiresAt?: Date
  password?: string
  allowDownload: boolean
  createdAt: Date
  accessCount: number
}

export interface CollaborationInvite {
  id: string
  projectId: string
  inviterUserId: string
  inviteeEmail: string
  permissions: string
  status: 'pending' | 'accepted' | 'declined'
  token: string
  expiresAt: Date
  createdAt: Date
}

export class SharingService {
  /**
   * Create a shareable link for a project
   */
  static async createShareLink(
    projectId: string,
    userId: string,
    options: ShareOptions
  ): Promise<ShareLink> {
    try {
      // Verify project ownership
      const project = await ProjectModel.findById(projectId, userId)
      if (!project) {
        throw new Error('Project not found or access denied')
      }
      
      // Generate secure token
      const token = this.generateSecureToken()
      
      // Create share link
      const shareLink = await prisma.shareLink.create({
        data: {
          projectId,
          token,
          permissions: options.permissions,
          expiresAt: options.expiresAt,
          password: options.password,
          allowDownload: options.allowDownload || false,
          accessCount: 0
        }
      })
      
      logger.info(`Share link created for project ${projectId}`)
      return shareLink
    } catch (error) {
      logger.error('Failed to create share link:', error)
      throw error
    }
  }
  
  /**
   * Access project via share link
   */
  static async accessSharedProject(
    token: string,
    password?: string
  ): Promise<{
    project: any
    permissions: string
    allowDownload: boolean
  }> {
    try {
      const shareLink = await prisma.shareLink.findUnique({
        where: { token },
        include: {
          project: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              },
              phases: true
            }
          }
        }
      })
      
      if (!shareLink) {
        throw new Error('Share link not found')
      }
      
      // Check expiration
      if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
        throw new Error('Share link has expired')
      }
      
      // Check password if required
      if (shareLink.password && shareLink.password !== password) {
        throw new Error('Invalid password')
      }
      
      // Increment access count
      await prisma.shareLink.update({
        where: { id: shareLink.id },
        data: {
          accessCount: shareLink.accessCount + 1,
          lastAccessedAt: new Date()
        }
      })
      
      // Return project data based on permissions
      let projectData = {
        id: shareLink.project.id,
        title: shareLink.project.title,
        content: shareLink.project.content,
        status: shareLink.project.status,
        createdAt: shareLink.project.createdAt,
        updatedAt: shareLink.project.updatedAt,
        author: {
          name: `${shareLink.project.user.firstName || ''} ${shareLink.project.user.lastName || ''}`.trim() || 'Anonymous'
        },
        metadata: ProjectModel.getProjectMetadata(shareLink.project)
      }
      
      // Include phases if read permission or higher
      if (['read', 'comment', 'edit'].includes(shareLink.permissions)) {
        projectData = {
          ...projectData,
          phases: shareLink.project.phases
        } as any
      }
      
      return {
        project: projectData,
        permissions: shareLink.permissions,
        allowDownload: shareLink.allowDownload
      }
    } catch (error) {
      logger.error('Failed to access shared project:', error)
      throw error
    }
  }
  
  /**
   * Update share link settings
   */
  static async updateShareLink(
    linkId: string,
    userId: string,
    updates: Partial<ShareOptions>
  ): Promise<ShareLink> {
    try {
      // Verify ownership
      const shareLink = await prisma.shareLink.findUnique({
        where: { id: linkId },
        include: {
          project: true
        }
      })
      
      if (!shareLink || shareLink.project.userId !== userId) {
        throw new Error('Share link not found or access denied')
      }
      
      // Update share link
      const updatedLink = await prisma.shareLink.update({
        where: { id: linkId },
        data: {
          permissions: updates.permissions,
          expiresAt: updates.expiresAt,
          password: updates.password,
          allowDownload: updates.allowDownload
        }
      })
      
      logger.info(`Share link updated: ${linkId}`)
      return updatedLink
    } catch (error) {
      logger.error('Failed to update share link:', error)
      throw error
    }
  }
  
  /**
   * Revoke share link
   */
  static async revokeShareLink(linkId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const shareLink = await prisma.shareLink.findUnique({
        where: { id: linkId },
        include: {
          project: true
        }
      })
      
      if (!shareLink || shareLink.project.userId !== userId) {
        throw new Error('Share link not found or access denied')
      }
      
      await prisma.shareLink.delete({
        where: { id: linkId }
      })
      
      logger.info(`Share link revoked: ${linkId}`)
    } catch (error) {
      logger.error('Failed to revoke share link:', error)
      throw error
    }
  }
  
  /**
   * Get project share links
   */
  static async getProjectShareLinks(
    projectId: string,
    userId: string
  ): Promise<ShareLink[]> {
    try {
      // Verify project ownership
      const project = await ProjectModel.findById(projectId, userId)
      if (!project) {
        throw new Error('Project not found or access denied')
      }
      
      return await prisma.shareLink.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' }
      })
    } catch (error) {
      logger.error('Failed to get project share links:', error)
      throw error
    }
  }
  
  /**
   * Invite user to collaborate on project
   */
  static async inviteCollaborator(
    projectId: string,
    inviterUserId: string,
    inviteeEmail: string,
    permissions: 'read' | 'comment' | 'edit'
  ): Promise<CollaborationInvite> {
    try {
      // Verify project ownership
      const project = await ProjectModel.findById(projectId, inviterUserId)
      if (!project) {
        throw new Error('Project not found or access denied')
      }
      
      // Check if user is already invited or collaborating
      const existingInvite = await prisma.collaborationInvite.findFirst({
        where: {
          projectId,
          inviteeEmail,
          status: 'pending'
        }
      })
      
      if (existingInvite) {
        throw new Error('User already invited')
      }
      
      // Check if user is already a collaborator
      const existingCollaborator = await prisma.projectCollaborator.findFirst({
        where: {
          projectId,
          user: {
            email: inviteeEmail
          }
        }
      })
      
      if (existingCollaborator) {
        throw new Error('User is already a collaborator')
      }
      
      // Generate invitation token
      const token = this.generateSecureToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration
      
      // Create invitation
      const invite = await prisma.collaborationInvite.create({
        data: {
          projectId,
          inviterUserId,
          inviteeEmail,
          permissions,
          token,
          expiresAt,
          status: 'pending'
        }
      })
      
      // TODO: Send invitation email
      // await this.sendInvitationEmail(invite)
      
      logger.info(`Collaboration invite sent to ${inviteeEmail} for project ${projectId}`)
      return invite
    } catch (error) {
      logger.error('Failed to invite collaborator:', error)
      throw error
    }
  }
  
  /**
   * Accept collaboration invitation
   */
  static async acceptInvitation(token: string, userId: string): Promise<void> {
    try {
      const invite = await prisma.collaborationInvite.findUnique({
        where: { token },
        include: {
          project: true,
          inviter: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      })
      
      if (!invite) {
        throw new Error('Invitation not found')
      }
      
      if (invite.status !== 'pending') {
        throw new Error('Invitation already processed')
      }
      
      if (invite.expiresAt < new Date()) {
        throw new Error('Invitation has expired')
      }
      
      // Get user email to verify
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
      
      if (!user || user.email !== invite.inviteeEmail) {
        throw new Error('Invalid user for this invitation')
      }
      
      // Create collaboration
      await prisma.projectCollaborator.create({
        data: {
          projectId: invite.projectId,
          userId,
          permissions: invite.permissions,
          invitedAt: invite.createdAt
        }
      })
      
      // Update invitation status
      await prisma.collaborationInvite.update({
        where: { id: invite.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date()
        }
      })
      
      logger.info(`Collaboration invitation accepted by user ${userId}`)
    } catch (error) {
      logger.error('Failed to accept invitation:', error)
      throw error
    }
  }
  
  /**
   * Get project collaborators
   */
  static async getProjectCollaborators(
    projectId: string,
    userId: string
  ): Promise<any[]> {
    try {
      // Verify access to project
      const hasAccess = await this.verifyProjectAccess(projectId, userId)
      if (!hasAccess) {
        throw new Error('Access denied')
      }
      
      return await prisma.projectCollaborator.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    } catch (error) {
      logger.error('Failed to get project collaborators:', error)
      throw error
    }
  }
  
  /**
   * Remove collaborator from project
   */
  static async removeCollaborator(
    projectId: string,
    collaboratorUserId: string,
    ownerUserId: string
  ): Promise<void> {
    try {
      // Verify project ownership
      const project = await ProjectModel.findById(projectId, ownerUserId)
      if (!project) {
        throw new Error('Project not found or access denied')
      }
      
      await prisma.projectCollaborator.deleteMany({
        where: {
          projectId,
          userId: collaboratorUserId
        }
      })
      
      logger.info(`Collaborator ${collaboratorUserId} removed from project ${projectId}`)
    } catch (error) {
      logger.error('Failed to remove collaborator:', error)
      throw error
    }
  }
  
  /**
   * Add comment to shared project
   */
  static async addComment(
    projectId: string,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<any> {
    try {
      // Verify comment permission
      const hasPermission = await this.verifyCommentPermission(projectId, userId)
      if (!hasPermission) {
        throw new Error('Comment permission denied')
      }
      
      const comment = await prisma.projectComment.create({
        data: {
          projectId,
          userId,
          content,
          parentCommentId
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          replies: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      })
      
      logger.info(`Comment added to project ${projectId} by user ${userId}`)
      return comment
    } catch (error) {
      logger.error('Failed to add comment:', error)
      throw error
    }
  }
  
  /**
   * Get project comments
   */
  static async getProjectComments(
    projectId: string,
    userId: string
  ): Promise<any[]> {
    try {
      // Verify read access
      const hasAccess = await this.verifyProjectAccess(projectId, userId)
      if (!hasAccess) {
        throw new Error('Access denied')
      }
      
      return await prisma.projectComment.findMany({
        where: {
          projectId,
          parentCommentId: null // Only top-level comments
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          replies: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    } catch (error) {
      logger.error('Failed to get project comments:', error)
      throw error
    }
  }
  
  /**
   * Generate secure token
   */
  private static generateSecureToken(): string {
    return randomBytes(32).toString('hex')
  }
  
  /**
   * Verify project access for user
   */
  private static async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Check if user owns the project
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          userId
        }
      })
      
      if (project) return true
      
      // Check if user is a collaborator
      const collaborator = await prisma.projectCollaborator.findFirst({
        where: {
          projectId,
          userId
        }
      })
      
      return !!collaborator
    } catch (error) {
      return false
    }
  }
  
  /**
   * Verify comment permission for user
   */
  private static async verifyCommentPermission(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Check if user owns the project
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          userId
        }
      })
      
      if (project) return true
      
      // Check if user is a collaborator with comment or edit permission
      const collaborator = await prisma.projectCollaborator.findFirst({
        where: {
          projectId,
          userId,
          permissions: {
            in: ['comment', 'edit']
          }
        }
      })
      
      return !!collaborator
    } catch (error) {
      return false
    }
  }
}