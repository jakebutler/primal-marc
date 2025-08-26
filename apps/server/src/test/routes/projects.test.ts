import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.js'
import { UserModel } from '../../models/user.js'
import projectRoutes from '../../routes/projects.js'
import { authenticateToken } from '../../middleware/auth.js'

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

const app = express()
app.use(express.json())
app.use('/api/projects', projectRoutes)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-projects.db'
    }
  }
})

describe('Projects API', () => {
  let testUser: any
  let authToken: string
  let testProject: any

  beforeAll(async () => {
    // Initialize test database with schema
    await prisma.$executeRaw`PRAGMA foreign_keys = ON`
    
    // Drop existing tables if they exist
    await prisma.$executeRaw`DROP TABLE IF EXISTS sessions`
    await prisma.$executeRaw`DROP TABLE IF EXISTS project_phases`
    await prisma.$executeRaw`DROP TABLE IF EXISTS projects`
    await prisma.$executeRaw`DROP TABLE IF EXISTS users`
    
    // Create tables manually for testing
    await prisma.$executeRaw`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        firstName TEXT,
        lastName TEXT,
        bio TEXT,
        preferences TEXT,
        writingGenres TEXT,
        experienceLevel TEXT DEFAULT 'BEGINNER',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    await prisma.$executeRaw`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT DEFAULT '',
        status TEXT DEFAULT 'DRAFT',
        metadata TEXT,
        currentPhaseId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
      )
    `
    
    await prisma.$executeRaw`
      CREATE TABLE project_phases (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        outputs TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        completedAt DATETIME,
        FOREIGN KEY (projectId) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE(projectId, type)
      )
    `
    
    await prisma.$executeRaw`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        refreshToken TEXT UNIQUE NOT NULL,
        expiresAt DATETIME NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastUsedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
      )
    `
    
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
        status: 'DRAFT',
        metadata: JSON.stringify({
          wordCount: 2,
          estimatedReadTime: 1,
          tags: ['test'],
          targetAudience: 'developers'
        })
      }
    })
  })

  afterEach(async () => {
    // Clean up projects after each test
    await prisma.project.deleteMany()
  })

  describe('GET /api/projects', () => {
    it('should get user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.projects).toHaveLength(1)
      expect(response.body.data.projects[0].title).toBe('Test Project')
      expect(response.body.data.projects[0].metadata.tags).toEqual(['test'])
    })

    it('should filter projects by status', async () => {
      // Create another project with different status
      await prisma.project.create({
        data: {
          userId: testUser.id,
          title: 'Completed Project',
          content: 'Completed content',
          status: 'COMPLETED'
        }
      })

      const response = await request(app)
        .get('/api/projects?status=COMPLETED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.projects).toHaveLength(1)
      expect(response.body.data.projects[0].title).toBe('Completed Project')
    })

    it('should search projects by title', async () => {
      const response = await request(app)
        .get('/api/projects?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.projects).toHaveLength(1)
      expect(response.body.data.projects[0].title).toBe('Test Project')
    })

    it('should filter projects by tags', async () => {
      const response = await request(app)
        .get('/api/projects?tags=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.projects).toHaveLength(1)
      expect(response.body.data.projects[0].title).toBe('Test Project')
    })

    it('should paginate results', async () => {
      // Create multiple projects
      for (let i = 0; i < 5; i++) {
        await prisma.project.create({
          data: {
            userId: testUser.id,
            title: `Project ${i}`,
            content: `Content ${i}`,
            status: 'DRAFT'
          }
        })
      }

      const response = await request(app)
        .get('/api/projects?limit=3&offset=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.projects).toHaveLength(3)
      expect(response.body.data.pagination.limit).toBe(3)
      expect(response.body.data.pagination.offset).toBe(2)
    })

    it('should require authentication', async () => {
      await request(app)
        .get('/api/projects')
        .expect(401)
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should get specific project', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testProject.id)
      expect(response.body.data.title).toBe('Test Project')
      expect(response.body.data.metadata.tags).toEqual(['test'])
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Project not found')
    })

    it('should not allow access to other users projects', async () => {
      // Create another user and project
      const otherUser = await UserModel.create({
        email: 'other@example.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User'
      })

      const otherProject = await prisma.project.create({
        data: {
          userId: otherUser.id,
          title: 'Other Project',
          content: 'Other content',
          status: 'DRAFT'
        }
      })

      const response = await request(app)
        .get(`/api/projects/${otherProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Project not found')

      // Clean up
      await prisma.project.delete({ where: { id: otherProject.id } })
      await prisma.user.delete({ where: { id: otherUser.id } })
    })
  })

  describe('POST /api/projects', () => {
    it('should create new project', async () => {
      const projectData = {
        title: 'New Project',
        content: 'New project content',
        metadata: {
          tags: ['new', 'test'],
          targetAudience: 'writers'
        }
      }

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('New Project')
      expect(response.body.data.content).toBe('New project content')
      expect(response.body.data.metadata.tags).toEqual(['new', 'test'])
      expect(response.body.data.metadata.wordCount).toBe(3) // "New project content"
    })

    it('should create project with minimal data', async () => {
      const projectData = {
        title: 'Minimal Project'
      }

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('Minimal Project')
      expect(response.body.data.content).toBe('')
      expect(response.body.data.metadata.wordCount).toBe(0)
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid request data')
    })

    it('should validate title length', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: '' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid request data')
    })
  })

  describe('PUT /api/projects/:id', () => {
    it('should update project', async () => {
      const updateData = {
        title: 'Updated Project',
        content: 'Updated content with more words',
        metadata: {
          tags: ['updated'],
          targetAudience: 'everyone'
        }
      }

      const response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('Updated Project')
      expect(response.body.data.content).toBe('Updated content with more words')
      expect(response.body.data.metadata.tags).toEqual(['updated'])
      expect(response.body.data.metadata.wordCount).toBe(5)
    })

    it('should update only provided fields', async () => {
      const updateData = {
        title: 'Only Title Updated'
      }

      const response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('Only Title Updated')
      expect(response.body.data.content).toBe('Test content') // Should remain unchanged
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated' })
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Project not found')
    })
  })

  describe('PATCH /api/projects/:id/status', () => {
    it('should update project status', async () => {
      const response = await request(app)
        .patch(`/api/projects/${testProject.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('IN_PROGRESS')
    })

    it('should validate status values', async () => {
      const response = await request(app)
        .patch(`/api/projects/${testProject.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid request data')
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('should delete project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Project deleted successfully')

      // Verify project is deleted
      const deletedProject = await prisma.project.findUnique({
        where: { id: testProject.id }
      })
      expect(deletedProject).toBeNull()
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .delete('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Project not found')
    })
  })
})