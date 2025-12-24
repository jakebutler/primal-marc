# Blog Generator Project Documentation

This directory contains comprehensive documentation for the Blog Generator application.

## Documentation Index

### Core Documentation

1. **[PRD (Product Requirements Document)](../prd.md)**
   - Complete product specification
   - Technical architecture
   - User stories and workflows
   - Design system
   - Implementation phases

### Technical Documentation

2. **[Agent Prompts Review](agent_prompts_review.md)**
   - Review of all agent prompts
   - Alignment with PRD requirements
   - Validation status
   - Recommendations for improvements

3. **[API Schema](api_schema.md)**
   - Complete API endpoint specifications
   - Request/response formats
   - Error codes
   - Rate limiting
   - Authentication

4. **[Database Schema](database_schema.md)**
   - Complete database schema
   - Table definitions
   - Relationships and constraints
   - Indexes and performance considerations
   - Migration strategy

5. **[Integration Research](integration_research.md)**
   - LLM provider recommendations (OpenAI, Anthropic)
   - Research API integration (Perplexity, Exa.ai)
   - LangChain.js integration patterns
   - Code examples and best practices
   - Cost optimization strategies

### Design & UX Documentation

6. **[UI Wireframes](ui_wireframes.md)**
   - Detailed wireframes for each workflow step
   - Component specifications
   - Design system implementation
   - Mobile responsive considerations
   - Accessibility guidelines

### Operations Documentation

7. **[Error Scenarios](error_scenarios.md)**
   - Comprehensive error handling strategies
   - Error scenarios for each agent
   - API error handling
   - Recovery strategies
   - User communication guidelines

## Quick Reference

### For Developers

Start with:
1. [PRD](../prd.md) - Understand the product
2. [API Schema](api_schema.md) - Understand the API
3. [Database Schema](database_schema.md) - Understand the data model
4. [Integration Research](integration_research.md) - Understand integrations

### For Designers

Start with:
1. [PRD - Design System Section](../prd.md#80-design-system) - Design principles
2. [UI Wireframes](ui_wireframes.md) - Component specifications

### For Product Managers

Start with:
1. [PRD](../prd.md) - Complete product specification
2. [Agent Prompts Review](agent_prompts_review.md) - Agent capabilities
3. [Error Scenarios](error_scenarios.md) - Error handling approach

## Agent Prompts

Agent prompt files are located in the [`../agents/`](../agents/) directory:

- `voice_and_tone_agent.md` - Voice & tone selection
- `idea_refiner_agent.md` - Thesis and outline generation
- `research_agent.md` - Research and source validation
- `blog_writer_agent.md` - Blog post draft generation
- `editorial_and_seo_agent.md` - Final editing and SEO optimization

## Examples

See [`../examples/`](../examples/) for:
- `minimax_blog.md` - Example workflow walkthrough

## Document Status

All documents are complete and ready for implementation. Documents will be updated as the project evolves.

## Contributing

When updating documentation:
1. Update the relevant document
2. Update this README if structure changes
3. Ensure consistency across documents
4. Update the PRD if requirements change

