import { z } from 'zod'
import { ContentPhase, ContentStatus, AgentType } from './types'

// User validation schemas
export const userSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100)
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

// Content validation schemas
export const contentSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200),
  body: z.string(),
  phase: z.nativeEnum(ContentPhase),
  status: z.nativeEnum(ContentStatus),
  userId: z.string().cuid(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().optional().default(''),
  phase: z.nativeEnum(ContentPhase).optional().default(ContentPhase.IDEATION)
})

export const updateContentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().optional(),
  phase: z.nativeEnum(ContentPhase).optional(),
  status: z.nativeEnum(ContentStatus).optional()
})

// Agent interaction validation schemas
export const agentInteractionSchema = z.object({
  id: z.string().cuid(),
  contentId: z.string().cuid(),
  agentType: z.nativeEnum(AgentType),
  input: z.string().min(1),
  output: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date()
})

export const createAgentInteractionSchema = z.object({
  contentId: z.string().cuid(),
  agentType: z.nativeEnum(AgentType),
  input: z.string().min(1),
  output: z.string(),
  metadata: z.record(z.unknown()).optional()
})