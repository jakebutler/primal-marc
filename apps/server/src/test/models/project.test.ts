import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ProjectModel } from '../../models/project.js'
import { setupTestDatabase, cleanupTestDatabase, clearTestData, createTestUser, testPrisma } from '../database-setup.js'

describe('ProjectModel', () => {
  let testUser: any

  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    await clearTestData()
    testUser = await createTestUser()
  })

  describe('create', () => {
    it('should create a new project with default metadata', async () => {
      const projectData = {
        userId: testUser.id,
        title: 'My First Project',
        content: 'This is the initial content.',
      }

      const project = await ProjectModel.create(projectData)

      expect(project).toBeDefined()
      expect(project.title).toBe('My First Project')
      expect(project.content).toBe('This is the initial content.')
      expect(project.status).toBe('DRAFT')
      expect(project.userId).toBe(testUser.id)
      expect(project.metadata).toBeDefined()

      const metadata = ProjectModel.getProjectMetadata(project)
      expect(metadata.wordCount).toBe(0) // Default
      expect(metadata.estimatedReadTime).toBe(0)
      expect(metadata.tags).toEqual([])
    })

    it('should create project with custom metadata', async () => {
      const projectData = {
        userId: testUser.id,
        title: 'Custom Project',
        metadata: {
          tags: ['fiction', 'novel'],
          targetAudience: 'young adults',
        },
      }

      const project = await ProjectModel.create(projectData)
      const metadata = ProjectModel.getProjectMetadata(project)

      expect(metadata.tags).toEqual(['fiction', 'novel'])
      expect(metadata.targetAudience).toBe('young adults')
    })

    it('should initialize project phases', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
      })

      const phases = await testPrisma.projectPhase.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'asc' },
      })

      expect(phases).toHaveLength(4)
      expect(phases[0].type).toBe('IDEATION')
      expect(phases[0].status).toBe('ACTIVE')
      expect(phases[1].type).toBe('REFINEMENT')
      expect(phases[1].status).toBe('PENDING')
      expect(phases[2].type).toBe('MEDIA')
      expect(phases[2].status).toBe('PENDING')
      expect(phases[3].type).toBe('FACTCHECK')
      expect(phases[3].status).toBe('PENDING')
    })

    it('should set current phase to ideation', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
      })

      const updatedProject = await testPrisma.project.findUnique({
        where: { id: project.id },
        include: { phases: true },
      })

      expect(updatedProject?.currentPhaseId).toBeDefined()
      
      const currentPhase = updatedProject?.phases.find(p => p.id === updatedProject.currentPhaseId)
      expect(currentPhase?.type).toBe('IDEATION')
    })
  })

  describe('findById', () => {
    it('should find project by ID with relations', async () => {
      const createdProject = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
        content: 'Test content',
      })

      const foundProject = await ProjectModel.findById(createdProject.id)

      expect(foundProject).toBeDefined()
      expect(foundProject?.id).toBe(createdProject.id)
      expect(foundProject?.title).toBe('Test Project')
      expect(foundProject?.user).toBeDefined()
      expect(foundProject?.phases).toBeDefined()
      expect(foundProject?.phases).toHaveLength(4)
    })

    it('should filter by userId when provided', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' })
      
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
      })

      // Should find project when correct userId provided
      const foundProject = await ProjectModel.findById(project.id, testUser.id)
      expect(foundProject).toBeDefined()

      // Should not find project when wrong userId provided
      const notFoundProject = await ProjectModel.findById(project.id, otherUser.id)
      expect(notFoundProject).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should find projects by user ID', async () => {
      await ProjectModel.create({
        userId: testUser.id,
        title: 'Project 1',
      })

      await ProjectModel.create({
        userId: testUser.id,
        title: 'Project 2',
      })

      const projects = await ProjectModel.findByUserId(testUser.id)

      expect(projects).toHaveLength(2)
      expect(projects[0].title).toBe('Project 2') // Most recent first
      expect(projects[1].title).toBe('Project 1')
    })

    it('should filter by status', async () => {
      await ProjectModel.create({
        userId: testUser.id,
        title: 'Draft Project',
      })

      const completedProject = await ProjectModel.create({
        userId: testUser.id,
        title: 'Completed Project',
      })

      await ProjectModel.updateStatus(completedProject.id, 'COMPLETED')

      const draftProjects = await ProjectModel.findByUserId(testUser.id, { status: 'DRAFT' })
      const completedProjects = await ProjectModel.findByUserId(testUser.id, { status: 'COMPLETED' })

      expect(draftProjects).toHaveLength(1)
      expect(draftProjects[0].title).toBe('Draft Project')
      expect(completedProjects).toHaveLength(1)
      expect(completedProjects[0].title).toBe('Completed Project')
    })

    it('should respect limit and offset', async () => {
      // Create 5 projects
      for (let i = 1; i <= 5; i++) {
        await ProjectModel.create({
          userId: testUser.id,
          title: `Project ${i}`,
        })
      }

      const firstPage = await ProjectModel.findByUserId(testUser.id, { limit: 2, offset: 0 })
      const secondPage = await ProjectModel.findByUserId(testUser.id, { limit: 2, offset: 2 })

      expect(firstPage).toHaveLength(2)
      expect(secondPage).toHaveLength(2)
      expect(firstPage[0].id).not.toBe(secondPage[0].id)
    })
  })

  describe('updateContent', () => {
    it('should update project content and calculate word count', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
        content: 'Initial content',
      })

      const newContent = 'This is a much longer piece of content with many more words to test the word counting functionality.'
      
      const updatedProject = await ProjectModel.updateContent(project.id, {
        content: newContent,
      })

      expect(updatedProject.content).toBe(newContent)
      
      const metadata = ProjectModel.getProjectMetadata(updatedProject)
      expect(metadata.wordCount).toBe(18) // Word count should be calculated
      expect(metadata.estimatedReadTime).toBe(1) // Should be 1 minute (18 words / 200 wpm, rounded up)
    })

    it('should update title without affecting content', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Original Title',
        content: 'Original content',
      })

      const updatedProject = await ProjectModel.updateContent(project.id, {
        title: 'New Title',
      })

      expect(updatedProject.title).toBe('New Title')
      expect(updatedProject.content).toBe('Original content')
    })

    it('should merge metadata updates', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
        metadata: {
          tags: ['original'],
          targetAudience: 'developers',
        },
      })

      await ProjectModel.updateContent(project.id, {
        metadata: {
          tags: ['updated', 'new'],
        },
      })

      const updatedProject = await testPrisma.project.findUnique({ where: { id: project.id } })
      const metadata = ProjectModel.getProjectMetadata(updatedProject!)

      expect(metadata.tags).toEqual(['updated', 'new'])
      expect(metadata.targetAudience).toBe('developers') // Should be preserved
    })
  })

  describe('moveToNextPhase', () => {
    it('should move from ideation to refinement', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
      })

      const nextPhase = await ProjectModel.moveToNextPhase(project.id)

      expect(nextPhase).toBeDefined()
      expect(nextPhase?.type).toBe('REFINEMENT')
      expect(nextPhase?.status).toBe('ACTIVE')

      // Check that ideation phase is completed
      const ideationPhase = await testPrisma.projectPhase.findFirst({
        where: { projectId: project.id, type: 'IDEATION' },
      })
      expect(ideationPhase?.status).toBe('COMPLETED')
      expect(ideationPhase?.completedAt).toBeDefined()

      // Check that project status is updated
      const updatedProject = await testPrisma.project.findUnique({ where: { id: project.id } })
      expect(updatedProject?.status).toBe('IN_PROGRESS')
      expect(updatedProject?.currentPhaseId).toBe(nextPhase?.id)
    })

    it('should complete project after final phase', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
      })

      // Move through all phases
      await ProjectModel.moveToNextPhase(project.id) // IDEATION -> REFINEMENT
      await ProjectModel.moveToNextPhase(project.id) // REFINEMENT -> MEDIA
      await ProjectModel.moveToNextPhase(project.id) // MEDIA -> FACTCHECK
      const finalResult = await ProjectModel.moveToNextPhase(project.id) // FACTCHECK -> COMPLETED

      expect(finalResult).toBeNull() // No more phases

      const completedProject = await testPrisma.project.findUnique({ where: { id: project.id } })
      expect(completedProject?.status).toBe('COMPLETED')
    })
  })

  describe('search', () => {
    it('should search projects by title', async () => {
      await ProjectModel.create({
        userId: testUser.id,
        title: 'JavaScript Tutorial',
        content: 'Learn JavaScript basics',
      })

      await ProjectModel.create({
        userId: testUser.id,
        title: 'Python Guide',
        content: 'Python programming guide',
      })

      const results = await ProjectModel.search(testUser.id, 'JavaScript')

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('JavaScript Tutorial')
    })

    it('should search projects by content', async () => {
      await ProjectModel.create({
        userId: testUser.id,
        title: 'Tutorial',
        content: 'Learn React hooks and state management',
      })

      await ProjectModel.create({
        userId: testUser.id,
        title: 'Guide',
        content: 'Vue.js component patterns',
      })

      const results = await ProjectModel.search(testUser.id, 'React')

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Tutorial')
    })

    it('should only return projects for the specified user', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' })

      await ProjectModel.create({
        userId: testUser.id,
        title: 'My JavaScript Project',
      })

      await ProjectModel.create({
        userId: otherUser.id,
        title: 'Other JavaScript Project',
      })

      const results = await ProjectModel.search(testUser.id, 'JavaScript')

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('My JavaScript Project')
    })
  })

  describe('getProjectMetadata', () => {
    it('should return default metadata for project without metadata', async () => {
      const project = { metadata: null }
      const metadata = ProjectModel.getProjectMetadata(project)

      expect(metadata).toEqual({
        wordCount: 0,
        estimatedReadTime: 0,
        tags: [],
        targetAudience: '',
      })
    })

    it('should parse and merge with defaults', async () => {
      const project = {
        metadata: JSON.stringify({
          wordCount: 500,
          tags: ['fiction'],
          customField: 'value',
        }),
      }

      const metadata = ProjectModel.getProjectMetadata(project)

      expect(metadata.wordCount).toBe(500)
      expect(metadata.tags).toEqual(['fiction'])
      expect(metadata.estimatedReadTime).toBe(0) // Default
      expect((metadata as any).customField).toBe('value') // Custom field preserved
    })

    it('should handle invalid JSON gracefully', async () => {
      const project = { metadata: 'invalid json' }
      const metadata = ProjectModel.getProjectMetadata(project)

      expect(metadata.wordCount).toBe(0)
      expect(metadata.tags).toEqual([])
    })
  })

  describe('delete', () => {
    it('should delete project and cascade to related data', async () => {
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
      })

      // Create related conversation
      await testPrisma.conversation.create({
        data: {
          projectId: project.id,
          agentType: 'IDEATION',
        },
      })

      await ProjectModel.delete(project.id)

      // Verify project is deleted
      const deletedProject = await testPrisma.project.findUnique({ where: { id: project.id } })
      expect(deletedProject).toBeNull()

      // Verify related data is also deleted (cascade)
      const conversations = await testPrisma.conversation.findMany({ where: { projectId: project.id } })
      expect(conversations).toHaveLength(0)

      const phases = await testPrisma.projectPhase.findMany({ where: { projectId: project.id } })
      expect(phases).toHaveLength(0)
    })

    it('should filter by userId when provided', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' })
      
      const project = await ProjectModel.create({
        userId: testUser.id,
        title: 'Test Project',
      })

      // Should not delete project when wrong userId provided
      await expect(ProjectModel.delete(project.id, otherUser.id)).rejects.toThrow()

      // Project should still exist
      const existingProject = await testPrisma.project.findUnique({ where: { id: project.id } })
      expect(existingProject).toBeDefined()
    })
  })
})