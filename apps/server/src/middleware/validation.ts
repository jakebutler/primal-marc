import { Request, Response, NextFunction } from 'express'
import { z, ZodSchema, ZodError } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import { logger } from '../utils/logger.js'

/**
 * Middleware factory for request validation using Zod schemas
 */
export const validateRequest = (schema: {
  body?: ZodSchema
  params?: ZodSchema
  query?: ZodSchema
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body)
      }

      // Validate request params
      if (schema.params) {
        req.params = schema.params.parse(req.params)
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query)
      }

      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))

        logger.warn('Request validation failed:', {
          url: req.url,
          method: req.method,
          errors: validationErrors,
          ip: req.ip
        })

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        })
        return
      }

      logger.error('Validation middleware error:', error)
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      })
    }
  }
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (content: string): string => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a'],
    ALLOWED_ATTR: ['href', 'title', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_SCRIPT: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover']
  })
}

/**
 * Middleware to sanitize request body content
 */
export const sanitizeContent = (fields: string[] = ['content', 'body', 'description', 'title']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body && typeof req.body === 'object') {
        for (const field of fields) {
          if (req.body[field] && typeof req.body[field] === 'string') {
            req.body[field] = sanitizeHtml(req.body[field])
          }
        }
      }
      next()
    } catch (error) {
      logger.error('Content sanitization error:', error)
      res.status(500).json({
        success: false,
        error: 'Content sanitization failed',
        code: 'SANITIZATION_ERROR'
      })
    }
  }
}

/**
 * Validate file uploads
 */
export const validateFileUpload = (options: {
  maxSize?: number // in bytes
  allowedTypes?: string[]
  maxFiles?: number
}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFiles = 1
  } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const files = req.files as Express.Multer.File[] | undefined

      if (!files || files.length === 0) {
        next()
        return
      }

      if (files.length > maxFiles) {
        res.status(400).json({
          success: false,
          error: `Maximum ${maxFiles} files allowed`,
          code: 'TOO_MANY_FILES'
        })
        return
      }

      for (const file of files) {
        // Check file size
        if (file.size > maxSize) {
          res.status(400).json({
            success: false,
            error: `File size exceeds ${maxSize / 1024 / 1024}MB limit`,
            code: 'FILE_TOO_LARGE'
          })
          return
        }

        // Check file type
        if (!allowedTypes.includes(file.mimetype)) {
          res.status(400).json({
            success: false,
            error: `File type ${file.mimetype} not allowed`,
            code: 'INVALID_FILE_TYPE',
            allowedTypes
          })
          return
        }

        // Additional security checks
        if (file.originalname.includes('..') || file.originalname.includes('/')) {
          res.status(400).json({
            success: false,
            error: 'Invalid filename',
            code: 'INVALID_FILENAME'
          })
          return
        }
      }

      next()
    } catch (error) {
      logger.error('File validation error:', error)
      res.status(500).json({
        success: false,
        error: 'File validation failed',
        code: 'FILE_VALIDATION_ERROR'
      })
    }
  }
}

/**
 * Enhanced validation schemas with security considerations
 */
export const secureValidationSchemas = {
  // User input validation
  userRegistration: z.object({
    email: z.string()
      .email('Invalid email format')
      .max(254, 'Email too long')
      .toLowerCase()
      .trim(),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
        'Password must contain uppercase, lowercase, number and special character'),
    firstName: z.string()
      .min(1, 'First name required')
      .max(50, 'First name too long')
      .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters in first name')
      .trim(),
    lastName: z.string()
      .min(1, 'Last name required')
      .max(50, 'Last name too long')
      .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters in last name')
      .trim()
  }),

  // Content validation
  projectContent: z.object({
    title: z.string()
      .min(1, 'Title required')
      .max(200, 'Title too long')
      .trim(),
    content: z.string()
      .max(100000, 'Content too long') // 100KB limit
      .optional()
      .default(''),
    tags: z.array(z.string().max(50).trim())
      .max(10, 'Too many tags')
      .optional()
      .default([])
  }),

  // Agent interaction validation
  agentRequest: z.object({
    message: z.string()
      .min(1, 'Message required')
      .max(5000, 'Message too long')
      .trim(),
    context: z.object({
      projectId: z.string().cuid('Invalid project ID'),
      phase: z.enum(['ideation', 'refinement', 'media', 'factcheck'])
    })
  }),

  // Search validation
  searchQuery: z.object({
    query: z.string()
      .min(1, 'Search query required')
      .max(200, 'Search query too long')
      .trim(),
    limit: z.number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10),
    offset: z.number()
      .int()
      .min(0)
      .optional()
      .default(0)
  }),

  // ID parameter validation
  idParam: z.object({
    id: z.string().cuid('Invalid ID format')
  })
}