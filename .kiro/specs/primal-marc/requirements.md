# Requirements Document

## Introduction

Primal Marc is a mobile-friendly web application that serves as a comprehensive writing assistant, helping users through four distinct phases of the writing process: early ideation and concept structuring, draft refinement for structure and style, media and visual content creation, and fact-checking with SEO optimization. The application uses a canvas-based collaborative interface similar to ChatGPT, where users and AI agents work together on content stored in markdown format. The application is designed as a cost-effective hobby project utilizing Vercel for frontend deployment, Fly.io for backend services, and PromptLayer for cost-managed LLM integrations.

## Requirements

### Requirement 1: Early Ideation and Concept Structuring

**User Story:** As a writer, I want an AI thought partner to help me develop and structure my initial ideas, so that I can overcome writer's block and create a solid foundation for my writing.

#### Acceptance Criteria

1. WHEN a user starts a new writing project THEN the system SHALL provide an interactive ideation interface
2. WHEN a user has no initial ideas THEN the system SHALL offer thought-provoking prompts and questions to spark creativity
3. WHEN a user shares rough ideas THEN the system SHALL engage in conversational brainstorming to help develop concepts
4. WHEN concepts are developed THEN the system SHALL help structure ideas into a logical framework
5. IF a user gets stuck during ideation THEN the system SHALL provide alternative approaches or perspectives

### Requirement 2: Draft Refinement for Structure and Style

**User Story:** As a writer, I want assistance refining my draft's overall structure and writing style with personalized guidance, so that my arguments are clear and my voice matches my intended style.

#### Acceptance Criteria

1. WHEN a user submits a draft THEN the system SHALL analyze the overall argument structure and flow
2. WHEN structural issues are identified THEN the system SHALL provide specific suggestions for reorganization
3. WHEN style guidance is needed THEN the system SHALL ask the user to specify their preferred style through writer references, style descriptions, or example text
4. WHEN a user references other writers THEN the system SHALL adapt suggestions to match those writing styles
5. WHEN style inconsistencies are detected THEN the system SHALL recommend adjustments based on the user's specified preferences
6. IF the argument lacks clarity THEN the system SHALL suggest ways to strengthen logical connections

### Requirement 3: Media, Memes, and Charts Assistant

**User Story:** As a writer, I want AI assistance creating relevant visual content including memes, sourced images, and original media, so that my writing is engaging and visually compelling.

#### Acceptance Criteria

1. WHEN content needs visual enhancement THEN the system SHALL suggest relevant meme formats and create meme images
2. WHEN charts or data visualization is needed THEN the system SHALL source appropriate charts from the web or create original ones
3. WHEN images are required THEN the system SHALL generate original images or source relevant existing images
4. WHEN memes are created THEN the system SHALL use popular, recognizable meme formats
5. WHEN visual content is added THEN it SHALL be properly integrated into the markdown content
6. IF visual content cannot be sourced THEN the system SHALL create original alternatives

### Requirement 4: Fact-Checking and SEO Assistant

**User Story:** As a writer, I want my content fact-checked and optimized for SEO, so that my writing is credible and discoverable online.

#### Acceptance Criteria

1. WHEN a draft contains factual claims THEN the system SHALL identify and research each claim for accuracy
2. WHEN facts are verified THEN the system SHALL provide source citations and links
3. WHEN conflicting information exists THEN the system SHALL present alternative viewpoints with sources
4. WHEN SEO optimization is requested THEN the system SHALL suggest relevant internal and external links
5. WHEN content is analyzed THEN the system SHALL recommend connections to other blog posts and authoritative sources
6. IF factual errors are found THEN the system SHALL provide corrected information with reliable sources

### Requirement 5: Canvas-Based Collaborative Interface

**User Story:** As a writer, I want a canvas-based collaborative interface where I can work with AI agents on my content, so that the writing process feels natural and interactive.

#### Acceptance Criteria

1. WHEN using the application THEN the interface SHALL provide a canvas-style workspace similar to ChatGPT
2. WHEN collaborating with AI agents THEN the conversation and content editing SHALL happen in the same interface
3. WHEN content is created or edited THEN it SHALL be stored and displayed in markdown format
4. WHEN accessing the application on mobile devices THEN the canvas interface SHALL be fully responsive and touch-optimized
5. WHEN switching between devices THEN user progress SHALL be synchronized across platforms
6. IF network connectivity is poor THEN the system SHALL gracefully handle intermittent connections

### Requirement 6: Workflow Integration

**User Story:** As a writer, I want to seamlessly move between the four writing phases, so that I can maintain momentum throughout my writing process.

#### Acceptance Criteria

1. WHEN completing ideation THEN the user SHALL be able to transition smoothly to draft refinement
2. WHEN draft refinement is complete THEN the user SHALL be able to proceed to media creation or fact-checking
3. WHEN media creation is complete THEN the user SHALL be able to proceed to fact-checking and SEO optimization
4. WHEN moving between phases THEN all previous work SHALL be preserved and accessible
5. WHEN returning to earlier phases THEN the user SHALL be able to make revisions that propagate forward
6. IF the user wants to skip phases THEN the system SHALL allow flexible workflow navigation

### Requirement 7: User Authentication and Account Management

**User Story:** As a user, I want secure authentication and account management, so that my writing projects are private and accessible only to me.

#### Acceptance Criteria

1. WHEN accessing the application THEN users SHALL be required to authenticate
2. WHEN creating an account THEN the system SHALL securely store user credentials
3. WHEN logging in THEN the system SHALL verify user identity and provide secure session management
4. WHEN managing account settings THEN users SHALL be able to update their profile and preferences
5. WHEN data is stored THEN it SHALL be associated with the authenticated user account
6. IF authentication fails THEN the system SHALL provide clear error messages and recovery options

### Requirement 8: Cost-Effective LLM Integration and Management

**User Story:** As a hobby project owner, I want cost-effective LLM integration with proper cost monitoring and usage optimization, so that the AI features remain within budget while providing value.

#### Acceptance Criteria

1. WHEN integrating with LLMs THEN the system SHALL use PromptLayer for cost tracking and prompt optimization
2. WHEN AI agents are invoked THEN all interactions SHALL be logged with cost attribution and usage metrics
3. WHEN prompts are executed THEN the system SHALL optimize for cost-effectiveness while maintaining quality
4. WHEN usage approaches budget limits THEN the system SHALL implement rate limiting and user notifications
5. WHEN managing prompts THEN the system SHALL prioritize cost-efficient models and prompt engineering
6. IF LLM costs exceed budget THEN the system SHALL gracefully limit functionality with clear user communication

### Requirement 9: Content Management

**User Story:** As a writer, I want to save, organize, and manage multiple writing projects, so that I can work on different pieces over time.

#### Acceptance Criteria

1. WHEN creating content THEN the system SHALL automatically save progress
2. WHEN managing multiple projects THEN the user SHALL be able to organize and categorize their work
3. WHEN searching for content THEN the user SHALL be able to find projects by title, topic, or date
4. WHEN exporting content THEN the user SHALL be able to download in multiple formats
5. IF data loss occurs THEN the system SHALL have backup and recovery mechanisms
### 
Requirement 10: Cost-Effective Infrastructure

**User Story:** As a hobby project owner, I want to deploy and run the application within a limited budget using available free and low-cost resources, so that the project remains financially sustainable.

#### Acceptance Criteria

1. WHEN deploying the frontend THEN the system SHALL use Vercel's free tier for static hosting
2. WHEN deploying the backend THEN the system SHALL use Fly.io credits efficiently with resource optimization
3. WHEN storing data THEN the system SHALL use cost-effective database solutions within free tier limits
4. WHEN handling media THEN the system SHALL optimize storage costs through compression and efficient formats
5. WHEN scaling THEN the system SHALL implement usage-based scaling to stay within budget constraints
6. IF resource limits are approached THEN the system SHALL provide usage monitoring and optimization suggestions