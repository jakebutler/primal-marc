import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { z } from 'zod'
import { authenticateToken } from '../middleware/auth.js'
import { MediaService, MediaServiceConfig } from '../services/media/media-service.js'
import { MediaRequest } from '../services/media/types.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Initialize media service
const mediaConfig: MediaServiceConfig = {
  storage: {
    basePath: path.join(process.cwd(), 'storage', 'media'),
    maxFileSize: 5 * 1024 * 1024, // 5MB
    compressionQuality: 80
  },
  apis: {
    pexelsApiKey: process.env.PEXELS_API_KEY,
    pixabayApiKey: process.env.PIXABAY_API_KEY
  },
  limits: {
    maxDataPoints: 100,
    maxImagesPerRequest: 5,
    maxMemesPerRequest: 3
  }
}

const mediaService = new MediaService(mediaConfig)

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'storage', 'temp'),
  limits: {
    fileSize: mediaConfig.storage.maxFileSize,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'))
    }
  }
})

// Request validation schemas
const MediaRequestSchema = z.object({
  type: z.enum(['image', 'meme', 'chart']),
  content: z.string().min(1).max(10000),
  context: z.string().max(5000).optional(),
  options: z.object({
    imageQuery: z.string().optional(),
    imageStyle: z.enum(['photo', 'illustration', 'vector']).optional(),
    imageOrientation: z.enum(['landscape', 'portrait', 'square']).optional(),
    memeTemplate: z.string().optional(),
    topText: z.string().optional(),
    bottomText: z.string().optional(),
    chartType: z.enum(['bar', 'line', 'pie', 'scatter', 'area']).optional(),
    chartTitle: z.string().optional(),
    chartData: z.object({
      labels: z.array(z.string()),
      datasets: z.array(z.object({
        label: z.string(),
        data: z.array(z.number()),
        backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
        borderColor: z.union([z.string(), z.array(z.string())]).optional(),
        borderWidth: z.number().optional()
      }))
    }).optional()
  }).optional()
})

const ImageSearchSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().min(1).max(20).default(10),
  style: z.enum(['photo', 'illustration', 'vector']).optional(),
  orientation: z.enum(['landscape', 'portrait', 'square']).optional()
})

const MemeGenerationSchema = z.object({
  templateId: z.string(),
  texts: z.array(z.string()).max(4),
  topText: z.string().optional(),
  bottomText: z.string().optional()
})

const ChartGenerationSchema = z.object({
  type: z.enum(['bar', 'line', 'pie', 'doughnut', 'scatter', 'area']),
  data: z.object({
    labels: z.array(z.string()),
    datasets: z.array(z.object({
      label: z.string(),
      data: z.array(z.number()),
      backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
      borderColor: z.union([z.string(), z.array(z.string())]).optional(),
      borderWidth: z.number().optional()
    }))
  }),
  options: z.object({
    title: z.string().optional(),
    width: z.number().min(100).max(2000).optional(),
    height: z.number().min(100).max(2000).optional(),
    backgroundColor: z.string().optional(),
    responsive: z.boolean().optional(),
    legend: z.boolean().optional(),
    gridLines: z.boolean().optional(),
    animations: z.boolean().optional()
  }).optional()
})

// POST /api/media/generate - Generate media content
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const validatedData = MediaRequestSchema.parse(req.body)
    
    const mediaRequest: MediaRequest = {
      type: validatedData.type,
      content: validatedData.content,
      context: validatedData.context,
      options: validatedData.options
    }

    const results = await mediaService.processMediaRequest(mediaRequest)

    res.json({
      success: true,
      data: results,
      metadata: {
        requestType: validatedData.type,
        resultCount: results.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Media generation failed:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      })
    }

    res.status(500).json({
      success: false,
      error: 'Media generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// GET /api/media/images/search - Search for images
router.get('/images/search', authenticateToken, async (req, res) => {
  try {
    const validatedQuery = ImageSearchSchema.parse(req.query)
    
    const mediaRequest: MediaRequest = {
      type: 'image',
      content: validatedQuery.query,
      options: {
        imageQuery: validatedQuery.query,
        imageStyle: validatedQuery.style,
        imageOrientation: validatedQuery.orientation
      }
    }

    const results = await mediaService.processMediaRequest(mediaRequest)

    res.json({
      success: true,
      data: results.slice(0, validatedQuery.limit),
      metadata: {
        query: validatedQuery.query,
        resultCount: results.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Image search failed:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search parameters',
        details: error.errors
      })
    }

    res.status(500).json({
      success: false,
      error: 'Image search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// GET /api/media/memes/templates - Get available meme templates
router.get('/memes/templates', authenticateToken, async (req, res) => {
  try {
    // This would be implemented by accessing the meme service directly
    // For now, return a basic response
    const templates = [
      {
        id: 'drake',
        name: 'Drake Pointing',
        description: 'Drake disapproving/approving meme',
        imageUrl: 'https://i.imgflip.com/30b1gx.jpg',
        popularity: 95
      },
      {
        id: 'distracted_boyfriend',
        name: 'Distracted Boyfriend',
        description: 'Man looking at another woman while girlfriend looks disapproving',
        imageUrl: 'https://i.imgflip.com/1ur9b0.jpg',
        popularity: 90
      },
      {
        id: 'two_buttons',
        name: 'Two Buttons',
        description: 'Person sweating over two button choices',
        imageUrl: 'https://i.imgflip.com/1g8my4.jpg',
        popularity: 85
      }
    ]

    res.json({
      success: true,
      data: templates,
      metadata: {
        templateCount: templates.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Failed to get meme templates:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get meme templates',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// POST /api/media/memes/generate - Generate a meme
router.post('/memes/generate', authenticateToken, async (req, res) => {
  try {
    const validatedData = MemeGenerationSchema.parse(req.body)
    
    const mediaRequest: MediaRequest = {
      type: 'meme',
      content: validatedData.texts.join(' '),
      options: {
        memeTemplate: validatedData.templateId,
        topText: validatedData.topText,
        bottomText: validatedData.bottomText
      }
    }

    const results = await mediaService.processMediaRequest(mediaRequest)

    res.json({
      success: true,
      data: results[0] || null,
      metadata: {
        templateId: validatedData.templateId,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Meme generation failed:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid meme generation data',
        details: error.errors
      })
    }

    res.status(500).json({
      success: false,
      error: 'Meme generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// POST /api/media/charts/generate - Generate a chart
router.post('/charts/generate', authenticateToken, async (req, res) => {
  try {
    const validatedData = ChartGenerationSchema.parse(req.body)
    
    const mediaRequest: MediaRequest = {
      type: 'chart',
      content: validatedData.data.labels.join(' '),
      options: {
        chartType: validatedData.type,
        chartData: validatedData.data,
        chartTitle: validatedData.options?.title,
        ...validatedData.options
      }
    }

    const results = await mediaService.processMediaRequest(mediaRequest)

    res.json({
      success: true,
      data: results[0] || null,
      metadata: {
        chartType: validatedData.type,
        dataPoints: validatedData.data.datasets.reduce((sum, dataset) => sum + dataset.data.length, 0),
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Chart generation failed:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chart generation data',
        details: error.errors
      })
    }

    res.status(500).json({
      success: false,
      error: 'Chart generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// POST /api/media/upload - Upload and optimize media files
router.post('/upload', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[]
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      })
    }

    const results = []

    for (const file of files) {
      try {
        // Process and optimize the uploaded file
        const optimizedPath = path.join(
          mediaConfig.storage.basePath, 
          'uploads', 
          `optimized_${Date.now()}_${file.originalname}`
        )

        // Ensure upload directory exists
        await fs.mkdir(path.dirname(optimizedPath), { recursive: true })

        // For now, just move the file (in production, would optimize with Sharp)
        await fs.rename(file.path, optimizedPath)

        results.push({
          originalName: file.originalname,
          optimizedPath: optimizedPath,
          size: file.size,
          mimetype: file.mimetype,
          url: `/media/uploads/${path.basename(optimizedPath)}`
        })
      } catch (fileError) {
        logger.error(`Failed to process file ${file.originalname}:`, fileError)
        
        // Clean up temp file
        try {
          await fs.unlink(file.path)
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file:', cleanupError)
        }
      }
    }

    res.json({
      success: true,
      data: results,
      metadata: {
        uploadedCount: results.length,
        totalFiles: files.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('File upload failed:', error)
    res.status(500).json({
      success: false,
      error: 'File upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// GET /api/media/health - Get media service health status
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const healthStatus = await mediaService.getHealthStatus()
    res.json({
      success: true,
      data: healthStatus
    })
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// GET /api/media/stats - Get media service usage statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await mediaService.getUsageStats()
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Failed to get stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Static file serving for generated media
router.use('/files', express.static(path.join(process.cwd(), 'storage', 'media')))

export default router