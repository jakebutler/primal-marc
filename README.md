# Primal Marc

Who knows where thoughts come from? They just appear. Damn the man. Save your writing.

## Features

- **Early Ideation & Concept Structuring** - AI thought partner for brainstorming and organizing initial ideas
- **Draft Refinement** - Structure and style improvement with personalized guidance  
- **Media & Visual Content Creation** - Memes, charts, images, and visual enhancement
- **Fact-Checking & SEO Optimization** - Content verification and search optimization

## Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS + shadcn/ui (Vercel)
- **Backend**: Node.js + Express + TypeScript + Socket.io (Fly.io)
- **Database**: SQLite + Prisma ORM
- **AI**: OpenAI GPT models with PromptLayer for cost tracking

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd primal-marc

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npm run db:migrate

# Start development servers
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev          # Start both client and server
npm run dev:client   # Start frontend only
npm run dev:server   # Start backend only

# Building
npm run build        # Build both client and server
npm run build:client # Build frontend
npm run build:server # Build backend

# Testing
npm test             # Run all tests
npm run test:client  # Run frontend tests
npm run test:server  # Run backend tests

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:reset     # Reset database
npm run db:studio    # Open Prisma Studio

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

### Project Structure

```
primal-marc/
├── apps/
│   ├── client/          # React frontend
│   └── server/          # Express backend
├── packages/
│   ├── shared/          # Shared types and utilities
│   └── ui/              # shadcn/ui components
├── prisma/              # Database schema
├── .kiro/               # Kiro configuration and specs
└── docs/                # Documentation
```

## Deployment

### Frontend (Vercel)

```bash
npm run deploy:client
```

### Backend (Fly.io)

```bash
npm run deploy:server
```

## Cost Optimization

This project is designed with a $50 budget constraint:

- SQLite database (no hosting costs)
- Vercel free tier for frontend
- Fly.io shared-cpu-1x instance ($5-10/month)
- PromptLayer for LLM cost tracking
- Aggressive caching to reduce API calls

## Contributing

1. Follow the TDD approach outlined in `.kiro/steering/development.md`
2. Use conventional commits
3. Ensure all tests pass
4. Update documentation as needed

## License

MIT