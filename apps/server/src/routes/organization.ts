import express from 'express'
import { ProjectOrganizationService } from '../services/project-organization.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

/**
 * Create folder
 */
router.post('/folders', authenticateToken, async (req, res) => {
  try {
    const { name, parentId } = req.body
    const userId = req.user!.id
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required'
      })
    }
    
    const folder = await ProjectOrganizationService.createFolder({
      name: name.trim(),
      userId,
      parentId
    })
    
    res.json({
      success: true,
      data: folder
    })
  } catch (error) {
    logger.error('Failed to create folder:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create folder'
    })
  }
})

/**
 * Get folder hierarchy
 */
router.get('/folders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const folders = await ProjectOrganizationService.getFolderHierarchy(userId)
    
    res.json({
      success: true,
      data: folders
    })
  } catch (error) {
    logger.error('Failed to get folders:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get folders'
    })
  }
})

/**
 * Move project to folder
 */
router.put('/projects/:projectId/folder', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { folderId } = req.body
    const userId = req.user!.id
    
    await ProjectOrganizationService.moveProjectToFolder(
      projectId,
      folderId || null,
      userId
    )
    
    res.json({
      success: true,
      message: 'Project moved successfully'
    })
  } catch (error) {
    logger.error('Failed to move project:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to move project'
    })
  }
})

/**
 * Delete folder
 */
router.delete('/folders/:folderId', authenticateToken, async (req, res) => {
  try {
    const { folderId } = req.params
    const { moveProjectsToFolderId } = req.body
    const userId = req.user!.id
    
    await ProjectOrganizationService.deleteFolder(
      folderId,
      userId,
      moveProjectsToFolderId
    )
    
    res.json({
      success: true,
      message: 'Folder deleted successfully'
    })
  } catch (error) {
    logger.error('Failed to delete folder:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete folder'
    })
  }
})

/**
 * Add tags to project
 */
router.post('/projects/:projectId/tags', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { tags } = req.body
    const userId = req.user!.id
    
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags array is required'
      })
    }
    
    await ProjectOrganizationService.addTagsToProject(projectId, tags, userId)
    
    res.json({
      success: true,
      message: 'Tags added successfully'
    })
  } catch (error) {
    logger.error('Failed to add tags:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add tags'
    })
  }
})

/**
 * Remove tags from project
 */
router.delete('/projects/:projectId/tags', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { tags } = req.body
    const userId = req.user!.id
    
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags array is required'
      })
    }
    
    await ProjectOrganizationService.removeTagsFromProject(projectId, tags, userId)
    
    res.json({
      success: true,
      message: 'Tags removed successfully'
    })
  } catch (error) {
    logger.error('Failed to remove tags:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove tags'
    })
  }
})

/**
 * Get user tags
 */
router.get('/tags', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const tags = await ProjectOrganizationService.getUserTags(userId)
    
    res.json({
      success: true,
      data: tags
    })
  } catch (error) {
    logger.error('Failed to get tags:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get tags'
    })
  }
})

/**
 * Get projects by tag
 */
router.get('/tags/:tagName/projects', authenticateToken, async (req, res) => {
  try {
    const { tagName } = req.params
    const { limit = 20, offset = 0 } = req.query
    const userId = req.user!.id
    
    const projects = await ProjectOrganizationService.getProjectsByTag(
      userId,
      tagName,
      parseInt(limit as string),
      parseInt(offset as string)
    )
    
    res.json({
      success: true,
      data: projects
    })
  } catch (error) {
    logger.error('Failed to get projects by tag:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get projects by tag'
    })
  }
})

/**
 * Get organization statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const stats = await ProjectOrganizationService.getOrganizationStats(userId)
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Failed to get organization stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get organization stats'
    })
  }
})

export default router