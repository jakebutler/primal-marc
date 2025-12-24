# Deployment Guide - Primal Marc

This guide walks through deploying Primal Marc to production using Vercel (frontend) and Fly.io (AI worker).

## Architecture

```
┌──────────────────┐         ┌──────────────────┐
│   Vercel Free    │         │    Fly.io        │
│   (Next.js App)  │  HTTP   │  (AI Worker)     │
│                  │────────▶│                  │
│  - UI/Frontend   │         │  - LLM Calls     │
│  - Auth (Clerk)  │◀────────│  - Long-running  │
│  - Quick APIs    │         │    operations    │
│  - DB queries    │         │  - No timeout    │
└──────────────────┘         └──────────────────┘
        │                            │
        ▼                            ▼
┌──────────────────┐         ┌──────────────────┐
│   Neon Database  │◀────────│  External APIs   │
│   (PostgreSQL)   │         │  (OpenAI, etc.)  │
└──────────────────┘         └──────────────────┘
```

## Prerequisites

1. GitHub repository with the code
2. Fly.io account with $50 credit
3. Vercel account (free tier)
4. Neon database (free tier)
5. Clerk account (free tier)
6. Domain access to corvolabs.com DNS settings

## Step 1: Deploy AI Worker to Fly.io

### 1.1 Install Fly CLI

```bash
brew install flyctl
# Or see: https://fly.io/docs/getting-started/installing-flyctl/
```

### 1.2 Login to Fly.io

```bash
fly auth login
```

### 1.3 Generate Worker API Secret

```bash
openssl rand -hex 32
```

Save this value - you'll need it for both Fly.io and Vercel.

### 1.4 Deploy Worker

```bash
cd ai-worker

# Initialize Fly.io app
fly launch --name primal-marc-worker

# Set required secrets
fly secrets set WORKER_API_SECRET=<secret-from-1.3>
fly secrets set DATABASE_URL=<your-neon-connection-string>
fly secrets set ENCRYPTION_KEY=<same-key-as-vercel>

# Optional: Set fallback API keys
fly secrets set OPENAI_API_KEY=<key>  # Optional
fly secrets set ANTHROPIC_API_KEY=<key>  # Optional
fly secrets set PERPLEXITY_API_KEY=<key>  # Optional
fly secrets set EXA_API_KEY=<key>  # Optional

# Deploy
fly deploy
```

### 1.5 Verify Worker

```bash
# Check status
fly status

# Get worker URL (something like: https://primal-marc-worker.fly.dev)
fly info

# Test health endpoint
curl https://primal-marc-worker.fly.dev/health
```

**Save the worker URL** - you'll need it for Vercel configuration.

## Step 2: Configure Clerk for Production

### 2.1 Create Production Application

1. Go to [clerk.com/dashboard](https://clerk.com/dashboard)
2. Create a new application or use existing
3. Switch to Production mode if needed

### 2.2 Configure Allowed Origins

In Clerk Dashboard → Settings → API Keys:
- Add `https://primalmarc.corvolabs.com` to allowed origins
- Add `https://*.vercel.app` if using Vercel preview URLs

### 2.3 Get Clerk Keys

Copy these from Clerk Dashboard:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Step 3: Generate Encryption Key

```bash
openssl rand -hex 32
```

**Important**: Use the same encryption key for both Vercel and Fly.io so they can decrypt the same user API keys.

## Step 4: Deploy Frontend to Vercel

### 4.1 Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Set root directory to: `blog_generator_project`
4. Framework preset: Next.js (auto-detected)

### 4.2 Configure Environment Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Your Neon connection string | |
| `ENCRYPTION_KEY` | Generated in Step 3 | Same as Fly.io |
| `AI_WORKER_URL` | `https://primal-marc-worker.fly.dev` | From Step 1.5 |
| `WORKER_API_SECRET` | Generated in Step 1.3 | Same as Fly.io |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk | Step 2.3 |
| `CLERK_SECRET_KEY` | From Clerk | Step 2.3 |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | |
| `OPENAI_API_KEY` | Optional | Fallback if users don't configure |
| `ANTHROPIC_API_KEY` | Optional | Fallback if users don't configure |
| `PERPLEXITY_API_KEY` | Optional | For research feature |
| `EXA_API_KEY` | Optional | Alternative research API |
| `OPIK_API_KEY` | Optional | For tracing |
| `OPIK_PROJECT_NAME` | `blog-generator` | Optional |

### 4.3 Deploy

Vercel will automatically deploy on push to the main branch, or you can click "Deploy" in the dashboard.

## Step 5: Configure Custom Domain

### 5.1 Add Domain in Vercel

1. Go to Project Settings → Domains
2. Add `primalmarc.corvolabs.com`
3. Vercel will show DNS records needed

### 5.2 Configure DNS

Add this record in your DNS provider (where corvolabs.com is hosted):

**Type:** CNAME  
**Name:** `primalmarc`  
**Value:** `cname.vercel-dns.com`

Or if using apex domain:

**Type:** A  
**Name:** `primalmarc`  
**Value:** `76.76.21.21`

### 5.3 Wait for SSL

Vercel automatically provisions SSL certificates - this can take a few minutes.

### 5.4 Update Clerk Settings

Once the domain is live, update Clerk:
- Sign-in URL: `https://primalmarc.corvolabs.com/sign-in`
- Sign-up URL: `https://primalmarc.corvolabs.com/sign-up`
- After sign-in URL: `https://primalmarc.corvolabs.com`

## Step 6: Database Migration

Ensure your Neon database has all migrations applied:

```bash
cd blog_generator_project
npm install
npm run db:migrate
```

## Step 7: Test Deployment

### 7.1 Health Checks

- Worker: `curl https://primal-marc-worker.fly.dev/health`
- Frontend: Visit `https://primalmarc.corvolabs.com`

### 7.2 End-to-End Test

1. Visit `https://primalmarc.corvolabs.com`
2. Sign in with Clerk
3. Configure API keys in Settings
4. Create a test blog post
5. Complete the full workflow:
   - Select voice/tone
   - Generate thesis
   - Run research
   - Generate draft
   - Complete editorial review

## Troubleshooting

### Worker Not Responding

```bash
# Check logs
fly logs

# Restart worker
fly apps restart primal-marc-worker
```

### Database Connection Issues

- Verify `DATABASE_URL` is correct in both Vercel and Fly.io
- Check Neon dashboard for connection status
- Ensure IP allowlisting is configured (if needed)

### Authentication Errors

- Verify Clerk keys are correct
- Check Clerk dashboard for allowed origins
- Ensure domain matches exactly

### Worker Timeout Errors

- Check Fly.io logs: `fly logs`
- Verify worker URL is correct in Vercel env vars
- Test worker directly: `curl -X POST https://primal-marc-worker.fly.dev/health -H "Authorization: Bearer <secret>"`

## Estimated Costs

| Service | Monthly Cost |
|---------|--------------|
| Vercel | $0 (Free tier) |
| Fly.io | ~$2.50 (covered by $50 credit for ~20 months) |
| Neon | $0 (Free tier, 0.5GB) |
| Clerk | $0 (Free up to 10k MAU) |
| **Total** | **~$2.50/month** (from credits) |

## Monitoring

- **Vercel**: Dashboard shows deployment status and logs
- **Fly.io**: `fly logs` or dashboard shows worker logs
- **Neon**: Dashboard shows database metrics
- **Clerk**: Dashboard shows authentication events

## Updating the Deployment

### Update Frontend

```bash
git push origin main
# Vercel auto-deploys
```

### Update Worker

```bash
cd ai-worker
# Make changes
fly deploy
```

