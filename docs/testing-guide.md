# Testing Guide

This document outlines the comprehensive testing strategy for Primal Marc, covering unit tests, integration tests, end-to-end tests, accessibility testing, and performance testing.

## Testing Philosophy

We follow a test-driven development (TDD) approach with the testing pyramid:
- **Unit Tests (70%)**: Fast, isolated tests for individual components and functions
- **Integration Tests (20%)**: Tests for API endpoints and component interactions
- **End-to-End Tests (10%)**: Full user journey tests across browsers and devices

## Test Structure

```
apps/
├── client/src/test/
│   ├── components/          # Component unit tests
│   ├── hooks/              # Custom hook tests
│   ├── services/           # API service tests
│   ├── integration/        # Frontend integration tests
│   ├── accessibility/      # WCAG compliance tests
│   ├── performance/        # Performance tests
│   └── setup.ts           # Test configuration
├── server/src/test/
│   ├── routes/            # API endpoint tests
│   ├── services/          # Business logic tests
│   ├── models/            # Database model tests
│   ├── middleware/        # Middleware tests
│   ├── integration/       # Backend integration tests
│   ├── security/          # Security tests
│   └── setup.ts          # Test configuration
└── e2e/                   # End-to-end tests
    ├── auth.spec.ts       # Authentication flows
    ├── canvas-workflow.spec.ts  # Main user workflows
    └── cross-browser.spec.ts    # Cross-browser compatibility
```

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run frontend unit tests only
npm run test:client

# Run backend unit tests only
npm run test:server

# Run tests in watch mode
npm run test:client -- --watch
npm run test:server -- --watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration
```

### End-to-End Tests
```bash
# Run all e2e tests
npm run test:e2e

# Run e2e tests for specific browser
npm run test:e2e -- --project=chromium

# Run e2e tests in headed mode
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- auth.spec.ts
```

### Accessibility Tests
```bash
# Run accessibility tests
npm run test:a11y

# Run accessibility tests with detailed output
npm run test:a11y -- --reporter=verbose
```

### Performance Tests
```bash
# Run Lighthouse CI
npx lhci autorun

# Run performance tests
npm run test:performance
```

## Test Coverage Requirements

### Frontend (Client)
- **Minimum Coverage**: 80% for branches, functions, lines, and statements
- **Critical Components**: 90%+ coverage required
- **UI Components**: Must pass accessibility tests

### Backend (Server)
- **Minimum Coverage**: 75% for branches, functions, lines, and statements
- **API Endpoints**: 90%+ coverage required
- **Security Functions**: 100% coverage required

## Writing Tests

### Unit Test Example
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Button } from '@/components/ui/button'

test('Button handles click events', () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click me</Button>)
  
  fireEvent.click(screen.getByRole('button'))
  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

### Integration Test Example
```typescript
import request from 'supertest'
import { app } from '../src/app'

test('POST /api/projects creates project', async () => {
  const response = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ title: 'Test Project' })
    .expect(201)
    
  expect(response.body.title).toBe('Test Project')
})
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test'

test('User can create and edit project', async ({ page }) => {
  await page.goto('/dashboard')
  await page.click('text=New Project')
  await page.fill('[data-testid="title"]', 'My Project')
  await page.click('button[type="submit"]')
  
  await expect(page).toHaveURL(/\/canvas\/.*/)
})
```

## Accessibility Testing

We use `jest-axe` for automated accessibility testing and follow WCAG 2.1 AA guidelines:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

test('Component meets WCAG guidelines', async () => {
  const { container } = render(<MyComponent />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Accessibility Checklist
- [ ] Color contrast meets WCAG AA standards (4.5:1 for normal text)
- [ ] All interactive elements are keyboard accessible
- [ ] Proper ARIA labels and roles are implemented
- [ ] Form fields have associated labels
- [ ] Images have alt text
- [ ] Headings follow proper hierarchy
- [ ] Focus indicators are visible

## Performance Testing

### Core Web Vitals Targets
- **First Contentful Paint (FCP)**: < 3 seconds
- **Largest Contentful Paint (LCP)**: < 4 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Total Blocking Time (TBT)**: < 300ms

### Lighthouse Scores
- **Performance**: > 80
- **Accessibility**: > 90
- **Best Practices**: > 80
- **SEO**: > 80
- **PWA**: > 70

## Cross-Browser Testing

We test across:
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Android Chrome
- **Tablets**: iPad, Android tablets

### Device Testing Matrix
| Device | Viewport | Primary Tests |
|--------|----------|---------------|
| Desktop Chrome | 1920x1080 | Full functionality |
| Desktop Firefox | 1920x1080 | Full functionality |
| Desktop Safari | 1920x1080 | Full functionality |
| iPhone 12 | 390x844 | Mobile UX, touch |
| Pixel 5 | 393x851 | Mobile UX, touch |
| iPad Pro | 1024x1366 | Tablet layout |

## Continuous Integration

Our CI pipeline runs:
1. **Lint and Format Check**
2. **Unit Tests** (with coverage)
3. **Integration Tests**
4. **E2E Tests** (across browsers)
5. **Accessibility Tests**
6. **Security Scans**
7. **Performance Tests**

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No accessibility violations
- Performance budgets must be met
- Security scans must pass

## Test Data Management

### Frontend Tests
- Use MSW (Mock Service Worker) for API mocking
- Create reusable test fixtures
- Clean up after each test

### Backend Tests
- Use separate test database
- Seed test data before each test
- Clean database after each test
- Mock external services (LLM APIs, etc.)

### E2E Tests
- Use test user accounts
- Create and clean up test data
- Use page object model for maintainability

## Debugging Tests

### Frontend
```bash
# Debug in browser
npm run test:client -- --ui

# Debug specific test
npm run test:client -- --run button.test.tsx
```

### Backend
```bash
# Debug with inspector
npm run test:server -- --inspect-brk

# Verbose output
npm run test:server -- --reporter=verbose
```

### E2E
```bash
# Debug mode (headed browser)
npm run test:e2e -- --debug

# Step through tests
npm run test:e2e -- --headed --slowMo=1000
```

## Best Practices

### General
- Write tests before implementation (TDD)
- Keep tests simple and focused
- Use descriptive test names
- Test behavior, not implementation
- Mock external dependencies

### Frontend
- Use React Testing Library for user-centric tests
- Test accessibility in every component test
- Mock API calls consistently
- Test error states and loading states

### Backend
- Test all API endpoints
- Test error handling and edge cases
- Use proper HTTP status codes in assertions
- Test authentication and authorization

### E2E
- Focus on critical user journeys
- Keep tests independent
- Use data attributes for selectors
- Test across different screen sizes

## Maintenance

### Regular Tasks
- Update test dependencies monthly
- Review and update test coverage thresholds
- Audit and remove flaky tests
- Update cross-browser test matrix
- Review performance budgets

### When Adding Features
- Write tests first (TDD)
- Ensure accessibility compliance
- Add integration tests for new APIs
- Update E2E tests for new user flows
- Document new testing patterns

This comprehensive testing strategy ensures high code quality, accessibility compliance, and excellent user experience across all devices and browsers while maintaining cost-effective development practices.