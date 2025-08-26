# Fact-Checker and SEO Agent

The Fact-Checker Agent is a cost-effective AI agent that verifies factual claims in content and provides SEO optimization suggestions using free and low-cost resources.

## Features

### Fact-Checking Capabilities
- **Claim Extraction**: Automatically identifies factual statements that can be verified
- **Multi-Source Verification**: Uses free search APIs (DuckDuckGo, SerpAPI free tier) to verify claims
- **Source Credibility Assessment**: Evaluates source reliability based on domain reputation
- **Conflict Detection**: Identifies contradictory or disputed information
- **Citation Suggestions**: Provides proper source attribution and links

### SEO Optimization
- **Link Suggestions**: Recommends internal and external links to authoritative sources
- **Keyword Optimization**: Suggests natural keyword integration opportunities
- **Content Structure**: Provides recommendations for better content organization
- **Meta Optimization**: Suggests improvements for titles and descriptions

### Cost-Effective Design
- **Free APIs**: Primarily uses DuckDuckGo's free instant answer API
- **Caching**: Implements result caching to minimize repeated API calls
- **Rate Limiting**: Respects API limits with built-in delays
- **Fallback Mechanisms**: Graceful degradation when APIs are unavailable

## Usage

### Basic Fact-Checking Request
```typescript
const agent = await agentFactory.createAgent('FACTCHECKER')

const response = await agent.processRequest({
  userId: 'user123',
  projectId: 'project456',
  conversationId: 'conv789',
  content: 'The Earth is approximately 4.5 billion years old.',
  context: {
    previousPhases: [],
    userPreferences: {
      preferredAgentPersonality: 'formal',
      writingGenres: ['scientific'],
      experienceLevel: 'INTERMEDIATE'
    }
  }
})
```

### API Endpoints

#### POST /api/factcheck
Fact-check content and provide SEO suggestions.

**Request Body:**
```json
{
  "content": "Content to fact-check",
  "projectId": "project-id",
  "conversationId": "conversation-id",
  "context": {
    "userPreferences": {
      "preferredAgentPersonality": "formal",
      "writingGenres": ["scientific"],
      "experienceLevel": "INTERMEDIATE"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "Detailed fact-check results and SEO suggestions",
    "suggestions": [
      {
        "type": "action",
        "title": "Address Disputed Claims",
        "description": "Review and correct claims marked as false or disputed",
        "priority": "high"
      }
    ],
    "metadata": {
      "processingTime": 1500,
      "tokenUsage": { "totalTokens": 150, "cost": 0.001 },
      "confidence": 0.8
    }
  }
}
```

#### GET /api/factcheck/health
Check agent health status.

#### GET /api/factcheck/capabilities
Get agent capabilities and configuration.

## Configuration

### Environment Variables
- `SERPAPI_KEY` (optional): SerpAPI key for additional search results
- `PEXELS_API_KEY` (optional): For image-related fact-checking

### Trusted Domains
The agent maintains a list of trusted domains with high credibility scores:
- Government sites (.gov): 0.9
- Educational institutions (.edu): 0.85
- Wikipedia: 0.8
- Established news sources: 0.7-0.9
- Scientific journals: 0.95

## Cost Management

### Budget Optimization
- **Primary API**: DuckDuckGo (completely free)
- **Secondary API**: SerpAPI free tier (100 searches/month)
- **LLM Usage**: Optimized prompts with GPT-3.5-turbo for cost efficiency
- **Caching**: 24-hour cache for fact-check results
- **Rate Limiting**: 500ms delays between API calls

### Estimated Costs
- **Base operation**: $0 (using free APIs)
- **LLM processing**: ~$0.001-0.002 per request
- **With SerpAPI**: +$0.001 per search (after free tier)
- **Monthly estimate**: $5-15 for moderate usage

## Error Handling

### Graceful Degradation
- **API Failures**: Falls back to heuristic analysis
- **LLM Errors**: Provides manual fact-checking guidelines
- **Network Issues**: Returns cached results when available
- **Invalid Requests**: Returns helpful error messages

### Fallback Responses
When automated fact-checking fails, the agent provides:
- Manual fact-checking guidelines
- List of recommended resources
- Basic SEO best practices
- Recovery suggestions

## Testing

### Unit Tests
```bash
npm test -- src/test/services/agents/factchecker-agent.test.ts
```

### Integration Tests
```bash
npm test -- src/test/services/agents/factchecker-integration.test.ts
```

### API Tests
```bash
npm test -- src/test/routes/factcheck.test.ts
```

## Performance Metrics

### Key Metrics
- **Request Count**: Total fact-check requests processed
- **Cache Hit Rate**: Percentage of requests served from cache
- **Average Processing Time**: Time per request in milliseconds
- **Error Rate**: Percentage of failed requests
- **Source Credibility**: Average credibility score of sources used

### Health Monitoring
- **API Availability**: Tests search API connectivity
- **LLM Service**: Verifies language model availability
- **Cache Status**: Monitors cache size and hit rates
- **Cost Tracking**: Monitors API usage and costs

## Best Practices

### Content Preparation
- Ensure content contains specific, verifiable claims
- Provide context for better claim extraction
- Use clear, factual language for better analysis

### Result Interpretation
- Review confidence scores for each claim
- Prioritize high-confidence results
- Verify disputed claims manually
- Implement suggested SEO improvements gradually

### Cost Optimization
- Cache frequently fact-checked content
- Batch similar requests when possible
- Monitor API usage regularly
- Use fallback mechanisms appropriately