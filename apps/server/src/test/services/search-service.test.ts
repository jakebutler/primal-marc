import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SearchService } from '../../services/search-service.js'
import { prisma } from '../../services/database.js'
import { ProjectModel } from '../../models/project.js'

// Mock dependencies
vi.mock('../../services/database.js', () => ({
  prisma: {
    project: {
      findMany: vi.fn()
    },
    conversation: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('../../models/project.js')

const mockProjects = [
  {
    id: 'project-1',
    title: 'React Tutorial',
    content: 'Learn React basics with this comprehensive tutorial',
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    metadata: JSON.stringify({
      wordCount: 500,
      estimatedReadTime: 3,
      tags: ['react', 'tutorial', 'javascript']
    }),
    phases: [
      { type: 'IDEATION', status: 'COMPLETED' },
      { type: 'REFINEMENT', status: 'COMPLETED' }
    ]
  },
  {
    id: 'project-2',
    title: 'Vue.js Guide',
    content: 'A complete guide to Vue.js framework',
    status: 'DRAFT',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-04'),
    metadata: JSON.stringify({
      wordCount: 300,
      estimatedReadTime: 2,
      tags: ['vue', 'javascript', 'frontend']
    }),
    phases: [
      { type: 'IDEATION', status: 'COMPLETED' }
    ]
  }
]

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any)
    vi.mocked(ProjectModel.getProjectMetadata).mockImplementation((project) => {
      return JSON.parse(project.metadata || '{}')
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('searchProjects', () => {
    it('should search projects by query', async () => {
      const result = await SearchService.searchProjects({
        query: 'react',
        userId: 'user-1'
      })

      expect(result.results).toHaveLength(1)
      expect(result.results[0].title).toBe('React Tutorial')
      expect(result.results[0].relevanceScore).toBeGreaterThan(0)
      expect(result.total).toBe(1)
    })

    it('should filter by status', async () => {
      const result = await SearchService.searchProjects({
        query: '',
        userId: 'user-1',
        filters: {
          status: ['PUBLISHED']
        }
      })

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PUBLISHED'] }
          })
        })
      )
    })

    it('should filter by tags', async () => {
      const result = await SearchService.searchProjects({
        query: '',
        userId: 'user-1',
        filters: {
          tags: ['javascript']
        }
      })

      expect(result.results).toHaveLength(2) // Both projects have 'javascript' tag
    })

    it('should filter by phase completion', async () => {
      const result = await SearchService.searchProjects({
        query: '',
        userId: 'user-1',
        filters: {
          phase: ['REFINEMENT']
        }
      })

      expect(result.results).toHaveLength(1) // Only project-1 has completed REFINEMENT
      expect(result.results[0].id).toBe('project-1')
    })

    it('should sort by relevance', async () => {
      const result = await SearchService.searchProjects({
        query: 'tutorial',
        userId: 'user-1',
        sortBy: 'relevance',
        sortOrder: 'desc'
      })

      expect(result.results[0].relevanceScore).toBeGreaterThan(0)
    })

    it('should sort by date', async () => {
      const result = await SearchService.searchProjects({
        query: '',
        userId: 'user-1',
        sortBy: 'date',
        sortOrder: 'desc'
      })

      // Should be sorted by updatedAt desc
      expect(new Date(result.results[0].updatedAt).getTime())
        .toBeGreaterThan(new Date(result.results[1].updatedAt).getTime())
    })

    it('should generate facets', async () => {
      const result = await SearchService.searchProjects({
        query: '',
        userId: 'user-1'
      })

      expect(result.facets.status).toEqual({
        'PUBLISHED': 1,
        'DRAFT': 1
      })
      expect(result.facets.tags).toEqual({
        'react': 1,
        'tutorial': 1,
        'javascript': 2,
        'vue': 1,
        'frontend': 1
      })
    })

    it('should apply pagination', async () => {
      const result = await SearchService.searchProjects({
        query: '',
        userId: 'user-1',
        limit: 1,
        offset: 1
      })

      expect(result.results).toHaveLength(1)
      expect(result.total).toBe(2)
    })

    it('should generate highlights for search results', async () => {
      const result = await SearchService.searchProjects({
        query: 'react',
        userId: 'user-1'
      })

      expect(result.results[0].highlights.title).toBeDefined()
      expect(result.results[0].highlights.content).toBeDefined()
    })
  })

  describe('searchConversations', () => {
    const mockConversations = [
      {
        id: 'conv-1',
        agentType: 'IDEATION',
        project: {
          id: 'project-1',
          title: 'React Tutorial'
        },
        messages: [
          {
            id: 'msg-1',
            role: 'USER',
            content: 'How do I start with React?',
            createdAt: new Date('2024-01-01')
          },
          {
            id: 'msg-2',
            role: 'AGENT',
            content: 'Start by learning JSX and components',
            createdAt: new Date('2024-01-01')
          }
        ]
      }
    ]

    beforeEach(() => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations as any)
    })

    it('should search conversations by content', async () => {
      const result = await SearchService.searchConversations('user-1', 'React')

      expect(result).toHaveLength(1) // Only one message contains 'React' (the user message)
      expect(result[0].content).toContain('React')
      expect(result[0].relevanceScore).toBeGreaterThan(0)
    })

    it('should include conversation context', async () => {
      const result = await SearchService.searchConversations('user-1', 'React')

      expect(result[0]).toMatchObject({
        conversationId: 'conv-1',
        projectId: 'project-1',
        projectTitle: 'React Tutorial',
        agentType: 'IDEATION'
      })
    })

    it('should limit results', async () => {
      const result = await SearchService.searchConversations('user-1', 'React', 1)

      expect(result).toHaveLength(1)
    })
  })

  describe('getSearchSuggestions', () => {
    it('should generate suggestions from project titles', async () => {
      const result = await SearchService.getSearchSuggestions('user-1', 'reac')

      expect(result).toContain('react')
    })

    it('should generate suggestions from tags', async () => {
      const result = await SearchService.getSearchSuggestions('user-1', 'java')

      expect(result).toContain('javascript')
    })

    it('should limit suggestions', async () => {
      const result = await SearchService.getSearchSuggestions('user-1', 'a', 3)

      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('should return empty array for short queries', async () => {
      const result = await SearchService.getSearchSuggestions('user-1', 'a')

      expect(result).toEqual([])
    })
  })
})