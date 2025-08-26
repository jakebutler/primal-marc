import express from 'express'
import { SearchService } from '../services/search-service.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

/**
 * Search projects
 */
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const {
      q: query = '',
      status,
      tags,
      folderId,
      phase,
      dateStart,
      dateEnd,
      sortBy = 'relevance',
      sortOrder = 'desc',
      limit = 20,
      offset = 0
    } = req.query
    
    // Parse filters
    const filters: any = {}
    
    if (status) {
      filters.status = Array.isArray(status) ? status : [status]
    }
    
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : [tags]
    }
    
    if (folderId) {
      filters.folderId = folderId as string
    }
    
    if (phase) {
      filters.phase = Array.isArray(phase) ? phase : [phase]
    }
    
    if (dateStart || dateEnd) {
      filters.dateRange = {}
      if (dateStart) filters.dateRange.start = new Date(dateStart as string)
      if (dateEnd) filters.dateRange.end = new Date(dateEnd as string)
    }
    
    const results = await SearchService.searchProjects({
      query: query as string,
      userId,
      filters,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    })
    
    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('Search failed:', error)
    res.status(500).json({
      success: false,
      error: 'Search failed'
    })
  }
})

/**
 * Search conversations
 */
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const { q: query = '', limit = 10 } = req.query
    
    if (!query || (query as string).trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      })
    }
    
    const results = await SearchService.searchConversations(
      userId,
      query as string,
      parseInt(limit as string)
    )
    
    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('Conversation search failed:', error)
    res.status(500).json({
      success: false,
      error: 'Conversation search failed'
    })
  }
})

/**
 * Get search suggestions
 */
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id
    const { q: query = '', limit = 5 } = req.query
    
    if (!query || (query as string).trim().length < 2) {
      return res.json({
        success: true,
        data: []
      })
    }
    
    const suggestions = await SearchService.getSearchSuggestions(
      userId,
      query as string,
      parseInt(limit as string)
    )
    
    res.json({
      success: true,
      data: suggestions
    })
  } catch (error) {
    logger.error('Failed to get search suggestions:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions'
    })
  }
})

export default router