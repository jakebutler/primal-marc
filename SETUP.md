# Setup Guide

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   - Copy `.env.example` to `.env.local`
   - Fill in all required values (you mentioned you've already done this)

3. **Set up the database**
   ```bash
   # Generate migration files
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   - Navigate to http://localhost:3000
   - Sign in with Clerk
   - Configure your API keys in Settings
   - Start creating blog posts!

## First Time Setup Checklist

- [ ] Install dependencies (`npm install`)
- [ ] Configure `.env.local` with all required keys
- [ ] Run database migrations (`npm run db:migrate`)
- [ ] Start dev server (`npm run dev`)
- [ ] Sign in with Clerk
- [ ] Go to Settings and add your OpenAI or Anthropic API key
- [ ] (Optional) Add Perplexity API key for research
- [ ] Create your first blog post!

## Testing the Workflow

1. **Start a new blog post**
   - Go to home page
   - Enter a blog idea
   - Select a blog type
   - Click "Start Writing"

2. **Voice & Tone Step**
   - Review the 3 generated options
   - Select one and continue

3. **Thesis & Outline Step**
   - Click "Generate Thesis & Outline"
   - Review and edit if needed
   - Continue to Research

4. **Research Step**
   - Click "Find Research Sources"
   - Review sources
   - Continue to Draft

5. **Draft Step**
   - Click "Generate Draft"
   - Review the draft
   - Approve or request changes

6. **Final Step**
   - Review final post
   - Edit SEO metadata if needed
   - Download Markdown

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` in `.env.local`
- Check that NeonDB database is running
- Try running migrations again: `npm run db:migrate`

### API Key Issues
- Make sure you've added your API key in Settings
- Check that the key is valid
- For OpenAI, keys start with `sk-`
- For Anthropic, keys start with `sk-ant-`

### Agent Execution Errors
- Check browser console for errors
- Verify API keys are configured
- Check that prompt files exist in `agents/` directory

### Import Errors
- Run `npm install` again
- Check that all dependencies are installed
- Verify TypeScript compilation: `npm run build`

## Next Steps

Once you have it running:
1. Test the full workflow end-to-end
2. Check database to see data being saved
3. Test error handling (e.g., invalid API key)
4. Try different blog types
5. Test iteration (going back to previous steps)

## Development Tips

- Use `npm run db:studio` to view database in Drizzle Studio
- Check browser DevTools for API errors
- Check server logs in terminal for backend errors
- All agent prompts are in `agents/` directory - you can edit them

