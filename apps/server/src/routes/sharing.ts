import express from 'express'
import { SharingService } from '../services/sharing-service.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

/**
 * Create share link
 */
router.post('/projects/:projectId/links', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { permissions, expiresAt, password, allowDownload } = req.body
    const userId = req.user!.id
    
    if (!['read', 'comment', 'edit'].includes(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permissions. Must be read, comment, or edit'
      })
    }
    
    const shareLink = await SharingService.createShareLink(projectId, userId, {
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      password,
      allowDownload
    })
    
    res.json({
      success: true,
      data: shareLink
    })
  } catch (error) {
    logger.error('Failed to create share link:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create share link'
    })
  }
})

/**
 * Access shared project
 */
router.get('/links/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { password } = req.query
    
    const result = await SharingService.accessSharedProject(
      token,
      password as string
    )
    
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Failed to access shared project:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to access shared project'
    })
  }
})

/**
 * Update share link
 */
router.put('/links/:linkId', authenticateToken, async (req, res) => {
  try {
    const { linkId } = req.params
    const { permissions, expiresAt, password, allowDownload } = req.body
    const userId = req.user!.id
    
    const shareLink = await SharingService.updateShareLink(linkId, userId, {
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      password,
      allowDownload
    })
    
    res.json({
      success: true,
      data: shareLink
    })
  } catch (error) {
    logger.error('Failed to update share link:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update share link'
    })
  }
})

/**
 * Revoke share link
 */
router.delete('/links/:linkId', authenticateToken, async (req, res) => {
  try {
    const { linkId } = req.params
    const userId = req.user!.id
    
    await SharingService.revokeShareLink(linkId, userId)
    
    res.json({
      success: true,
      message: 'Share link revoked successfully'
    })
  } catch (error) {
    logger.error('Failed to revoke share link:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke share link'
    })
  }
})

/**
 * Get project share links
 */
router.get('/projects/:projectId/links', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user!.id
    
    const shareLinks = await SharingService.getProjectShareLinks(projectId, userId)
    
    res.json({
      success: true,
      data: shareLinks
    })
  } catch (error) {
    logger.error('Failed to get share links:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get share links'
    })
  }
})

/**
 * Invite collaborator
 */
router.post('/projects/:projectId/collaborators/invite', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { email, permissions } = req.body
    const userId = req.user!.id
    
    if (!email || !permissions) {
      return res.status(400).json({
        success: false,
        error: 'Email and permissions are required'
      })
    }
    
    if (!['read', 'comment', 'edit'].includes(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permissions. Must be read, comment, or edit'
      })
    }
    
    const invite = await SharingService.inviteCollaborator(
      projectId,
      userId,
      email,
      permissions
    )
    
    res.json({
      success: true,
      data: invite
    })
  } catch (error) {
    logger.error('Failed to invite collaborator:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invite collaborator'
    })
  }
})

/**
 * Accept collaboration invitation
 */
router.post('/invitations/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params
    const userId = req.user!.id
    
    await SharingService.acceptInvitation(token, userId)
    
    res.json({
      success: true,
      message: 'Invitation accepted successfully'
    })
  } catch (error) {
    logger.error('Failed to accept invitation:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept invitation'
    })
  }
})

/**
 * Get project collaborators
 */
router.get('/projects/:projectId/collaborators', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user!.id
    
    const collaborators = await SharingService.getProjectCollaborators(projectId, userId)
    
    res.json({
      success: true,
      data: collaborators
    })
  } catch (error) {
    logger.error('Failed to get collaborators:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get collaborators'
    })
  }
})

/**
 * Remove collaborator
 */
router.delete('/projects/:projectId/collaborators/:collaboratorId', authenticateToken, async (req, res) => {
  try {
    const { projectId, collaboratorId } = req.params
    const userId = req.user!.id
    
    await SharingService.removeCollaborator(projectId, collaboratorId, userId)
    
    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    })
  } catch (error) {
    logger.error('Failed to remove collaborator:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove collaborator'
    })
  }
})

/**
 * Add comment to project
 */
router.post('/projects/:projectId/comments', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { content, parentCommentId } = req.body
    const userId = req.user!.id
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required'
      })
    }
    
    const comment = await SharingService.addComment(
      projectId,
      userId,
      content.trim(),
      parentCommentId
    )
    
    res.json({
      success: true,
      data: comment
    })
  } catch (error) {
    logger.error('Failed to add comment:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add comment'
    })
  }
})

/**
 * Get project comments
 */
router.get('/projects/:projectId/comments', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user!.id
    
    const comments = await SharingService.getProjectComments(projectId, userId)
    
    res.json({
      success: true,
      data: comments
    })
  } catch (error) {
    logger.error('Failed to get comments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get comments'
    })
  }
})

export default router