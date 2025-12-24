# Integration Research & Recommendations

## Overview

This document provides research and recommendations for LLM providers, web search APIs, and LangChain integration patterns for the Blog Generator application.

---

## LLM Providers

### Primary Recommendations

#### 1. OpenAI (Recommended for Primary)

**Models:**
- **GPT-4 Turbo** - Best for complex reasoning, thesis generation, editorial work
- **GPT-3.5 Turbo** - Cost-effective for simpler tasks, voice/tone generation

**Pros:**
- Most mature LangChain.js integration
- Excellent output quality
- Reliable API
- Good documentation
- Supports structured outputs (JSON mode)

**Cons:**
- Higher cost than alternatives
- Rate limits on free tier

**Pricing (as of 2024):**
- GPT-4 Turbo: $10/1M input tokens, $30/1M output tokens
- GPT-3.5 Turbo: $0.50/1M input tokens, $1.50/1M output tokens

**Use Cases:**
- Idea Refiner Agent (GPT-4)
- Blog Writer Agent (GPT-4)
- Editorial & SEO Agent (GPT-4)
- Voice & Tone Agent (GPT-3.5)

**LangChain Integration:**
```typescript
import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview",
  temperature: 0.7,
  openAIApiKey: userApiKey,
});
```

---

#### 2. Anthropic Claude (Recommended for Alternative)

**Models:**
- **Claude 3 Opus** - Highest quality, best for complex tasks
- **Claude 3 Sonnet** - Balanced quality and cost
- **Claude 3 Haiku** - Fast and cost-effective

**Pros:**
- Excellent for long-form content
- Strong reasoning capabilities
- Good safety features
- Competitive pricing

**Cons:**
- Less mature LangChain.js integration
- Smaller ecosystem

**Pricing (as of 2024):**
- Claude 3 Opus: $15/1M input tokens, $75/1M output tokens
- Claude 3 Sonnet: $3/1M input tokens, $15/1M output tokens
- Claude 3 Haiku: $0.25/1M input tokens, $1.25/1M output tokens

**Use Cases:**
- Blog Writer Agent (Claude 3 Sonnet)
- Editorial & SEO Agent (Claude 3 Sonnet)
- Alternative to OpenAI for cost-sensitive users

**LangChain Integration:**
```typescript
import { ChatAnthropic } from "langchain/chat_models/anthropic";

const model = new ChatAnthropic({
  modelName: "claude-3-sonnet-20240229",
  temperature: 0.7,
  anthropicApiKey: userApiKey,
});
```

---

### Provider Selection Strategy

**Recommendation:**
- **Default:** OpenAI GPT-4 Turbo for quality
- **Allow user choice:** Support both OpenAI and Anthropic
- **Cost optimization:** Use GPT-3.5 for simpler tasks (voice/tone)
- **Fallback:** If one provider fails, try the other

**Implementation:**
- User selects preferred provider in settings
- Store API keys per provider
- Allow switching per workflow if needed

---

## Research APIs

### Primary: Perplexity API

**Overview:**
- AI-powered search API
- Provides citations automatically
- Real-time web search
- High-quality source aggregation

**Pros:**
- Excellent for research tasks
- Automatic citation extraction
- Real-time information
- Good source quality

**Cons:**
- Higher cost than traditional search
- Rate limits
- Less control over search parameters

**Pricing (as of 2024):**
- Free tier: Limited requests
- Pro: $20/month for 5,000 requests
- Enterprise: Custom pricing

**API Integration:**
```typescript
const response = await fetch("https://api.perplexity.ai/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "llama-3.1-sonar-large-128k-online",
    messages: [
      {
        role: "system",
        content: "You are a research assistant. Provide citations.",
      },
      {
        role: "user",
        content: searchQuery,
      },
    ],
  }),
});
```

**LangChain Integration:**
- Use Perplexity as a tool in Research Agent
- Parse citations from response
- Extract source URLs and titles

---

### Fallback: Exa.ai

**Overview:**
- Neural search API
- Semantic search capabilities
- Good for finding relevant sources
- Provides content snippets

**Pros:**
- Good semantic understanding
- Provides content previews
- Reliable API
- Competitive pricing

**Cons:**
- Less citation-focused than Perplexity
- May require additional processing

**Pricing (as of 2024):**
- Free tier: Limited
- Pro: $20/month
- Enterprise: Custom

**API Integration:**
```typescript
const response = await fetch("https://api.exa.ai/search", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: searchQuery,
    num_results: 10,
    contents: {
      text: true,
      highlights: true,
    },
  }),
});
```

**Fallback Strategy:**
1. Try Perplexity first
2. If Perplexity fails, automatically try Exa.ai
3. If both fail, show error to user
4. Log both failures for monitoring

---

## LangChain.js Integration Patterns

### Basic Agent Setup

```typescript
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import { readFile } from "fs/promises";

// Load prompt template
const promptTemplate = await readFile(
  "./agents/voice_and_tone_agent.md",
  "utf-8"
);

// Create prompt
const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);

// Initialize model
const model = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview",
  temperature: 0.7,
  openAIApiKey: userApiKey,
});

// Create chain
const chain = prompt.pipe(model).pipe(new StringOutputParser());

// Execute
const result = await chain.invoke({
  blogType: "academic",
  thesis: userThesis,
});
```

---

### Structured Output Pattern

For agents that need structured outputs (thesis, outline, sources):

```typescript
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

// Define schema
const thesisSchema = z.object({
  thesis: z.string(),
  outline: z.array(
    z.object({
      sectionNumber: z.number(),
      title: z.string(),
      purpose: z.string(),
      evidenceType: z.string(),
    })
  ),
  conclusionIntent: z.string(),
});

// Create parser
const parser = StructuredOutputParser.fromZodSchema(thesisSchema);

// Create prompt with format instructions
const prompt = ChatPromptTemplate.fromMessages([
  ["system", `{formatInstructions}\n{promptTemplate}`],
  ["user", "{input}"],
]);

// Create chain
const chain = prompt
  .pipe(model)
  .pipe(parser);

// Execute
const result = await chain.invoke({
  formatInstructions: parser.getFormatInstructions(),
  promptTemplate: ideaRefinerPrompt,
  input: userIdea,
});
```

---

### Tool Integration Pattern

For Research Agent with web search:

```typescript
import { ChatOpenAI } from "langchain/chat_models/openai";
import { DynamicStructuredTool } from "langchain/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { z } from "zod";

// Define search tool
const perplexitySearchTool = new DynamicStructuredTool({
  name: "perplexity_search",
  description: "Search the web for research sources using Perplexity API",
  schema: z.object({
    query: z.string().describe("The search query"),
  }),
  func: async ({ query }) => {
    // Call Perplexity API
    const response = await fetchPerplexity(query);
    return JSON.stringify(response);
  },
});

// Create agent with tools
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools: [perplexitySearchTool],
  prompt: researchAgentPrompt,
});

// Execute agent
const executor = new AgentExecutor({
  agent,
  tools: [perplexitySearchTool],
  verbose: true,
});

const result = await executor.invoke({
  thesis: approvedThesis,
  outline: structuredOutline,
  evidenceExpectations: evidenceExpectations,
});
```

---

### Error Handling Pattern

```typescript
import { retry } from "langchain/util/retry";

const modelWithRetry = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview",
  temperature: 0.7,
  openAIApiKey: userApiKey,
  maxRetries: 3,
  // Custom retry logic
}).bind({
  // Additional error handling
});

// Or use LangChain's retry utility
const retryChain = retry(chain, {
  maxAttempts: 3,
  backoff: "exponential",
  baseDelay: 1000,
  maxDelay: 10000,
});
```

---

### Streaming Pattern

For long-running agents (Blog Writer):

```typescript
import { StreamingTextResponse } from "ai";

export async function POST(request: Request) {
  const { input } = await request.json();

  const stream = await chain.stream({
    input,
  });

  return new StreamingTextResponse(stream);
}
```

---

### Observability Integration (Opik)

```typescript
import { LangChainTracer } from "langchain/callbacks";
import { CometTracer } from "@comet-ml/opik";

// Initialize Opik tracer
const opikTracer = new CometTracer({
  apiKey: process.env.COMET_API_KEY,
  projectName: "blog-generator",
});

// Use in chain
const result = await chain.invoke(
  { input },
  {
    callbacks: [opikTracer],
  }
);
```

---

## API Key Management

### Secure Storage

**Recommendation:**
- Encrypt API keys at rest
- Use environment variables for app-level keys
- Store user keys encrypted in database
- Never log API keys

**Implementation:**
```typescript
import { encrypt, decrypt } from "./encryption";

// Store encrypted
const encryptedKey = encrypt(userApiKey);
await db.apiKeys.create({
  userId,
  provider: "openai",
  encryptedKey,
});

// Retrieve and decrypt
const stored = await db.apiKeys.find({ userId, provider: "openai" });
const decryptedKey = decrypt(stored.encryptedKey);
```

---

## Rate Limiting Strategy

### Per-User Rate Limiting

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
  analytics: true,
});

// Check rate limit
const { success } = await ratelimit.limit(`agent:${userId}`);
if (!success) {
  throw new Error("Rate limit exceeded");
}
```

---

## Cost Optimization

### Strategies

1. **Model Selection:**
   - Use GPT-3.5 for simpler tasks (voice/tone)
   - Use GPT-4 for complex tasks (thesis, writing, editorial)

2. **Caching:**
   - Cache similar voice/tone options
   - Cache research results for common queries

3. **Token Management:**
   - Set max tokens for outputs
   - Truncate inputs if too long
   - Use streaming for user feedback

4. **Batch Processing:**
   - Batch similar requests when possible
   - Use parallel processing for independent tasks

---

## Monitoring & Analytics

### Opik Integration

- Track all LLM calls
- Monitor token usage
- Track costs per user
- Identify slow/failing requests
- Analyze prompt effectiveness

### PostHog Integration

- Track agent execution times
- Monitor error rates
- Track user workflow completion
- A/B test different prompts
- Analyze user behavior

---

## Testing Strategy

### Unit Tests

- Test each agent in isolation
- Mock API responses
- Test error handling
- Test output parsing

### Integration Tests

- Test full workflow
- Test API integrations
- Test error recovery
- Test rate limiting

### Load Tests

- Test concurrent users
- Test API rate limits
- Test database performance
- Test error handling under load

---

## Recommendations Summary

1. **LLM Provider:**
   - Primary: OpenAI GPT-4 Turbo
   - Alternative: Anthropic Claude 3 Sonnet
   - Allow user choice

2. **Research API:**
   - Primary: Perplexity API
   - Fallback: Exa.ai
   - Automatic fallback on failure

3. **LangChain Pattern:**
   - Use structured outputs for complex agents
   - Use tools for Research Agent
   - Implement retry logic
   - Add observability (Opik)

4. **Security:**
   - Encrypt API keys at rest
   - Never log keys
   - Use secure environment variables

5. **Performance:**
   - Implement rate limiting
   - Use appropriate models per task
   - Cache when possible
   - Monitor costs

6. **Monitoring:**
   - Integrate Opik for LLM observability
   - Use PostHog for analytics
   - Track errors and performance

---

## Implementation Checklist

- [ ] Set up OpenAI API integration
- [ ] Set up Anthropic API integration (optional)
- [ ] Set up Perplexity API integration
- [ ] Set up Exa.ai fallback
- [ ] Implement LangChain.js agents
- [ ] Add structured output parsing
- [ ] Implement error handling and retries
- [ ] Add Opik observability
- [ ] Add PostHog analytics
- [ ] Implement API key encryption
- [ ] Add rate limiting
- [ ] Set up monitoring and alerts
- [ ] Write integration tests
- [ ] Document API usage patterns

