# Manual QA Instructions for Primal Marc

This document provides step-by-step instructions for manually testing all functionality in the Primal Marc application.

## Prerequisites

- Node.js 18+ installed
- Git installed
- A Pexels API key (already configured in .env)
- OpenAI API key (already configured in .env)
- PromptLayer API key (already configured in .env)

## Initial Setup

### 1. Environment Setup
```bash
# Verify environment files exist
ls -la .env .env.example

# Check that all required environment variables are set
cat .env
```

**Expected variables:**
- `DATABASE_URL`
- `JWT_SECRET` 
- `JWT_REFRESH_SECRET`
- `OPENAI_API_KEY`
- `PROMPTLAYER_API_KEY`
- `PEXELS_API_KEY`
- `CLOUDINARY_*` keys
- `SERPAPI_KEY`
- `CLIENT_URL`

### 2. Install Dependencies
```bash
# Install all dependencies
npm install

# Verify installation completed successfully
npm list --depth=0
```

### 3. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Verify database was created
ls -la prisma/dev.db
```

## Starting the Application

### 1. Start Backend Server
```bash
# In terminal 1
npm run dev:server

# Expected output:
# - Server starting on port 3001
# - Database connected
# - No error messages
```

**✅ Verify:**
- Server starts without errors
- Port 3001 is accessible
- Database connection successful

### 2. Start Frontend Client
```bash
# In terminal 2
npm run dev

# Expected output:
# - Vite dev server starting
# - Local server on http://localhost:3000
# - No compilation errors
```

**✅ Verify:**
- Frontend builds successfully
- No TypeScript errors
- Development server accessible at http://localhost:3000

## Authentication Testing

### 1. User Registration
1. Navigate to http://localhost:3000
2. Click "Sign Up" or navigate to registration
3. Fill out registration form:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Confirm password
4. Submit form

**✅ Verify:**
- Form validation works
- Registration succeeds
- User is redirected to dashboard/main app
- JWT tokens are stored (check browser dev tools > Application > Local Storage)

### 2. User Login
1. Log out if logged in
2. Navigate to login page
3. Enter credentials:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
4. Submit form

**✅ Verify:**
- Login succeeds
- User is redirected to main app
- Authentication state persists on page refresh

### 3. Protected Routes
1. While logged out, try to access protected routes
2. While logged in, verify access to protected content

**✅ Verify:**
- Unauthenticated users are redirected to login
- Authenticated users can access all features

## Canvas Interface Testing

### 1. Canvas Loading
1. Navigate to main canvas interface
2. Verify canvas loads properly

**✅ Verify:**
- Canvas interface renders
- No JavaScript errors in console
- UI components load correctly

### 2. Chat Functionality
1. Type a message in the chat input
2. Send the message
3. Verify AI response

**✅ Verify:**
- Messages appear in chat
- AI responses are generated
- Chat history persists
- Real-time updates work

## AI Agent Testing

### 1. Ideation Agent
1. Start a new conversation
2. Ask for help with brainstorming: "Help me brainstorm ideas for a blog post about sustainable living"
3. Follow up with refinement requests

**✅ Verify:**
- Agent responds with relevant ideas
- Conversation flows naturally
- Ideas are creative and useful
- Agent maintains context

### 2. Draft Refinement Agent
1. Provide a rough draft: "Here's my draft: Sustainable living is important. We should recycle more. The end."
2. Ask for refinement help
3. Request specific improvements

**✅ Verify:**
- Agent provides constructive feedback
- Suggestions improve content quality
- Agent maintains original intent
- Multiple refinement rounds work

### 3. Media Generation Agent
1. Ask for image suggestions: "I need images for my article about sustainable living"
2. Request meme creation: "Create a funny meme about recycling"
3. Ask for chart generation: "Create a chart showing recycling statistics"

**✅ Verify:**
- Image search returns relevant results from Pexels
- Meme suggestions are appropriate
- Chart generation works with provided data
- Fallback suggestions provided when APIs fail

### 4. Fact-Checking Agent
1. Provide content with factual claims: "Solar panels are 95% efficient and cost $100 to install"
2. Ask for fact-checking
3. Request source verification

**✅ Verify:**
- Agent identifies questionable claims
- Provides accurate corrections
- Suggests reliable sources
- SEO recommendations included

## Media Service Testing

### 1. Image Search (Pexels Integration)
1. Test image search functionality
2. Try various search terms
3. Verify attribution and licensing info

**✅ Verify:**
- Pexels API integration works
- Images load correctly
- Attribution is properly displayed
- Fallback works when API fails

### 2. Meme Generation
1. Test meme template selection
2. Generate memes with custom text
3. Verify meme quality and format

**✅ Verify:**
- Meme templates load
- Text overlay works correctly
- Generated memes are downloadable
- Various templates available

### 3. Chart Generation
1. Provide data for chart creation
2. Test different chart types
3. Verify chart customization options

**✅ Verify:**
- Charts generate correctly
- Data is accurately represented
- Multiple chart types work
- Charts are exportable

## Error Handling Testing

### 1. Network Errors
1. Disconnect internet
2. Try to use AI features
3. Reconnect and verify recovery

**✅ Verify:**
- Graceful error messages
- No application crashes
- Automatic recovery when connection restored

### 2. API Failures
1. Use invalid API keys (temporarily modify .env)
2. Test application behavior
3. Restore valid keys

**✅ Verify:**
- Fallback mechanisms activate
- User-friendly error messages
- Application remains functional

### 3. Invalid Input
1. Submit empty forms
2. Provide malformed data
3. Test edge cases

**✅ Verify:**
- Input validation works
- Clear error messages
- No security vulnerabilities

## Performance Testing

### 1. Load Times
1. Measure initial page load
2. Test navigation between pages
3. Monitor resource usage

**✅ Verify:**
- Pages load within 3 seconds
- Smooth navigation
- Reasonable memory usage

### 2. AI Response Times
1. Time AI agent responses
2. Test with various prompt lengths
3. Monitor API usage

**✅ Verify:**
- Responses within 10 seconds
- Consistent performance
- API costs remain reasonable

## Mobile Responsiveness

### 1. Mobile Testing
1. Test on mobile device or browser dev tools
2. Verify all functionality works
3. Check UI/UX on small screens

**✅ Verify:**
- Responsive design works
- Touch interactions function
- Text is readable
- Navigation is accessible

## Data Persistence

### 1. Content Saving
1. Create content in the application
2. Refresh the page
3. Verify content persists

**✅ Verify:**
- User data saves correctly
- Content survives page refresh
- Database operations work

### 2. Session Management
1. Log in and use the app
2. Close browser and reopen
3. Verify session state

**✅ Verify:**
- Sessions persist appropriately
- Automatic logout after timeout
- Secure token handling

## Security Testing

### 1. Authentication Security
1. Try to access APIs without authentication
2. Test with invalid tokens
3. Verify CORS settings

**✅ Verify:**
- Protected endpoints require auth
- Invalid tokens are rejected
- CORS properly configured

### 2. Input Sanitization
1. Try to inject malicious content
2. Test XSS prevention
3. Verify SQL injection protection

**✅ Verify:**
- User input is sanitized
- No XSS vulnerabilities
- Database queries are safe

## Final Checklist

- [ ] All environment variables configured
- [ ] Database setup completed
- [ ] Frontend and backend start successfully
- [ ] User registration/login works
- [ ] All AI agents respond correctly
- [ ] Media services function properly
- [ ] Error handling is graceful
- [ ] Performance is acceptable
- [ ] Mobile responsiveness verified
- [ ] Data persistence works
- [ ] Security measures effective
- [ ] No console errors or warnings

## Troubleshooting

### Common Issues

**Server won't start:**
- Check environment variables
- Verify database file exists
- Ensure port 3001 is available

**Frontend build errors:**
- Run `npm install` again
- Check for TypeScript errors
- Verify all dependencies installed

**AI agents not responding:**
- Check OpenAI API key validity
- Verify PromptLayer configuration
- Check network connectivity

**Database errors:**
- Run `npx prisma migrate reset`
- Regenerate Prisma client
- Check database file permissions

### Getting Help

If you encounter issues:
1. Check the console for error messages
2. Verify environment configuration
3. Review the logs for detailed error information
4. Ensure all dependencies are properly installed

## Success Criteria

The application passes QA when:
- All major features work without errors
- Performance meets acceptable standards
- Security measures are effective
- User experience is smooth and intuitive
- Error handling is graceful and informative