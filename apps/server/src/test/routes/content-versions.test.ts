import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.js'
import { UserModel } from '../../models/user.js'
import { ContentVersioningService } from '../../services/content-versioning.js'
import contentVersionRoutes from '../../routes/content-versions.js'

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

const app = express()
app.use(express.json())
app.use('/api/projects', contentVersionRoutes)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-content-versions-routes.db'
    }
  }
})

describe('Content Versions API', () => {
  let testUser: any
  let authToken: string
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
    
    // Generate auth token
    const tokens = await AuthService.generateTokens(testUser.id, testUser.email)
    authToken = tokens.accessToken
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
        content: 'Test content',
        status: 'DRAFT'
      }
    })
  })

  afterEach(async () => {
    // Clean up after each test
    await prisma.$executeRaw`DELETE FROM content_versions`
    await prisma.project.deleteMany()
  })

  describe('POST /api/projects/:id/auto-save', () => {
    it('should schedule auto-save', async () => {
      const saveData = {
        content: 'Auto-save content',
        title: 'Auto-save Title',
        metadata: JSON.stringify({ tags: ['autosave'] })
      }

      const response = await request(app)
        .post(`/api/projects/${testProject.id}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Auto-save scheduled')
      expect(response.body.data.hasPendingAutoSave).toBe(true)
      expect(response.body.data.pendingChanges).toBeDefined()
      expect(response.body.data.pendingChanges.content).toBe('Auto-save content')
    })

    it('should validate request data', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Valid content' }) // Missing title
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid request data')
    })

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/projects/${testProject.id}/auto-save`)
        .send({ content: 'Test', title: 'Test' })
        .expect(401)
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/non-existent-id/auto-save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Test', title: 'Test' })
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Project not found')
    })
  })

  describe('POST /api/projects/:id/force-save', () => {
    it('should force immediate save', async () => {
      // First schedule an auto-save
      await request(app)
        .post(`/api/projects/${testProject.id}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Force save content',
          title: 'Force Save Title'
        })

      const response = await request(app)
        .post(`/api/projects/${testProject.id}/force-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Project saved successfully')

      // Verify project was updated
      const updatedProject = await prisma.project.findUnique({
        where: { id: testProject.id }
      })
      expect(updatedProject!.content).toBe('Force save content')
      expect(updatedProject!.title).toBe('Force Save Title')
    })

    it('should work even without pending auto-save', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/force-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Project saved successfully')
    })
  })

  describe('POST /api/projects/:id/create-version', () => {
    it('should create manual version', async () => {
      const versionData = {
        content: 'Manual version content',
        title: 'Manual Version Title',
        metadata: JSON.stringify({ tags: ['manual'] })
      }

      const response = await request(app)
        .post(`/api/projects/${testProject.id}/create-version`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(versionData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Version created successfully')
      expect(response.body.data.content).toBe('Manual version content')
      expect(response.body.data.title).toBe('Manual Version Title')
      expect(response.body.data.isAutoSave).toBe(false)
      expect(response.body.data.version).toBe(1)
    })
  })

  describe('GET /api/projects/:id/versions', () => {
    beforeEach(async () => {
      // Create multiple versions
      for (let i = 1; i <= 5; i++) {
        await ContentVersioningService.createVersion({
          projectId: testProject.id,
          content: `Version ${i} content`,
          title: `Version ${i} Title`,
          isAutoSave: i % 2 === 0
        })
      }
    })

    it('should get project versions', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.versions).toHaveLength(5)
      expect(response.body.data.versions[0].version).toBe(5) // Latest first
      expect(response.body.data.versions[4].version).toBe(1)
      expect(response.body.data.total).toBe(5)
    })

    it('should limit results', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/versions?limit=3`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.versions).toHaveLength(3)
      expect(response.body.data.versions[0].version).toBe(5)
      expect(response.body.data.versions[2].version).toBe(3)
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

      const response = await request(app)
        .get(`/api/projects/${otherProject.id}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.versions).toHaveLength(0)
    })
  })

  describe('GET /api/projects/:id/versions/:version', () => {
    beforeEach(async () => {
      await ContentVersioningService.createVersion({
        projectId: testProject.id,
        content: 'Specific version content',
        title: 'Specific Version Title',
        metadata: JSON.stringify({ tags: ['specific'] })
      })
    })

    it('should get specific version', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/versions/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.version).toBe(1)
      expect(response.body.data.content).toBe('Specific version content')
      expect(response.body.data.title).toBe('Specific Version Title')
    })

    it('should return 404 for non-existent version', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/versions/999`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Version not found')
    })

    it('should validate version number', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/versions/invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid version number')
    })
  })

  describe('POST /api/projects/:id/restore', () => {
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
          title: 'Modified Title'
        }
      })
    })

    it('should restore to specific version', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/restore`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ version: 1 })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Project restored to version 1')

      // Verify project was restored
      const restoredProject = await prisma.project.findUnique({
        where: { id: testProject.id }
      })
      expect(restoredProject!.content).toBe('Original content')
      expect(restoredProject!.title).toBe('Original Title')
    })

    it('should validate version number', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/restore`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ version: 'invalid' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid request data')
    })

    it('should return error for non-existent version', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/restore`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ version: 999 })
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Failed to restore project version')
    })
  })

  describe('DELETE /api/projects/:id/auto-save', () => {
    it('should cancel auto-save', async () => {
      // First schedule an auto-save
      await request(app)
        .post(`/api/projects/${testProject.id}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Auto-save content',
          title: 'Auto-save Title'
        })

      const response = await request(app)
        .delete(`/api/projects/${testProject.id}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Auto-save cancelled')
    })

    it('should work even without pending auto-save', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject.id}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Auto-save cancelled')
    })
  })
})