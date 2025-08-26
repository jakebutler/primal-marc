import { prisma } from './database.js'
import { ProjectModel } from '../models/project.js'
import { logger } from '../utils/logger.js'

export interface SearchOptions {
  query: string
  userId: string
  filters?: {
    status?: string[]
    tags?: string[]
    folderId?: string
    dateRange?: {
      start: Date
      end: Date
    }
    phase?: string[]
  }
  sortBy?: 'relevance' | 'date' | 'title' | 'wordCount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SearchResult {
  id: string
  title: string
  content: string
  status: string
  metadata: any
  createdAt: Date
  updatedAt: Date
  relevanceScore: number
  highlights: {
    title?: string[]
    content?: string[]
  }
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  facets: {
    status: Record<string, number>
    tags: Record<string, number>
    folders: Record<string, number>
  }
}

export class SearchService {
  /**
   * Perform full-text search across projects
   */
  static async searchProjects(options: SearchOptions): Promise<SearchResponse> {
    try {
      const {
        query,
        userId,
        filters = {},
        sortBy = 'relevance',
        sortOrder = 'desc',
        limit = 20,
        offset = 0
      } = options
      
      // Build where clause
      const where: any = { userId }
      
      // Add filters
      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status }
      }
      
      if (filters.folderId) {
        where.folderId = filters.folderId
      }
      
      if (filters.dateRange) {
        where.updatedAt = {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end
        }
      }
      
      // Get all matching projects first
      let projects = await prisma.project.findMany({
        where,
        include: {
          phases: {
            select: {
              type: true,
              status: true
            }
          }
        }
      })
      
      // Apply phase filter if specified
      if (filters.phase && filters.phase.length > 0) {
        projects = projects.filter(project => 
          project.phases.some(phase => 
            filters.phase!.includes(phase.type) && phase.status === 'COMPLETED'
          )
        )
      }
      
      // Apply tag filter if specified
      if (filters.tags && filters.tags.length > 0) {
        projects = projects.filter(project => {
          const metadata = ProjectModel.getProjectMetadata(project)
          return filters.tags!.some(tag => 
            metadata.tags.includes(tag.toLowerCase())
          )
        })
      }
      
      // Perform text search and calculate relevance scores
      const searchResults: SearchResult[] = []
      const queryTerms = this.tokenizeQuery(query)
      
      for (const project of projects) {
        const relevanceScore = this.calculateRelevanceScore(
          project,
          queryTerms
        )
        
        if (relevanceScore > 0 || query.trim() === '') {
          const highlights = this.generateHighlights(project, queryTerms)
          
          searchResults.push({
            id: project.id,
            title: project.title,
            content: project.content,
            status: project.status,
            metadata: ProjectModel.getProjectMetadata(project),
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            relevanceScore,
            highlights
          })
        }
      }
      
      // Sort results
      this.sortResults(searchResults, sortBy, sortOrder)
      
      // Generate facets
      const facets = this.generateFacets(searchResults)
      
      // Apply pagination
      const paginatedResults = searchResults.slice(offset, offset + limit)
      
      return {
        results: paginatedResults,
        total: searchResults.length,
        facets
      }
    } catch (error) {
      logger.error('Search failed:', error)
      throw error
    }
  }
  
  /**
   * Search within conversations
   */
  static async searchConversations(
    userId: string,
    query: string,
    limit = 10
  ): Promise<any[]> {
    try {
      const queryTerms = this.tokenizeQuery(query)
      
      const conversations = await prisma.conversation.findMany({
        where: {
          project: {
            userId
          }
        },
        include: {
          messages: true,
          project: {
            select: {
              id: true,
              title: true
            }
          }
        }
      })
      
      const results: any[] = []
      
      for (const conversation of conversations) {
        for (const message of conversation.messages) {
          const relevanceScore = this.calculateTextRelevance(
            message.content,
            queryTerms
          )
          
          if (relevanceScore > 0) {
            results.push({
              conversationId: conversation.id,
              messageId: message.id,
              projectId: conversation.project.id,
              projectTitle: conversation.project.title,
              agentType: conversation.agentType,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
              relevanceScore,
              highlights: this.highlightText(message.content, queryTerms)
            })
          }
        }
      }
      
      // Sort by relevance and limit
      results.sort((a, b) => b.relevanceScore - a.relevanceScore)
      return results.slice(0, limit)
    } catch (error) {
      logger.error('Conversation search failed:', error)
      throw error
    }
  }
  
  /**
   * Get search suggestions based on user's projects
   */
  static async getSearchSuggestions(
    userId: string,
    query: string,
    limit = 5
  ): Promise<string[]> {
    try {
      const projects = await prisma.project.findMany({
        where: { userId },
        select: {
          title: true,
          content: true,
          metadata: true
        }
      })
      
      const suggestions = new Set<string>()
      const queryLower = query.toLowerCase()
      
      // Extract suggestions from titles
      projects.forEach(project => {
        const words = project.title.toLowerCase().split(/\s+/)
        words.forEach(word => {
          if (word.startsWith(queryLower) && word.length > queryLower.length) {
            suggestions.add(word)
          }
        })
      })
      
      // Extract suggestions from tags
      projects.forEach(project => {
        const metadata = ProjectModel.getProjectMetadata(project)
        metadata.tags.forEach(tag => {
          if (tag.startsWith(queryLower) && tag.length > queryLower.length) {
            suggestions.add(tag)
          }
        })
      })
      
      // Extract suggestions from content (common phrases)
      if (queryLower.length >= 3) {
        projects.forEach(project => {
          const sentences = project.content.split(/[.!?]+/)
          sentences.forEach(sentence => {
            if (sentence.toLowerCase().includes(queryLower)) {
              const words = sentence.trim().split(/\s+/)
              if (words.length <= 5) {
                suggestions.add(sentence.trim())
              }
            }
          })
        })
      }
      
      return Array.from(suggestions).slice(0, limit)
    } catch (error) {
      logger.error('Failed to get search suggestions:', error)
      return []
    }
  }
  
  /**
   * Tokenize search query
   */
  private static tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0)
  }
  
  /**
   * Calculate relevance score for a project
   */
  private static calculateRelevanceScore(
    project: any,
    queryTerms: string[]
  ): number {
    if (queryTerms.length === 0) return 1
    
    let score = 0
    const titleLower = project.title.toLowerCase()
    const contentLower = project.content.toLowerCase()
    const metadata = ProjectModel.getProjectMetadata(project)
    
    queryTerms.forEach(term => {
      // Title matches (highest weight)
      if (titleLower.includes(term)) {
        score += titleLower === term ? 10 : 5
      }
      
      // Tag matches (high weight)
      if (metadata.tags.some((tag: string) => tag.includes(term))) {
        score += 3
      }
      
      // Content matches (lower weight)
      const contentMatches = (contentLower.match(new RegExp(term, 'g')) || []).length
      score += Math.min(contentMatches * 0.5, 2)
    })
    
    return score
  }
  
  /**
   * Calculate text relevance score
   */
  private static calculateTextRelevance(text: string, queryTerms: string[]): number {
    if (queryTerms.length === 0) return 0
    
    const textLower = text.toLowerCase()
    let score = 0
    
    queryTerms.forEach(term => {
      const matches = (textLower.match(new RegExp(term, 'g')) || []).length
      score += matches
    })
    
    return score
  }
  
  /**
   * Generate highlights for search results
   */
  private static generateHighlights(
    project: any,
    queryTerms: string[]
  ): { title?: string[]; content?: string[] } {
    const highlights: { title?: string[]; content?: string[] } = {}
    
    if (queryTerms.length === 0) return highlights
    
    // Highlight title
    highlights.title = this.highlightText(project.title, queryTerms)
    
    // Highlight content (show relevant snippets)
    highlights.content = this.extractContentSnippets(project.content, queryTerms)
    
    return highlights
  }
  
  /**
   * Highlight text with query terms
   */
  private static highlightText(text: string, queryTerms: string[]): string[] {
    let highlightedText = text
    
    queryTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>')
    })
    
    return [highlightedText]
  }
  
  /**
   * Extract relevant content snippets
   */
  private static extractContentSnippets(
    content: string,
    queryTerms: string[],
    maxSnippets = 3,
    snippetLength = 150
  ): string[] {
    const snippets: string[] = []
    const contentLower = content.toLowerCase()
    
    queryTerms.forEach(term => {
      const regex = new RegExp(term, 'gi')
      let match
      
      while ((match = regex.exec(contentLower)) !== null && snippets.length < maxSnippets) {
        const start = Math.max(0, match.index - snippetLength / 2)
        const end = Math.min(content.length, match.index + term.length + snippetLength / 2)
        
        let snippet = content.substring(start, end)
        
        // Add ellipsis if needed
        if (start > 0) snippet = '...' + snippet
        if (end < content.length) snippet = snippet + '...'
        
        // Highlight the term
        snippet = snippet.replace(new RegExp(`(${term})`, 'gi'), '<mark>$1</mark>')
        
        snippets.push(snippet)
      }
    })
    
    return snippets.slice(0, maxSnippets)
  }
  
  /**
   * Sort search results
   */
  private static sortResults(
    results: SearchResult[],
    sortBy: string,
    sortOrder: string
  ): void {
    results.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'relevance':
          comparison = b.relevanceScore - a.relevanceScore
          break
        case 'date':
          comparison = b.updatedAt.getTime() - a.updatedAt.getTime()
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'wordCount':
          comparison = b.metadata.wordCount - a.metadata.wordCount
          break
        default:
          comparison = b.relevanceScore - a.relevanceScore
      }
      
      return sortOrder === 'asc' ? -comparison : comparison
    })
  }
  
  /**
   * Generate search facets
   */
  private static generateFacets(results: SearchResult[]): {
    status: Record<string, number>
    tags: Record<string, number>
    folders: Record<string, number>
  } {
    const facets = {
      status: {} as Record<string, number>,
      tags: {} as Record<string, number>,
      folders: {} as Record<string, number>
    }
    
    results.forEach(result => {
      // Status facets
      facets.status[result.status] = (facets.status[result.status] || 0) + 1
      
      // Tag facets
      result.metadata.tags.forEach((tag: string) => {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1
      })
    })
    
    return facets
  }
}