import express from 'express'
import { BackupService } from '../services/backup-service.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Initialize backup service
BackupService.initialize().catch(error => {
  logger.error('Failed to initialize backup service:', error)
})

/**
 * Create project backup
 */
router.post('/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { includeConversations = false, includeMetadata = true } = req.body
    const userId = req.user!.id
    
    const backup = await BackupService.backupProject(projectId, userId, {
      includeConversations,
      includeMetadata
    })
    
    res.json({
      success: true,
      data: backup
    })
  } catch (error) {
    logger.error('Project backup failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Project backup failed'
    })
  }
})

/**
 * Create user data backup
 */
router.post('/user', authenticateToken, async (req, res) => {
  try {
    const { includeConversations = false } = req.body
    const userId = req.user!.id
    
    const backup = await BackupService.backupUserData(userId, {
      includeConversations
    })
    
    res.json({
      success: true,
      data: backup
    })
  } catch (error) {
    logger.error('User backup failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'User backup failed'
    })
  }
})

/**
 * Restore project from backup
 */
router.post('/restore/:backupId', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params
    const { overwrite = false, preserveIds = false } = req.body
    const userId = req.user!.id
    
    const projectId = await BackupService.restoreProject(backupId, userId, {
      overwrite,
      preserveIds
    })
    
    res.json({
      success: true,
      data: { projectId },
      message: 'Project restored successfully'
    })
  } catch (error) {
    logger.error('Project restore failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Project restore failed'
    })
  }
})

/**
 * Get user backups
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const backups = await BackupService.getUserBackups(userId)
    
    res.json({
      success: true,
      data: backups
    })
  } catch (error) {
    logger.error('Failed to get backups:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get backups'
    })
  }
})

/**
 * Delete backup
 */
router.delete('/:backupId', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params
    const userId = req.user!.id
    
    await BackupService.deleteBackup(backupId, userId)
    
    res.json({
      success: true,
      message: 'Backup deleted successfully'
    })
  } catch (error) {
    logger.error('Failed to delete backup:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete backup'
    })
  }
})

export default router