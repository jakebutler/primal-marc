# Primal Marc AI Worker

Microservice for handling long-running LLM operations to avoid serverless timeout limits.

## Architecture

This Express service handles AI agent operations that may exceed serverless function timeout limits (e.g., Vercel's 10s free tier limit). The main Next.js app on Vercel delegates LLM-intensive tasks to this worker.

## Endpoints

- `POST /voice-tone` - Get voice/tone options for a blog type (returns presets)
- `POST /thesis` - Generate thesis and outline
- `POST /research` - Perform research using Perplexity/Exa APIs
- `POST /draft` - Generate full blog draft
- `POST /editorial` - Editorial review and SEO optimization
- `GET /health` - Health check endpoint

All endpoints (except `/health`) require authentication via `Authorization: Bearer <WORKER_API_SECRET>` header.

## Environment Variables

Required:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `WORKER_API_SECRET` - Shared secret for authenticating requests from Vercel
- `ENCRYPTION_KEY` - Key for decrypting user API keys from database

Optional (fallback if user keys not configured):
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `PERPLEXITY_API_KEY` - Perplexity API key for research
- `EXA_API_KEY` - Exa API key for research (alternative to Perplexity)
- `OPIK_API_KEY` - Opik API key for tracing (optional)
- `OPIK_PROJECT_NAME` - Opik project name (default: "blog-generator-worker")

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode (with watch)
npm run dev

# Build
npm run build

# Run production build
npm start
```

## Deployment to Fly.io

```bash
# Install flyctl
brew install flyctl  # or see https://fly.io/docs/getting-started/installing-flyctl/

# Login
fly auth login

# Launch the app (first time)
cd ai-worker
fly launch --name primal-marc-worker

# Set secrets
fly secrets set WORKER_API_SECRET=<generated-secret>
fly secrets set DATABASE_URL=<neon-connection-string>
fly secrets set ENCRYPTION_KEY=<encryption-key>
# Optional:
fly secrets set OPENAI_API_KEY=<key>
fly secrets set ANTHROPIC_API_KEY=<key>
fly secrets set PERPLEXITY_API_KEY=<key>
fly secrets set EXA_API_KEY=<key>

# Deploy
fly deploy
```

## Notes

- The worker shares the same database schema as the main app
- User API keys are encrypted in the database and decrypted using `ENCRYPTION_KEY`
- The worker must have the same `ENCRYPTION_KEY` as the main app to decrypt user keys
- Health checks run every 10 seconds on Fly.io

