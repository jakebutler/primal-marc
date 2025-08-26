import { test, expect } from '@playwright/test'

test.describe('Canvas Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/auth')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('User can create new project and start ideation', async ({ page }) => {
    // Create new project
    await page.click('text=New Project')
    await page.fill('[data-testid="project-title"]', 'My Test Article')
    await page.click('button[type="submit"]')
    
    // Should navigate to canvas
    await expect(page).toHaveURL(/\/canvas\/.*/)
    
    // Should start in ideation phase
    await expect(page.locator('[data-testid="current-phase"]')).toHaveText('Ideation')
    
    // Send message to ideation agent
    await page.fill('[data-testid="message-input"]', 'I want to write about AI in healthcare')
    await page.click('[data-testid="send-button"]')
    
    // Should see user message
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText('AI in healthcare')
    
    // Should receive agent response
    await expect(page.locator('[data-testid="agent-message"]').last()).toBeVisible({ timeout: 10000 })
  })

  test('User can transition between workflow phases', async ({ page }) => {
    // Assume we have an existing project
    await page.goto('/canvas/test-project-id')
    
    // Complete ideation phase
    await page.click('[data-testid="complete-phase-button"]')
    
    // Move to refinement phase
    await page.click('[data-testid="phase-refinement"]')
    await expect(page.locator('[data-testid="current-phase"]')).toHaveText('Refinement')
    
    // Agent type should change
    await expect(page.locator('[data-testid="agent-type"]')).toHaveText('Draft Refiner')
  })
})