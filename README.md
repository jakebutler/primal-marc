# Blog Generator

AI-powered blog writing application that helps users transform rough ideas into professional-quality blog posts through a collaborative workflow with specialized AI agents.

## Features

- **5 Specialized AI Agents**: Voice & Tone, Idea Refiner, Research, Blog Writer, Editorial & SEO
- **5 Blog Types**: Academic, Argumentative, Lessons from Experience, Experiential Metaphor, Systems/Workflow Deep Dive
- **Human-in-the-Loop**: Approval checkpoints at key decision points
- **Full Iteration Support**: Go back to any previous step
- **Research Integration**: Perplexity API with Exa.ai fallback
- **Export**: Markdown export with citations and SEO metadata

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: ShadCN UI + KokonutUI
- **Icons**: Lucide Icons
- **Database**: NeonDB (PostgreSQL) with Drizzle ORM
- **Authentication**: Clerk
- **AI/ML**: LangChain.js
- **Observability**: Opik by Comet.com
- **Analytics**: PostHog

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- NeonDB account
- Clerk account
- OpenAI or Anthropic API key
- Perplexity API key (optional, Exa.ai as fallback)

### Installation

1. **Clone the repository**
   ```bash
   cd blog_generator_project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your environment variables:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
   - `CLERK_SECRET_KEY` - From Clerk dashboard
   - `DATABASE_URL` - From NeonDB dashboard
   - `OPENAI_API_KEY` - Your OpenAI API key (or Anthropic)
   - `PERPLEXITY_API_KEY` - Your Perplexity API key
   - `EXA_API_KEY` - Your Exa.ai API key (optional fallback)
   - `ENCRYPTION_KEY` - Generate a random 32-byte key for API key encryption

4. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
blog_generator_project/
├── agents/                 # Agent prompt templates
│   ├── voice_and_tone_agent.md
│   ├── idea_refiner_agent.md
│   ├── research_agent.md
│   ├── blog_writer_agent.md
│   └── editorial_and_seo_agent.md
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── workflow/      # Workflow endpoints
│   ├── workflow/          # Workflow pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   └── ui/               # ShadCN UI components
├── docs/                  # Documentation
│   ├── api_schema.md
│   ├── database_schema.md
│   ├── error_scenarios.md
│   └── ...
├── lib/                   # Core libraries
│   ├── agents/           # Agent implementations
│   ├── db/               # Database schema and connection
│   ├── workflow/         # Workflow orchestrator
│   └── utils/            # Utility functions
├── prd.md                # Product Requirements Document
└── package.json
```

## Implementation Status

### ✅ Completed

- Project setup and configuration
- Database schema with Drizzle ORM
- All 5 agent implementations (LangChain.js)
- Workflow orchestrator
- Complete API route structure
- Basic UI components (Button, Card)
- Home page with idea submission
- Clerk authentication integration
- Encryption utilities for API keys

### 🚧 In Progress

- Complete UI for each workflow step
- Progress indicator component
- Error handling UI
- Loading states

### 📋 Remaining

- Step-specific UI components for each workflow stage
- API key management UI
- Settings page
- Blog posts list page
- Enhanced error handling
- Opik observability integration
- PostHog analytics integration
- Template system
- Export download functionality

## API Endpoints

### Workflow

- `POST /api/workflow/initialize` - Initialize new blog post
- `GET /api/workflow/[blogPostId]/state` - Get workflow state
- `POST /api/workflow/[blogPostId]/voice-tone` - Generate voice/tone options
- `PUT /api/workflow/[blogPostId]/voice-tone` - Select voice/tone
- `POST /api/workflow/[blogPostId]/thesis` - Generate thesis and outline
- `PUT /api/workflow/[blogPostId]/thesis` - Approve thesis
- `POST /api/workflow/[blogPostId]/research` - Research sources
- `PUT /api/workflow/[blogPostId]/research` - Approve research
- `POST /api/workflow/[blogPostId]/draft` - Generate draft
- `PUT /api/workflow/[blogPostId]/draft` - Approve draft
- `POST /api/workflow/[blogPostId]/editorial` - Final editing
- `GET /api/workflow/[blogPostId]/export` - Export markdown

## Development

### Database Migrations

```bash
# Generate migration
npm run db:generate

# Run migration
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

### Adding New Agents

1. Create prompt template in `agents/`
2. Create agent class in `lib/agents/`
3. Add to workflow orchestrator
4. Create API route if needed

## Environment Variables

See `.env.example` for all required environment variables.

## Documentation

- [PRD](prd.md) - Complete product requirements
- [API Schema](docs/api_schema.md) - API documentation
- [Database Schema](docs/database_schema.md) - Database structure
- [Error Scenarios](docs/error_scenarios.md) - Error handling
- [Integration Research](docs/integration_research.md) - LLM and API integrations

## License

[Your License Here]

## Support

For issues and questions, please open an issue in the repository.

