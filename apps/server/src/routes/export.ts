import express from 'express'
import { ExportService } from '../services/export-service.js'
import { authenticateToken } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Initialize export service
ExportService.initialize().catch(error => {
  logger.error('Failed to initialize export service:', error)
})

/**
 * Export project in specified format
 */
router.post('/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const { format, includeMetadata, includeConversations, customStyles } = req.body
    const userId = req.user!.id
    
    if (!['pdf', 'html', 'markdown'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid export format. Supported formats: pdf, html, markdown'
      })
    }
    
    const result = await ExportService.exportProject(projectId, userId, {
      format,
      includeMetadata,
      includeConversations,
      customStyles
    })
    
    if (!result.success) {
      return res.status(400).json(result)
    }
    
    res.json({
      success: true,
      fileName: result.fileName,
      downloadUrl: `/api/export/download/${result.fileName}`
    })
  } catch (error) {
    logger.error('Export failed:', error)
    res.status(500).json({
      success: false,
      error: 'Export failed'
    })
  }
})

/**
 * Download exported file
 */
router.get('/download/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params
    
    // Basic security check - only allow files with expected patterns
    if (!/^[a-zA-Z0-9_-]+\.(pdf|html|md)$/.test(fileName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name'
      })
    }
    
    const fileBuffer = await ExportService.getExportFile(fileName)
    if (!fileBuffer) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      })
    }
    
    // Set appropriate headers
    const extension = fileName.split('.').pop()
    const mimeTypes = {
      pdf: 'application/pdf',
      html: 'text/html',
      md: 'text/markdown'
    }
    
    res.setHeader('Content-Type', mimeTypes[extension as keyof typeof mimeTypes] || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(fileBuffer)
  } catch (error) {
    logger.error('Download failed:', error)
    res.status(500).json({
      success: false,
      error: 'Download failed'
    })
  }
})

export default router