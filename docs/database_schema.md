# Database Schema Documentation

## Overview

This document defines the complete database schema for the Blog Generator application using NeonDB (PostgreSQL).

## Schema Design Principles

- Use UUIDs for primary keys
- Store JSON data in JSONB columns for flexibility and querying
- Include timestamps (created_at, updated_at) on all tables
- Use foreign keys with proper constraints
- Index frequently queried columns

## Tables

### users

Stores user information. Note: Authentication is handled by Clerk, but we store a reference to Clerk user ID.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX idx_users_email ON users(email);
```

**Notes:**
- `clerk_user_id` is the primary identifier from Clerk authentication
- Email is stored for convenience but should match Clerk's email

---

### blog_posts

Main table for blog post metadata.

```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  blog_type VARCHAR(50) NOT NULL CHECK (blog_type IN ('academic', 'argumentative', 'lessons', 'metaphor', 'systems')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'voice_tone_pending',
    'thesis_pending',
    'research_pending',
    'draft_pending',
    'editorial_pending',
    'final_pending',
    'completed',
    'archived'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_user_id ON blog_posts(user_id);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_blog_type ON blog_posts(blog_type);
CREATE INDEX idx_blog_posts_created_at ON blog_posts(created_at DESC);
```

---

### blog_post_states

Tracks state at each workflow step for iteration support.

```sql
CREATE TABLE blog_post_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  step_name VARCHAR(50) NOT NULL CHECK (step_name IN (
    'voice_tone',
    'thesis',
    'research',
    'draft',
    'editorial'
  )),
  state_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_blog_post_states_blog_post_id ON blog_post_states(blog_post_id);
CREATE INDEX idx_blog_post_states_step_name ON blog_post_states(step_name);
CREATE INDEX idx_blog_post_states_created_at ON blog_post_states(created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_blog_post_states_state_data ON blog_post_states USING GIN (state_data);
```

**state_data JSONB Structure Examples:**

Voice & Tone:
```json
{
  "options": [...],
  "selected": {...}
}
```

Thesis:
```json
{
  "thesis": "...",
  "outline": [...],
  "conclusionIntent": "..."
}
```

Research:
```json
{
  "sources": [...],
  "sectionMapping": {...}
}
```

Draft:
```json
{
  "content": "...",
  "wordCount": 1234
}
```

Editorial:
```json
{
  "finalContent": "...",
  "seoMetadata": {...},
  "socialPosts": {...}
}
```

---

### voice_tone_selections

Stores user's voice and tone selection.

```sql
CREATE TABLE voice_tone_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  selected_option_id VARCHAR(255) NOT NULL,
  selected_option_name VARCHAR(255) NOT NULL,
  style_guidelines JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blog_post_id)
);

CREATE INDEX idx_voice_tone_selections_blog_post_id ON voice_tone_selections(blog_post_id);
```

**style_guidelines JSONB Structure:**
```json
{
  "writingStyle": "...",
  "formality": "...",
  "emotionalPosture": "..."
}
```

---

### thesis_outlines

Stores thesis statement and outline.

```sql
CREATE TABLE thesis_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  thesis_statement TEXT NOT NULL,
  outline JSONB NOT NULL,
  conclusion_intent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blog_post_id)
);

CREATE INDEX idx_thesis_outlines_blog_post_id ON thesis_outlines(blog_post_id);
```

**outline JSONB Structure:**
```json
[
  {
    "sectionNumber": 1,
    "title": "...",
    "purpose": "...",
    "evidenceType": "..."
  },
  ...
]
```

---

### research_sources

Stores research sources and quality scores.

```sql
CREATE TABLE research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  sources JSONB NOT NULL,
  section_mapping JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blog_post_id)
);

CREATE INDEX idx_research_sources_blog_post_id ON research_sources(blog_post_id);
CREATE INDEX idx_research_sources_sources ON research_sources USING GIN (sources);
```

**sources JSONB Structure:**
```json
[
  {
    "id": "...",
    "title": "...",
    "url": "...",
    "qualityScore": 5,
    "qualityRationale": "...",
    "authority": 5,
    "relevance": 5,
    "recency": 5,
    "credibility": 5,
    "sectionMapping": [1, 2]
  },
  ...
]
```

**section_mapping JSONB Structure:**
```json
{
  "1": ["source-id-1", "source-id-2"],
  "2": ["source-id-3"],
  ...
}
```

---

### blog_drafts

Stores blog post drafts.

```sql
CREATE TABLE blog_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blog_post_id)
);

CREATE INDEX idx_blog_drafts_blog_post_id ON blog_drafts(blog_post_id);
```

---

### final_posts

Stores final completed blog posts with all metadata.

```sql
CREATE TABLE final_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  seo_metadata JSONB NOT NULL,
  social_posts JSONB NOT NULL,
  citations JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blog_post_id)
);

CREATE INDEX idx_final_posts_blog_post_id ON final_posts(blog_post_id);
```

**seo_metadata JSONB Structure:**
```json
{
  "title": "...",
  "metaDescription": "...",
  "h2Suggestions": ["...", "..."]
}
```

**social_posts JSONB Structure:**
```json
{
  "twitter": "...",
  "linkedin": "..."
}
```

**citations JSONB Structure:**
```json
[
  {
    "id": "1",
    "url": "...",
    "title": "...",
    "usedInSections": [1, 2]
  },
  ...
]
```

---

### templates

Stores saved templates for workflows.

```sql
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  blog_type VARCHAR(50) NOT NULL CHECK (blog_type IN ('academic', 'argumentative', 'lessons', 'metaphor', 'systems')),
  voice_tone JSONB,
  saved_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_templates_user_id ON templates(user_id);
CREATE INDEX idx_templates_blog_type ON templates(blog_type);
```

---

### api_keys

Stores user's API keys for LLM providers (encrypted).

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'perplexity', 'exa')),
  encrypted_key TEXT NOT NULL, -- Encrypted API key
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_provider ON api_keys(provider);
```

**Security Note:** API keys must be encrypted at rest. Use application-level encryption before storing.

---

## Views

### blog_posts_with_state

Convenience view to get blog posts with their current state.

```sql
CREATE VIEW blog_posts_with_state AS
SELECT 
  bp.id,
  bp.user_id,
  bp.title,
  bp.blog_type,
  bp.status,
  bp.created_at,
  bp.updated_at,
  vts.selected_option_name as voice_tone,
  to.thesis_statement,
  rs.sources as research_sources,
  bd.word_count,
  fp.content as final_content
FROM blog_posts bp
LEFT JOIN voice_tone_selections vts ON bp.id = vts.blog_post_id
LEFT JOIN thesis_outlines to ON bp.id = to.blog_post_id
LEFT JOIN research_sources rs ON bp.id = rs.blog_post_id
LEFT JOIN blog_drafts bd ON bp.id = bd.blog_post_id
LEFT JOIN final_posts fp ON bp.id = fp.blog_post_id;
```

---

## Functions

### update_updated_at()

Trigger function to automatically update the `updated_at` timestamp.

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Triggers

Apply the `update_updated_at` trigger to all tables with `updated_at`:

```sql
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_voice_tone_selections_updated_at
  BEFORE UPDATE ON voice_tone_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_thesis_outlines_updated_at
  BEFORE UPDATE ON thesis_outlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_research_sources_updated_at
  BEFORE UPDATE ON research_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_blog_drafts_updated_at
  BEFORE UPDATE ON blog_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_final_posts_updated_at
  BEFORE UPDATE ON final_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## Migration Strategy

1. Create all tables in order (respecting foreign key dependencies)
2. Create indexes
3. Create views
4. Create functions
5. Create triggers

---

## Data Retention

Consider implementing:
- Soft deletes (add `deleted_at` column)
- Archive old completed posts after 1 year
- Clean up abandoned drafts after 30 days

---

## Performance Considerations

1. **JSONB Indexing:** Use GIN indexes on frequently queried JSONB fields
2. **Partitioning:** Consider partitioning `blog_post_states` by date for large datasets
3. **Connection Pooling:** Use NeonDB connection pooling for serverless functions
4. **Query Optimization:** Use EXPLAIN ANALYZE to optimize slow queries

---

## Security Considerations

1. **Row-Level Security:** Implement RLS policies to ensure users can only access their own data
2. **API Key Encryption:** Encrypt API keys at rest using application-level encryption
3. **Input Validation:** Validate all JSONB inputs to prevent injection
4. **Audit Logging:** Consider adding audit logs for sensitive operations

---

## Example Queries

### Get user's blog posts with latest state

```sql
SELECT 
  bp.*,
  vts.selected_option_name,
  to.thesis_statement,
  bd.word_count
FROM blog_posts bp
LEFT JOIN voice_tone_selections vts ON bp.id = vts.blog_post_id
LEFT JOIN thesis_outlines to ON bp.id = to.blog_post_id
LEFT JOIN blog_drafts bd ON bp.id = bd.blog_post_id
WHERE bp.user_id = $1
ORDER BY bp.updated_at DESC;
```

### Get research sources for a blog post

```sql
SELECT 
  jsonb_array_elements(sources) as source
FROM research_sources
WHERE blog_post_id = $1;
```

### Get workflow state history

```sql
SELECT 
  step_name,
  state_data,
  created_at
FROM blog_post_states
WHERE blog_post_id = $1
ORDER BY created_at ASC;
```

