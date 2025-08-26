# Project Structure & Organization

## Monorepo Layout
```
primal-marc/
├── apps/
│   ├── client/          # React frontend (Vercel)
│   └── server/          # Express backend (Fly.io)
├── packages/
│   ├── shared/          # Shared types and utilities
│   └── ui/              # shadcn/ui components
├── prisma/              # Database schema and migrations
├── .kiro/               # Kiro configuration and specs
└── docs/                # Project documentation
```

## Frontend Structure (apps/client/)
```
client/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/          # shadcn/ui base components
│   │   ├── canvas/      # Canvas interface components
│   │   ├── editor/      # Markdown editor components
│   │   └── agents/      # AI agent chat components
│   ├── pages/           # Route components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API client services
│   ├── stores/          # React Query stores
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── public/              # Static assets
└── tests/               # Frontend tests
```

## Backend Structure (apps/server/)
```
server/
├── src/
│   ├── routes/          # Express route handlers
│   ├── services/        # Business logic services
│   │   ├── auth/        # Authentication service
│   │   ├── content/     # Content management
│   │   ├── agents/      # AI agent orchestrator
│   │   └── llm/         # LLM integration service
│   ├── middleware/      # Express middleware
│   ├── models/          # Database models (Prisma)
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Utility functions
├── prisma/              # Database schema
└── tests/               # Backend tests
```

## AI Agent Organization
```
agents/
├── orchestrator.ts      # Central agent coordinator
├── ideation/           # Ideation agent implementation
├── refiner/            # Draft refinement agent
├── media/              # Media generation agent
└── factchecker/        # Fact-checking & SEO agent
```

## Shared Package Structure
```
packages/shared/
├── types/              # Common TypeScript interfaces
├── constants/          # Shared constants
├── utils/              # Cross-platform utilities
└── validation/         # Shared validation schemas
```

## Configuration Files
- `package.json` - Workspace configuration and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `vite.config.ts` - Vite build configuration
- `fly.toml` - Fly.io deployment configuration
- `vercel.json` - Vercel deployment configuration

## Key Conventions
- Use TypeScript for all code
- Follow React functional component patterns
- Implement proper error boundaries
- Use shadcn/ui components for consistent UI
- Keep AI agent logic modular and testable
- Maintain cost-conscious architecture decisions
- Prioritize mobile-first responsive design