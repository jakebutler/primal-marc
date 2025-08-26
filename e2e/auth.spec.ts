import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('User can register and login', async ({ page }) => {
    // Navigate to registration
    await page.click('text=Sign Up')
    
    // Fill registration form
    await page.fill('[data-testid="firstName"]', 'John')
    await page.fill('[data-testid="lastName"]', 'Doe')
    await page.fill('[data-testid="email"]', 'john.doe@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    
    // Submit registration
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Welcome, John')).toBeVisible()
  })

  test('User can login with existing account', async ({ page }) => {
    // Navigate to login
    await page.click('text=Sign In')
    
    // Fill login form
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    
    // Submit login
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
  })

  test('Login shows error for invalid credentials', async ({ page }) => {
    await page.click('text=Sign In')
    
    await page.fill('[data-testid="email"]', 'wrong@example.com')
    await page.fill('[data-testid="password"]', 'wrongpassword')
    
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
    
    // Should stay on login page
    await expect(page).toHaveURL('/auth')
  })

  test('Protected routes redirect to login', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/dashboard')
    
    // Should redirect to auth page
    await expect(page).toHaveURL('/auth')
  })

  test('User can logout', async ({ page, context }) => {
    // Login first
    await page.click('text=Sign In')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL('/dashboard')
    
    // Logout
    await page.click('[data-testid="user-menu"]')
    await page.click('text=Logout')
    
    // Should redirect to home
    await expect(page).toHaveURL('/')
    
    // Should clear authentication
    const cookies = await context.cookies()
    const authCookie = cookies.find(cookie => cookie.name === 'auth-token')
    expect(authCookie).toBeUndefined()
  })
})

test.describe('Authentication Accessibility', () => {
  test('Login form is accessible', async ({ page }) => {
    await page.goto('/auth')
    
    // Check form labels
    await expect(page.locator('label[for="email"]')).toBeVisible()
    await expect(page.locator('label[for="password"]')).toBeVisible()
    
    // Check ARIA attributes
    const emailInput = page.locator('#email')
    await expect(emailInput).toHaveAttribute('aria-required', 'true')
    
    const passwordInput = page.locator('#password')
    await expect(passwordInput).toHaveAttribute('aria-required', 'true')
    
    // Check form can be navigated with keyboard
    await page.keyboard.press('Tab')
    await expect(emailInput).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(passwordInput).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('button[type="submit"]')).toBeFocused()
  })

  test('Error messages are announced to screen readers', async ({ page }) => {
    await page.goto('/auth')
    
    // Submit form with empty fields
    await page.click('button[type="submit"]')
    
    // Check error message has proper ARIA attributes
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toHaveAttribute('aria-live', 'polite')
  })
})