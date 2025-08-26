# Technology Stack & Build System

## Architecture
Simplified monolithic architecture optimized for hobby project constraints with cost-effective deployment.

## Frontend Stack
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Editor**: Monaco Editor for markdown editing with syntax highlighting
- **State Management**: React Query for caching and state
- **Real-time**: Socket.io client
- **PWA**: Workbox for offline capabilities
- **Build Tool**: Vite
- **Deployment**: Vercel (free tier)

## Backend Stack
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM (file-based, no hosting costs)
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.io server
- **Deployment**: Fly.io ($5-10/month, shared-cpu-1x, 256MB RAM)

## AI & External Services
- **LLM Management**: PromptLayer for cost tracking and optimization
- **Primary LLM**: OpenAI GPT-3.5-turbo (cost-effective)
- **Premium LLM**: GPT-4 (budget permitting)
- **Image APIs**: Pexels (free), Cloudinary (free tier)
- **Search APIs**: DuckDuckGo, SerpAPI (free tiers)

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development servers
npm run dev          # Frontend (Vite)
npm run dev:server   # Backend (Express)

# Build for production
npm run build        # Frontend build
npm run build:server # Backend build
```

### Database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Reset database
npx prisma migrate reset

# View database
npx prisma studio
```

### Testing
```bash
# Run all tests
npm test

# Run frontend tests
npm run test:client

# Run backend tests  
npm run test:server

# Run e2e tests
npm run test:e2e
```

### Deployment
```bash
# Deploy frontend to Vercel
npm run deploy:client

# Deploy backend to Fly.io
npm run deploy:server

# Check deployment status
fly status
```

## Cost Optimization Guidelines
- Use SQLite to avoid database hosting costs
- Implement aggressive caching to reduce LLM API calls
- Set PromptLayer budget alerts at $15/month
- Start with Fly.io's smallest instance
- Monitor resource usage with built-in dashboards