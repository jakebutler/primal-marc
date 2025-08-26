import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExportService } from '../../services/export-service.js'
import { ProjectModel } from '../../models/project.js'
import fs from 'fs/promises'
import path from 'path'

// Mock dependencies
vi.mock('../../models/project.js')
vi.mock('fs/promises')
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(() => ({
      newPage: vi.fn(() => ({
        goto: vi.fn(),
        pdf: vi.fn()
      })),
      close: vi.fn()
    }))
  }
}))

const mockProject = {
  id: 'test-project-id',
  title: 'Test Project',
  content: '# Test Content\n\nThis is a test project.',
  status: 'DRAFT',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  conversations: [
    {
      agentType: 'IDEATION',
      messages: [
        { role: 'USER', content: 'Hello' },
        { role: 'AGENT', content: 'Hi there!' }
      ]
    }
  ]
}

const mockMetadata = {
  wordCount: 10,
  estimatedReadTime: 1,
  tags: ['test', 'example'],
  targetAudience: 'developers'
}

describe('ExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('test content'))
    vi.mocked(ProjectModel.findById).mockResolvedValue(mockProject)
    vi.mocked(ProjectModel.getProjectMetadata).mockReturnValue(mockMetadata)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialize', () => {
    it('should create export directory', async () => {
      await ExportService.initialize()
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('exports'),
        { recursive: true }
      )
    })
  })

  describe('exportProject', () => {
    it('should export project as markdown', async () => {
      const result = await ExportService.exportProject('test-project-id', 'user-id', {
        format: 'markdown',
        includeMetadata: true,
        includeConversations: false
      })

      expect(result.success).toBe(true)
      expect(result.fileName).toMatch(/\.md$/)
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it('should export project as HTML', async () => {
      const result = await ExportService.exportProject('test-project-id', 'user-id', {
        format: 'html',
        includeMetadata: true,
        includeConversations: true
      })

      expect(result.success).toBe(true)
      expect(result.fileName).toMatch(/\.html$/)
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it('should include metadata when requested', async () => {
      await ExportService.exportProject('test-project-id', 'user-id', {
        format: 'markdown',
        includeMetadata: true
      })

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const content = writeCall[1] as string
      
      expect(content).toContain('word_count: 10')
      expect(content).toContain('tags: [test, example]')
    })

    it('should include conversations when requested', async () => {
      await ExportService.exportProject('test-project-id', 'user-id', {
        format: 'markdown',
        includeConversations: true
      })

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const content = writeCall[1] as string
      
      expect(content).toContain('AI Conversations')
      expect(content).toContain('Ideation Assistant Session')
    })

    it('should return error for non-existent project', async () => {
      vi.mocked(ProjectModel.findById).mockResolvedValue(null)

      const result = await ExportService.exportProject('invalid-id', 'user-id', {
        format: 'markdown'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })

    it('should return error for unsupported format', async () => {
      const result = await ExportService.exportProject('test-project-id', 'user-id', {
        format: 'xml' as any
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unsupported export format')
    })
  })

  describe('getExportFile', () => {
    it('should return file buffer', async () => {
      const buffer = await ExportService.getExportFile('test.md')
      
      expect(buffer).toBeInstanceOf(Buffer)
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test.md')
      )
    })

    it('should return null for non-existent file', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

      const buffer = await ExportService.getExportFile('nonexistent.md')
      
      expect(buffer).toBeNull()
    })
  })

  describe('cleanupOldExports', () => {
    it('should remove old export files', async () => {
      const oldDate = new Date()
      oldDate.setHours(oldDate.getHours() - 25) // 25 hours ago

      vi.mocked(fs.readdir).mockResolvedValue(['old-file.pdf', 'new-file.pdf'] as any)
      vi.mocked(fs.stat).mockImplementation((filePath) => {
        const fileName = path.basename(filePath as string)
        return Promise.resolve({
          mtime: fileName === 'old-file.pdf' ? oldDate : new Date()
        } as any)
      })
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      await ExportService.cleanupOldExports(24)

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-file.pdf')
      )
      expect(fs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining('new-file.pdf')
      )
    })
  })
})