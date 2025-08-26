import { Router } from 'express'
import { WorkflowService } from '../services/workflow-service.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Apply authentication middleware to all routes
router.use(authenticateToken)

/**
 * GET /api/workflow/:projectId/state
 * Get current workflow state for a project
 */
router.get('/:projectId/state', async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const result = await WorkflowService.getWorkflowState(projectId, userId)
    
    if (!result.success) {
      return res.status(404).json(result)
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to get workflow state:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * POST /api/workflow/:projectId/transition
 * Transition to a specific phase
 */
router.post('/:projectId/transition', async (req, res) => {
  try {
    const { projectId } = req.params
    const { toPhase, skipValidation = false } = req.body
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    if (!toPhase) {
      return res.status(400).json({
        success: false,
        error: 'toPhase is required'
      })
    }

    // Get current phase first
    const currentState = await WorkflowService.getWorkflowState(projectId, userId)
    if (!currentState.success || !currentState.data) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or no current phase'
      })
    }

    const result = await WorkflowService.transitionToPhase({
      projectId,
      userId,
      fromPhase: currentState.data.currentPhase.type,
      toPhase,
      skipValidation
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to transition phase:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * POST /api/workflow/:projectId/next
 * Move to the next phase in sequence
 */
router.post('/:projectId/next', async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const result = await WorkflowService.moveToNextPhase(projectId, userId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to move to next phase:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * POST /api/workflow/:projectId/previous
 * Move to the previous phase
 */
router.post('/:projectId/previous', async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const result = await WorkflowService.moveToPreviousPhase(projectId, userId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to move to previous phase:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * POST /api/workflow/:projectId/skip
 * Skip to a specific phase
 */
router.post('/:projectId/skip', async (req, res) => {
  try {
    const { projectId } = req.params
    const { targetPhase } = req.body
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    if (!targetPhase) {
      return res.status(400).json({
        success: false,
        error: 'targetPhase is required'
      })
    }

    const result = await WorkflowService.skipToPhase(projectId, targetPhase, userId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to skip to phase:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * POST /api/workflow/:projectId/complete
 * Mark current phase as completed and move to next
 */
router.post('/:projectId/complete', async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const result = await WorkflowService.completeCurrentPhase(projectId, userId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to complete current phase:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * GET /api/workflow/:projectId/progress
 * Get phase progress information
 */
router.get('/:projectId/progress', async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const result = await WorkflowService.getPhaseProgress(projectId, userId)

    if (!result.success) {
      return res.status(404).json(result)
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to get phase progress:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

export default router