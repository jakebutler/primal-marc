# API Schema Documentation

## Overview

This document defines the API schema for agent inputs/outputs and workflow state management for the Blog Generator application.

## Base API Structure

All API endpoints follow RESTful conventions and return JSON responses.

### Authentication

All endpoints require authentication via Clerk session token in the Authorization header:
```
Authorization: Bearer <clerk_session_token>
```

### Error Response Format

```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
  }
}
```

## Workflow Orchestration API

### POST /api/workflow/initialize

Initialize a new blog post workflow.

**Request:**
```typescript
{
  idea: string;
  blogType: "academic" | "argumentative" | "lessons" | "metaphor" | "systems";
}
```

**Response:**
```typescript
{
  blogPostId: string;
  status: "voice_tone_pending";
  currentStep: "voice_tone";
}
```

---

### POST /api/workflow/:blogPostId/voice-tone

Generate voice and tone options.

**Request:**
```typescript
{
  // No body required - uses stored blog post data
}
```

**Response:**
```typescript
{
  options: Array<{
    id: string;
    name: string;
    description: string;
    style: {
      writingStyle: string;
      formality: string;
      emotionalPosture: string;
    };
  }>;
  status: "voice_tone_pending";
}
```

---

### PUT /api/workflow/:blogPostId/voice-tone/select

User selects a voice/tone option.

**Request:**
```typescript
{
  selectedOptionId: string;
}
```

**Response:**
```typescript
{
  status: "thesis_pending";
  currentStep: "thesis";
  selectedVoiceTone: {
    id: string;
    name: string;
    styleGuidelines: object;
  };
}
```

---

### POST /api/workflow/:blogPostId/thesis

Generate thesis and outline.

**Request:**
```typescript
{
  // No body required - uses stored blog post data
}
```

**Response:**
```typescript
{
  thesisOptions?: Array<{
    id: string;
    thesis: string;
    implications: string;
    audience: string;
  }>;
  thesis?: string;
  outline: Array<{
    sectionNumber: number;
    title: string;
    purpose: string;
    evidenceType: string;
  }>;
  conclusionIntent: string;
  status: "thesis_pending";
}
```

---

### PUT /api/workflow/:blogPostId/thesis/approve

User approves thesis and outline.

**Request:**
```typescript
{
  thesis?: string; // Optional override
  outline?: Array<{
    sectionNumber: number;
    title: string;
    purpose: string;
    evidenceType: string;
  }>; // Optional override
}
```

**Response:**
```typescript
{
  status: "research_pending";
  currentStep: "research";
  thesis: string;
  outline: Array<object>;
}
```

---

### POST /api/workflow/:blogPostId/research

Execute research agent to find sources.

**Request:**
```typescript
{
  // No body required - uses stored thesis and outline
}
```

**Response:**
```typescript
{
  sources: Array<{
    id: string;
    title: string;
    url: string;
    qualityScore: number; // 1-5
    qualityRationale: string;
    authority: number;
    relevance: number;
    recency: number;
    credibility: number;
    sectionMapping: Array<number>; // Section numbers this source supports
  }>;
  sectionMapping: {
    [sectionNumber: number]: Array<string>; // Source IDs
  };
  suggestedRevisions?: {
    thesis?: string;
    outline?: Array<object>;
  };
  status: "research_pending";
}
```

---

### PUT /api/workflow/:blogPostId/research/approve

User approves research sources.

**Request:**
```typescript
{
  requestAdditionalResearch?: boolean;
  additionalResearchQuery?: string;
}
```

**Response:**
```typescript
{
  status: "draft_pending";
  currentStep: "draft";
}
```

---

### POST /api/workflow/:blogPostId/draft

Generate blog post draft.

**Request:**
```typescript
{
  // No body required - uses stored thesis, outline, sources, voice/tone
}
```

**Response:**
```typescript
{
  content: string;
  wordCount: number;
  status: "draft_pending";
}
```

---

### PUT /api/workflow/:blogPostId/draft/approve

User approves draft or requests changes.

**Request:**
```typescript
{
  approved: boolean;
  requestedChanges?: string;
  goBackToStep?: "voice_tone" | "thesis" | "research" | "draft";
}
```

**Response:**
```typescript
{
  status: "editorial_pending" | string; // If approved, else status of step to go back to
  currentStep: string;
}
```

---

### POST /api/workflow/:blogPostId/editorial

Execute editorial and SEO agent.

**Request:**
```typescript
{
  // No body required - uses stored draft
}
```

**Response:**
```typescript
{
  finalContent: string;
  seoMetadata: {
    title: string;
    metaDescription: string;
    h2Suggestions: Array<string>;
  };
  socialPosts: {
    twitter: string;
    linkedin: string;
  };
  status: "final_pending";
}
```

---

### PUT /api/workflow/:blogPostId/final/approve

User approves final post.

**Request:**
```typescript
{
  seoMetadata?: {
    title?: string;
    metaDescription?: string;
  }; // Optional overrides
}
```

**Response:**
```typescript
{
  status: "completed";
  finalPost: {
    content: string;
    seoMetadata: object;
    socialPosts: object;
    citations: Array<object>;
  };
}
```

---

## State Management API

### GET /api/workflow/:blogPostId/state

Get current workflow state.

**Response:**
```typescript
{
  blogPostId: string;
  status: string;
  currentStep: string;
  steps: {
    voiceTone?: {
      options: Array<object>;
      selected?: object;
      approved: boolean;
    };
    thesis?: {
      thesis: string;
      outline: Array<object>;
      approved: boolean;
    };
    research?: {
      sources: Array<object>;
      approved: boolean;
    };
    draft?: {
      content: string;
      wordCount: number;
      approved: boolean;
    };
    editorial?: {
      finalContent: string;
      seoMetadata: object;
      socialPosts: object;
      approved: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}
```

---

### POST /api/workflow/:blogPostId/iterate

Go back to a previous step and re-run from there.

**Request:**
```typescript
{
  targetStep: "voice_tone" | "thesis" | "research" | "draft";
  preserveData?: boolean; // Whether to keep current data or start fresh
}
```

**Response:**
```typescript
{
  status: string;
  currentStep: string;
  message: string;
}
```

---

## Export API

### GET /api/workflow/:blogPostId/export

Export final blog post as Markdown.

**Response:**
```typescript
{
  markdown: string;
  filename: string;
}
```

**Markdown Format:**
```markdown
---
title: <SEO title>
description: <Meta description>
---

# <Blog Title>

<Blog content with citations>

---

## Citations

[1]: <url> - <title>
...

---

## Social Posts

### Twitter/X
<twitter post>

### LinkedIn
<linkedin post>
```

---

## Blog Post Management API

### GET /api/blog-posts

List all blog posts for the authenticated user.

**Query Parameters:**
- `status?: string` - Filter by status
- `limit?: number` - Number of results (default: 20)
- `offset?: number` - Pagination offset

**Response:**
```typescript
{
  blogPosts: Array<{
    id: string;
    title: string;
    blogType: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
}
```

---

### GET /api/blog-posts/:blogPostId

Get a specific blog post.

**Response:**
```typescript
{
  id: string;
  userId: string;
  title: string;
  blogType: string;
  status: string;
  // ... full workflow state
  createdAt: string;
  updatedAt: string;
}
```

---

### DELETE /api/blog-posts/:blogPostId

Delete a blog post.

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

## Template API

### POST /api/templates

Save current workflow state as a template.

**Request:**
```typescript
{
  name: string;
  blogType: string;
  voiceTone: object;
  savedState: object; // Workflow state to save
}
```

**Response:**
```typescript
{
  templateId: string;
  name: string;
  createdAt: string;
}
```

---

### GET /api/templates

List all templates for the authenticated user.

**Response:**
```typescript
{
  templates: Array<{
    id: string;
    name: string;
    blogType: string;
    createdAt: string;
  }>;
}
```

---

### POST /api/workflow/initialize-from-template

Initialize a new workflow from a template.

**Request:**
```typescript
{
  templateId: string;
  idea: string; // New idea to use with template
}
```

**Response:**
```typescript
{
  blogPostId: string;
  status: string;
  currentStep: string;
}
```

---

## API Key Management API

### POST /api/api-keys

Add or update user's API keys.

**Request:**
```typescript
{
  provider: "openai" | "anthropic" | "perplexity" | "exa";
  apiKey: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  provider: string;
  // Note: API key is never returned
}
```

---

### GET /api/api-keys

List configured API keys (without values).

**Response:**
```typescript
{
  keys: Array<{
    provider: string;
    configured: boolean;
    lastUsed?: string;
  }>;
}
```

---

### DELETE /api/api-keys/:provider

Delete an API key.

**Response:**
```typescript
{
  success: boolean;
}
```

---

## Error Codes

- `AUTH_REQUIRED` - Authentication required
- `AUTH_INVALID` - Invalid authentication token
- `BLOG_POST_NOT_FOUND` - Blog post not found or not accessible
- `INVALID_STEP` - Invalid workflow step
- `MISSING_REQUIRED_DATA` - Required data missing for step
- `AGENT_ERROR` - Agent execution failed
- `API_KEY_INVALID` - Invalid API key for LLM provider
- `API_KEY_MISSING` - API key not configured
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `DATABASE_ERROR` - Database operation failed
- `VALIDATION_ERROR` - Request validation failed

---

## Rate Limiting

- All endpoints: 100 requests per minute per user
- Agent execution endpoints: 10 requests per minute per user
- Export endpoints: 20 requests per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

