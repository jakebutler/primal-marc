import { test, expect, devices } from '@playwright/test'

// Test across different browsers and devices
const testDevices = [
  { name: 'Desktop Chrome', ...devices['Desktop Chrome'] },
  { name: 'Desktop Firefox', ...devices['Desktop Firefox'] },
  { name: 'Desktop Safari', ...devices['Desktop Safari'] },
  { name: 'iPhone 12', ...devices['iPhone 12'] },
  { name: 'Pixel 5', ...devices['Pixel 5'] },
  { name: 'iPad Pro', ...devices['iPad Pro'] }
]

testDevices.forEach(device => {
  test.describe(`Cross-browser testing on ${device.name}`, () => {
    test.use(device)

    test('Application loads correctly', async ({ page }) => {
      await page.goto('/')
      
      // Check that main elements are visible
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('nav')).toBeVisible()
      
      // Check responsive design
      const viewport = page.viewportSize()
      if (viewport && viewport.width < 768) {
        // Mobile-specific checks
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
      } else {
        // Desktop-specific checks
        await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible()
      }
    })

    test('Authentication works across devices', async ({ page }) => {
      await page.goto('/auth')
      
      await page.fill('[data-testid="email"]', 'test@example.com')
      await page.fill('[data-testid="password"]', 'password123')
      await page.click('button[type="submit"]')
      
      await expect(page).toHaveURL('/dashboard')
    })

    test('Canvas interface is responsive', async ({ page }) => {
      // Login first
      await page.goto('/auth')
      await page.fill('[data-testid="email"]', 'test@example.com')
      await page.fill('[data-testid="password"]', 'password123')
      await page.click('button[type="submit"]')
      
      await page.goto('/canvas/test-project')
      
      const viewport = page.viewportSize()
      if (viewport && viewport.width < 768) {
        // Mobile layout checks
        await expect(page.locator('[data-testid="mobile-canvas"]')).toBeVisible()
        await expect(page.locator('[data-testid="mobile-chat"]')).toBeVisible()
      } else {
        // Desktop layout checks
        await expect(page.locator('[data-testid="desktop-canvas"]')).toBeVisible()
        await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
      }
    })

    test('Touch interactions work on mobile devices', async ({ page }) => {
      const viewport = page.viewportSize()
      if (!viewport || viewport.width >= 768) {
        test.skip('Skipping touch test on non-mobile device')
      }

      await page.goto('/canvas/test-project')
      
      // Test touch scrolling
      await page.touchscreen.tap(200, 300)
      await page.mouse.wheel(0, 100)
      
      // Test swipe gestures
      await page.touchscreen.tap(100, 200)
      await page.mouse.move(100, 200)
      await page.mouse.move(300, 200)
      
      // Verify touch interactions work
      await expect(page.locator('[data-testid="touch-feedback"]')).toBeVisible()
    })
  })
})

test.describe('Performance across devices', () => {
  testDevices.forEach(device => {
    test(`Performance metrics on ${device.name}`, async ({ page }) => {
      test.use(device)
      
      await page.goto('/')
      
      // Measure Core Web Vitals
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const vitals: Record<string, number> = {}
            
            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                vitals.fcp = entry.startTime
              }
              if (entry.name === 'largest-contentful-paint') {
                vitals.lcp = entry.startTime
              }
            })
            
            resolve(vitals)
          }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] })
          
          // Fallback timeout
          setTimeout(() => resolve({}), 5000)
        })
      })
      
      console.log(`Performance metrics for ${device.name}:`, metrics)
      
      // Assert reasonable performance thresholds
      if (metrics.fcp) {
        expect(metrics.fcp).toBeLessThan(3000) // FCP < 3s
      }
      if (metrics.lcp) {
        expect(metrics.lcp).toBeLessThan(4000) // LCP < 4s
      }
    })
  })
})