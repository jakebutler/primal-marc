// Shared database types and interfaces

export interface UserProfile {
  firstName?: string
  lastName?: string
  bio?: string
  writingGenres: string[]
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
}

export interface UserPreferences {
  defaultStyleGuide?: StyleGuide
  preferredAgentPersonality: 'formal' | 'casual' | 'creative'
  autoSaveInterval: number
  notificationSettings: NotificationSettings
}

export interface NotificationSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  weeklyDigest: boolean
}

export interface StyleGuide {
  referenceWriters?: string[]
  toneDescription?: string
  exampleText?: string
  targetAudience?: string
}

export interface ProjectMetadata {
  wordCount: number
  estimatedReadTime: number
  tags: string[]
  targetAudience?: string
  lastBackup?: string
}

export interface PhaseOutput {
  type: string
  content: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface ConversationContext {
  phaseType: 'IDEATION' | 'REFINEMENT' | 'MEDIA' | 'FACTCHECK'
  userGoals: string[]
  previousOutputs: PhaseOutput[]
}

export interface MessageMetadata {
  tokenCount?: number
  cost?: number
  model?: string
  processingTime?: number
  suggestions?: any[]
}

// Database model interfaces matching Prisma schema
export interface User {
  id: string
  email: string
  passwordHash: string
  firstName?: string
  lastName?: string
  bio?: string
  preferences?: string // JSON
  writingGenres?: string // JSON
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  userId: string
  title: string
  content: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED'
  metadata?: string // JSON
  currentPhaseId?: string
  createdAt: Date
  updatedAt: Date
}

export interface ProjectPhase {
  id: string
  projectId: string
  type: 'IDEATION' | 'REFINEMENT' | 'MEDIA' | 'FACTCHECK'
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED'
  outputs?: string // JSON
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface Conversation {
  id: string
  projectId: string
  agentType: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'
  context?: string // JSON
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  conversationId: string
  role: 'USER' | 'AGENT' | 'SYSTEM'
  content: string
  metadata?: string // JSON
  createdAt: Date
}

export interface LLMUsage {
  id: string
  userId: string
  agentType: 'IDEATION' | 'REFINER' | 'MEDIA' | 'FACTCHECKER'
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  requestId?: string
  metadata?: string // JSON
  createdAt: Date
}

// Validation schemas using Zod
export const userPreferencesSchema = {
  defaultStyleGuide: {
    referenceWriters: [] as string[],
    toneDescription: '',
    exampleText: '',
    targetAudience: '',
  },
  preferredAgentPersonality: 'casual' as const,
  autoSaveInterval: 30000, // 30 seconds
  notificationSettings: {
    emailNotifications: true,
    pushNotifications: false,
    weeklyDigest: true,
  },
}

export const projectMetadataSchema = {
  wordCount: 0,
  estimatedReadTime: 0,
  tags: [] as string[],
  targetAudience: '',
  lastBackup: '',
}