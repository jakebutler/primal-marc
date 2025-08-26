import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BackupService } from '../../services/backup-service.js'
import { ProjectModel } from '../../models/project.js'
import { prisma } from '../../services/database.js'
import fs from 'fs/promises'
import { createHash } from 'crypto'

// Mock dependencies
vi.mock('../../models/project.js')
vi.mock('../../services/database.js', () => ({
  prisma: {
    backup: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn()
    },
    project: {
      upsert: vi.fn(),
      findMany: vi.fn()
    },
    projectPhase: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    conversation: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    message: {
      create: vi.fn()
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    projectFolder: {
      findMany: vi.fn()
    },
    projectTag: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('fs/promises')
vi.mock('crypto')

const mockProject = {
  id: 'test-project-id',
  title: 'Test Project',
  content: '# Test Content',
  status: 'DRAFT',
  metadata: JSON.stringify({
    wordCount: 10,
    estimatedReadTime: 1,
    tags: ['test']
  }),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  phases: [
    {
      id: 'phase-1',
      type: 'IDEATION',
      status: 'COMPLETED',
      outputs: null,
      completedAt: new Date('2024-01-01')
    }
  ],
  conversations: [
    {
      id: 'conv-1',
      agentType: 'IDEATION',
      context: null,
      messages: [
        {
          id: 'msg-1',
          role: 'USER',
          content: 'Hello',
          agentType: null,
          metadata: null,
          timestamp: new Date('2024-01-01')
        }
      ]
    }
  ]
}

const mockBackupInfo = {
  id: 'backup-1',
  userId: 'user-1',
  projectId: 'test-project-id',
  type: 'project',
  fileName: 'project_test-project-id_2024-01-01.json',
  size: 1024,
  checksum: 'abc123',
  metadata: JSON.stringify({ projectTitle: 'Test Project' }),
  createdAt: new Date('2024-01-01')
}

describe('BackupService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}')
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any)
    vi.mocked(fs.unlink).mockResolvedValue(undefined)
    vi.mocked(createHash).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('abc123')
    } as any)
    
    vi.mocked(ProjectModel.findById).mockResolvedValue(mockProject)
    vi.mocked(ProjectModel.getProjectMetadata).mockReturnValue({
      wordCount: 10,
      estimatedReadTime: 1,
      tags: ['test']
    })
    vi.mocked(ProjectModel.updateContent).mockResolvedValue(mockProject as any)
    
    vi.mocked(prisma.backup.create).mockResolvedValue(mockBackupInfo as any)
    vi.mocked(prisma.backup.findFirst).mockResolvedValue(mockBackupInfo as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialize', () => {
    it('should create backup directory', async () => {
      await BackupService.initialize()
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        { recursive: true }
      )
    })
  })

  describe('backupProject', () => {
    it('should create project backup', async () => {
      const result = await BackupService.backupProject('test-project-id', 'user-1')

      expect(result).toEqual(mockBackupInfo)
      expect(fs.writeFile).toHaveBeenCalled()
      expect(prisma.backup.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          projectId: 'test-project-id',
          type: 'project'
        })
      })
    })

    it('should include conversations when requested', async () => {
      await BackupService.backupProject('test-project-id', 'user-1', {
        includeConversations: true
      })

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const backupData = JSON.parse(writeCall[1] as string)
      
      expect(backupData.conversations).toBeDefined()
      expect(backupData.conversations).toHaveLength(1)
    })

    it('should exclude conversations by default', async () => {
      await BackupService.backupProject('test-project-id', 'user-1')

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const backupData = JSON.parse(writeCall[1] as string)
      
      expect(backupData.conversations).toBeUndefined()
    })

    it('should update project metadata with backup timestamp', async () => {
      await BackupService.backupProject('test-project-id', 'user-1')

      expect(ProjectModel.updateContent).toHaveBeenCalledWith(
        'test-project-id',
        expect.objectContaining({
          metadata: expect.objectContaining({
            lastBackup: expect.any(String)
          })
        })
      )
    })

    it('should throw error for non-existent project', async () => {
      vi.mocked(ProjectModel.findById).mockResolvedValue(null)

      await expect(
        BackupService.backupProject('invalid-id', 'user-1')
      ).rejects.toThrow('Project not found')
    })
  })

  describe('backupUserData', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      bio: null,
      preferences: null,
      writingGenres: null,
      experienceLevel: 'BEGINNER',
      createdAt: new Date('2024-01-01')
    }

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.project.findMany).mockResolvedValue([mockProject] as any)
      vi.mocked(prisma.projectFolder.findMany).mockResolvedValue([])
      vi.mocked(prisma.projectTag.findMany).mockResolvedValue([])
    })

    it('should create user data backup', async () => {
      // Update mock to return user backup type
      vi.mocked(prisma.backup.create).mockResolvedValue({
        ...mockBackupInfo,
        type: 'user'
      } as any)
      
      const result = await BackupService.backupUserData('user-1')

      expect(result.type).toBe('user')
      expect(fs.writeFile).toHaveBeenCalled()
      
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const backupData = JSON.parse(writeCall[1] as string)
      
      expect(backupData.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName
      })
      expect(backupData.projects).toHaveLength(1)
    })

    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(
        BackupService.backupUserData('invalid-user')
      ).rejects.toThrow('User not found')
    })
  })

  describe('restoreProject', () => {
    const mockBackupData = {
      project: {
        id: 'test-project-id',
        title: 'Test Project',
        content: '# Test Content',
        status: 'DRAFT',
        metadata: JSON.stringify({ wordCount: 10 })
      },
      phases: [
        {
          type: 'IDEATION',
          status: 'COMPLETED',
          outputs: null,
          completedAt: '2024-01-01T00:00:00.000Z'
        }
      ],
      conversations: [
        {
          agentType: 'IDEATION',
          context: null,
          messages: [
            {
              role: 'USER',
              content: 'Hello',
              agentType: null,
              metadata: null,
              timestamp: '2024-01-01T00:00:00.000Z'
            }
          ]
        }
      ]
    }

    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockBackupData))
      vi.mocked(prisma.project.upsert).mockResolvedValue({
        id: 'restored-project-id'
      } as any)
      vi.mocked(prisma.projectPhase.create).mockResolvedValue({} as any)
      vi.mocked(prisma.conversation.create).mockResolvedValue({
        id: 'restored-conv-id'
      } as any)
      vi.mocked(prisma.message.create).mockResolvedValue({} as any)
    })

    it('should restore project from backup', async () => {
      const projectId = await BackupService.restoreProject('backup-1', 'user-1')

      expect(projectId).toBe('restored-project-id')
      expect(prisma.project.upsert).toHaveBeenCalled()
      expect(prisma.projectPhase.create).toHaveBeenCalled()
    })

    it('should restore conversations when included', async () => {
      await BackupService.restoreProject('backup-1', 'user-1')

      expect(prisma.conversation.create).toHaveBeenCalled()
      expect(prisma.message.create).toHaveBeenCalled()
    })

    it('should verify checksum', async () => {
      vi.mocked(createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('different-checksum')
      } as any)

      await expect(
        BackupService.restoreProject('backup-1', 'user-1')
      ).rejects.toThrow('Backup file corrupted')
    })

    it('should throw error for non-existent backup', async () => {
      vi.mocked(prisma.backup.findFirst).mockResolvedValue(null)

      await expect(
        BackupService.restoreProject('invalid-backup', 'user-1')
      ).rejects.toThrow('Backup not found')
    })
  })

  describe('getUserBackups', () => {
    it('should return user backups', async () => {
      vi.mocked(prisma.backup.findMany).mockResolvedValue([mockBackupInfo] as any)

      const backups = await BackupService.getUserBackups('user-1')

      expect(backups).toEqual([mockBackupInfo])
      expect(prisma.backup.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' }
      })
    })
  })

  describe('deleteBackup', () => {
    it('should delete backup file and database record', async () => {
      await BackupService.deleteBackup('backup-1', 'user-1')

      expect(fs.unlink).toHaveBeenCalled()
      expect(prisma.backup.delete).toHaveBeenCalledWith({
        where: { id: 'backup-1' }
      })
    })

    it('should throw error for non-existent backup', async () => {
      vi.mocked(prisma.backup.findFirst).mockResolvedValue(null)

      await expect(
        BackupService.deleteBackup('invalid-backup', 'user-1')
      ).rejects.toThrow('Backup not found')
    })
  })

  describe('autoBackupProjects', () => {
    beforeEach(() => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 7)
      
      vi.mocked(prisma.project.findMany).mockResolvedValue([
        {
          id: 'project-1',
          userId: 'user-1',
          metadata: JSON.stringify({ lastBackup: null })
        }
      ] as any)
    })

    it('should backup projects that need backing up', async () => {
      const backupProjectSpy = vi.spyOn(BackupService, 'backupProject')
        .mockResolvedValue(mockBackupInfo)

      await BackupService.autoBackupProjects()

      expect(backupProjectSpy).toHaveBeenCalledWith(
        'project-1',
        'user-1',
        { includeConversations: false }
      )
    })
  })
})