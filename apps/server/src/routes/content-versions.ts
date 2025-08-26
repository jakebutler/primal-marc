import express from 'express'
import { z } from 'zod'
import { ContentVersioningService, AutoSaveManager } from '../services/content-versioning.js'
import { ProjectModel } from '../models/project.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Validation schemas
const autoSaveSchema = z.object({
  content: z.string(),
  title: z.string().min(1).max(200),
  metadata: z.string().optional(),
})

const restoreVersionSchema = z.object({
  version: z.number().int().positive(),
})

// POST /api/projects/:id/auto-save - Schedule auto-save
router.post('/:id/auto-save', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    const data = autoSaveSchema.parse(req.body)
    
    // Verify project ownership
    const project = await ProjectModel.findById(projectId, userId)
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    // Schedule auto-save
    AutoSaveManager.scheduleAutoSave(projectId, {
      content: data.content,
      title: data.title,
      metadata: data.metadata,
    })
    
    res.json({
      success: true,
      message: 'Auto-save scheduled',
      data: {
        hasPendingAutoSave: AutoSaveManager.hasPendingAutoSave(projectId),
        pendingChanges: AutoSaveManager.getPendingChanges(projectId),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }
    
    logger.error('Failed to schedule auto-save:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to schedule auto-save',
    })
  }
})

// POST /api/projects/:id/force-save - Force immediate save
router.post('/:id/force-save', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    
    // Verify project ownership
    const project = await ProjectModel.findById(projectId, userId)
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    // Force save
    await AutoSaveManager.forceSave(projectId)
    
    res.json({
      success: true,
      message: 'Project saved successfully',
    })
  } catch (error) {
    logger.error('Failed to force save:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to save project',
    })
  }
})

// GET /api/projects/:id/versions - Get project versions
router.get('/:id/versions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
    
    // Verify project ownership
    const project = await ProjectModel.findById(projectId, userId)
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    const versions = await ContentVersioningService.getVersions(projectId, limit)
    
    res.json({
      success: true,
      data: {
        versions,
        total: versions.length,
      },
    })
  } catch (error) {
    logger.error('Failed to get project versions:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve project versions',
    })
  }
})

// GET /api/projects/:id/versions/:version - Get specific version
router.get('/:id/versions/:version', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    const version = parseInt(req.params.version)
    
    if (isNaN(version) || version < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid version number',
      })
    }
    
    // Verify project ownership
    const project = await ProjectModel.findById(projectId, userId)
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    const versionData = await ContentVersioningService.getVersion(projectId, version)
    
    if (!versionData) {
      return res.status(404).json({
        success: false,
        error: 'Version not found',
      })
    }
    
    res.json({
      success: true,
      data: versionData,
    })
  } catch (error) {
    logger.error('Failed to get project version:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve project version',
    })
  }
})

// POST /api/projects/:id/restore - Restore to specific version
router.post('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    const { version } = restoreVersionSchema.parse(req.body)
    
    // Verify project ownership
    const project = await ProjectModel.findById(projectId, userId)
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    await ContentVersioningService.restoreVersion(projectId, version)
    
    // Cancel any pending auto-saves
    AutoSaveManager.cancelAutoSave(projectId)
    
    res.json({
      success: true,
      message: `Project restored to version ${version}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }
    
    logger.error('Failed to restore project version:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to restore project version',
    })
  }
})

// POST /api/projects/:id/create-version - Manually create a version
router.post('/:id/create-version', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    const data = autoSaveSchema.parse(req.body)
    
    // Verify project ownership
    const project = await ProjectModel.findById(projectId, userId)
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    const version = await ContentVersioningService.createVersion({
      projectId,
      content: data.content,
      title: data.title,
      metadata: data.metadata,
      isAutoSave: false,
    })
    
    res.status(201).json({
      success: true,
      data: version,
      message: 'Version created successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }
    
    logger.error('Failed to create version:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create version',
    })
  }
})

// DELETE /api/projects/:id/auto-save - Cancel auto-save
router.delete('/:id/auto-save', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const projectId = req.params.id
    
    // Verify project ownership
    const project = await ProjectModel.findById(projectId, userId)
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }
    
    AutoSaveManager.cancelAutoSave(projectId)
    
    res.json({
      success: true,
      message: 'Auto-save cancelled',
    })
  } catch (error) {
    logger.error('Failed to cancel auto-save:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel auto-save',
    })
  }
})

export default router