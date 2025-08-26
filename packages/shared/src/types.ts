// Shared TypeScript types
export interface User {
  id: string
  email: string
  username: string
  createdAt: Date
  updatedAt: Date
}

export interface Content {
  id: string
  title: string
  body: string
  phase: ContentPhase
  status: ContentStatus
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface AgentInteraction {
  id: string
  contentId: string
  agentType: AgentType
  input: string
  output: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export enum ContentPhase {
  IDEATION = 'IDEATION',
  REFINEMENT = 'REFINEMENT',
  MEDIA = 'MEDIA',
  FACTCHECK = 'FACTCHECK'
}

export enum ContentStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PUBLISHED = 'PUBLISHED'
}

export enum AgentType {
  IDEATION = 'IDEATION',
  REFINER = 'REFINER',
  MEDIA = 'MEDIA',
  FACTCHECKER = 'FACTCHECKER'
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Result type for error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }