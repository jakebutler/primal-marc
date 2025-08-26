import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { ContentVersioningService, AutoSaveManager } from '../../services/content-versioning.js'
import { UserModel } from '../../models/user.js'

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-content-versioning.db'
    }
  }
})

describe('ContentVersioningService', () => {
  let testUser: any
  let testProject: any

  beforeAll(async () => {
    // Initialize test database
    await prisma.$executeRaw`PRAGMA foreign_keys = ON`
    
    // Initialize versioning table
    await ContentVersioningService.initializeVersioningTable()
    
    // Create test user
    testUser = await UserModel.create({
      email: 'test@example.com',
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'User'
    })
  })

  afterAll(async () => {
    // Clean up test database
    await prisma.$executeRaw`DROP TABLE IF EXISTS content_versions`
    await prisma.project.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Create a test project for each test
    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        title: 'Test Project',
        content: 'Initial content',
        status: 'DRAFT'
      }
    })
  })

  afterEach(async () => {
    // Clean up after each test
    await prisma.$executeRaw`DELETE FROM content_versions`
    await prisma.project.deleteMany()
  })

  describe('createVersion', () => {
    it('should create a new content version', async () => {
      const versionData = {
        projectId: testProject.id,
        content: 'Version 1 content',
        title: 'Version 1 Title',
        metadata: JSON.stringify({ tags: ['v1'] }),
        isAutoSave: false
      }

      const version = await ContentVersioningService.createVersion(versionData)

      expect(version.id).toBeDefined()
      expect(version.projectId).toBe(testProject.id)
      expect(version.content).toBe('Version 1 content')
      expect(version.title).toBe('Version 1 Title')
      expect(version.version).toBe(1)
      expect(version.isAutoSave).toBe(false)
    })

    it('should increment version numbers', async () => {
      // Create first version
      await ContentVersioningService.createVersion({
        projectId: testProject.id,
        content: 'Version 1',
        title: 'Title 1'
      })

      // Create second version
      const version2 = await ContentVersioningService.createVersion({
        projectId: testProject.id,
        content: 'Version 2',
        title: 'Title 2'
      })

      expect(version2.version).toBe(2)
    })

    it('should handle auto-save versions', async () => {
      const version = await ContentVersioningService.createVersion({
        projectId: testProject.id,
        content: 'Auto-saved content',
        title: 'Auto-saved Title',
        isAutoSave: true
      })

      expect(version.isAutoSave).toBe(true)
    })
  })

  describe('getVersions', () => {
    beforeEach(async () => {
      // Create multiple versions
      for (let i = 1; i <= 5; i++) {
        await ContentVersioningService.createVersion({
          projectId: testProject.id,
          content: `Version ${i} content`,
          title: `Version ${i} Title`,
          isAutoSave: i % 2 === 0 // Even versions are auto-saves
        })
      }
    })

    it('should get all versions for a project', async () => {
      const versions = await ContentVersioningService.getVersions(testProject.id)

      expect(versions).toHaveLength(5)
      expect(versions[0].version).toBe(5) // Should be ordered by version DESC
      expect(versions[4].version).toBe(1)
    })

    it('should limit results', async () => {
      const versions = await ContentVersioningService.getVersions(testProject.id, 3)

      expect(versions).toHaveLength(3)
      expect(versions[0].version).toBe(5)
      expect(versions[2].version).toBe(3)
    })

    it('should return empty array for project with no versions', async () => {
      const otherProject = await prisma.project.create({
        data: {
          userId: testUser.id,
          title: 'Other Project',
          content: 'Other content',
          status: 'DRAFT'
        }
      })

      const versions = await ContentVersioningService.getVersions(otherProject.id)
      expect(versions).toHaveLength(0)
    })
  })

  describe('getVersion', () => {
    beforeEach(async () => {
      await ContentVersioningService.createVersion({
        projectId: testProject.id,
        content: 'Specific version content',
        title: 'Specific Version Title',
        metadata: JSON.stringify({ tags: ['specific'] })
      })
    })

    it('should get specific version', async () => {
      const version = await ContentVersioningService.getVersion(testProject.id, 1)

      expect(version).toBeDefined()
      expect(version!.version).toBe(1)
      expect(version!.content).toBe('Specific version content')
      expect(version!.title).toBe('Specific Version Title')
    })

    it('should return null for non-existent version', async () => {
      const version = await ContentVersioningService.getVersion(testProject.id, 999)
      expect(version).toBeNull()
    })
  })

  describe('restoreVersion', () => {
    beforeEach(async () => {
      // Create initial version
      await ContentVersioningService.createVersion({
        projectId: testProject.id,
        content: 'Original content',
        title: 'Original Title',
        metadata: JSON.stringify({ tags: ['original'] })
      })

      // Update project
      await prisma.project.update({
        where: { id: testProject.id },
        data: {
          content: 'Modified content',
          title: 'Modified Title',
          metadata: JSON.stringify({ tags: ['modified'] })
        }
      })
    })

    it('should restore project to specific version', async () => {
      await ContentVersioningService.restoreVersion(testProject.id, 1)

      const restoredProject = await prisma.project.findUnique({
        where: { id: testProject.id }
      })

      expect(restoredProject!.content).toBe('Original content')
      expect(restoredProject!.title).toBe('Original Title')
      expect(restoredProject!.metadata).toBe(JSON.stringify({ tags: ['original'] }))
    })

    it('should create new version after restore', async () => {
      await ContentVersioningService.restoreVersion(testProject.id, 1)

      const versions = await ContentVersioningService.getVersions(testProject.id)
      expect(versions).toHaveLength(2) // Original + restore version
    })

    it('should throw error for non-existent version', async () => {
      await expect(
        ContentVersioningService.restoreVersion(testProject.id, 999)
      ).rejects.toThrow('Version not found')
    })
  })
})

describe('AutoSaveManager', () => {
  let testUser: any
  let testProject: any

  beforeAll(async () => {
    // Initialize test database
    await prisma.$executeRaw`PRAGMA foreign_keys = ON`
    
    // Initialize versioning table
    await ContentVersioningService.initializeVersioningTable()
    
    // Create test user
    testUser = await UserModel.create({
      email: 'autosave@example.com',
      password: 'testpassword123',
      firstName: 'AutoSave',
      lastName: 'User'
    })
  })

  afterAll(async () => {
    // Clean up test database
    await prisma.$executeRaw`DROP TABLE IF EXISTS content_versions`
    await prisma.project.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Create a test project for each test
    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        title: 'AutoSave Test Project',
        content: 'Initial content',
        status: 'DRAFT'
      }
    })
  })

  afterEach(async () => {
    // Clean up after each test
    AutoSaveManager.cancelAutoSave(testProject.id)
    await prisma.$executeRaw`DELETE FROM content_versions`
    await prisma.project.deleteMany()
  })

  describe('scheduleAutoSave', () => {
    it('should schedule auto-save', () => {
      const saveData = {
        content: 'Auto-save content',
        title: 'Auto-save Title',
        metadata: JSON.stringify({ tags: ['autosave'] })
      }

      AutoSaveManager.scheduleAutoSave(testProject.id, saveData)

      expect(AutoSaveManager.hasPendingAutoSave(testProject.id)).toBe(true)
      
      const pendingChanges = AutoSaveManager.getPendingChanges(testProject.id)
      expect(pendingChanges).toBeDefined()
      expect(pendingChanges!.content).toBe('Auto-save content')
      expect(pendingChanges!.title).toBe('Auto-save Title')
    })

    it('should replace existing scheduled save', () => {
      // Schedule first save
      AutoSaveManager.scheduleAutoSave(testProject.id, {
        content: 'First content',
        title: 'First Title'
      })

      // Schedule second save (should replace first)
      AutoSaveManager.scheduleAutoSave(testProject.id, {
        content: 'Second content',
        title: 'Second Title'
      })

      const pendingChanges = AutoSaveManager.getPendingChanges(testProject.id)
      expect(pendingChanges!.content).toBe('Second content')
      expect(pendingChanges!.title).toBe('Second Title')
    })
  })

  describe('forceSave', () => {
    it('should force immediate save', async () => {
      const saveData = {
        content: 'Force save content',
        title: 'Force Save Title'
      }

      AutoSaveManager.scheduleAutoSave(testProject.id, saveData)
      await AutoSaveManager.forceSave(testProject.id)

      // Check that project was updated
      const updatedProject = await prisma.project.findUnique({
        where: { id: testProject.id }
      })

      expect(updatedProject!.content).toBe('Force save content')
      expect(updatedProject!.title).toBe('Force Save Title')

      // Check that version was created
      const versions = await ContentVersioningService.getVersions(testProject.id)
      expect(versions).toHaveLength(1)
      expect(versions[0].isAutoSave).toBe(true)
    })
  })

  describe('cancelAutoSave', () => {
    it('should cancel scheduled auto-save', () => {
      AutoSaveManager.scheduleAutoSave(testProject.id, {
        content: 'Cancel test',
        title: 'Cancel Title'
      })

      expect(AutoSaveManager.hasPendingAutoSave(testProject.id)).toBe(true)

      AutoSaveManager.cancelAutoSave(testProject.id)

      expect(AutoSaveManager.hasPendingAutoSave(testProject.id)).toBe(false)
      expect(AutoSaveManager.getPendingChanges(testProject.id)).toBeUndefined()
    })
  })

  describe('getPendingChanges', () => {
    it('should return pending changes', () => {
      const saveData = {
        content: 'Pending content',
        title: 'Pending Title',
        metadata: JSON.stringify({ tags: ['pending'] })
      }

      AutoSaveManager.scheduleAutoSave(testProject.id, saveData)

      const pendingChanges = AutoSaveManager.getPendingChanges(testProject.id)
      expect(pendingChanges).toBeDefined()
      expect(pendingChanges!.content).toBe('Pending content')
      expect(pendingChanges!.title).toBe('Pending Title')
      expect(pendingChanges!.lastChange).toBeTypeOf('number')
    })

    it('should return undefined for no pending changes', () => {
      const pendingChanges = AutoSaveManager.getPendingChanges(testProject.id)
      expect(pendingChanges).toBeUndefined()
    })
  })

  describe('hasPendingAutoSave', () => {
    it('should return true when auto-save is scheduled', () => {
      AutoSaveManager.scheduleAutoSave(testProject.id, {
        content: 'Test',
        title: 'Test'
      })

      expect(AutoSaveManager.hasPendingAutoSave(testProject.id)).toBe(true)
    })

    it('should return false when no auto-save is scheduled', () => {
      expect(AutoSaveManager.hasPendingAutoSave(testProject.id)).toBe(false)
    })
  })
})