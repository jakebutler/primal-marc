module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/auth',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/canvas/test-project'
      ],
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'Local:.*:3000',
      startServerReadyTimeout: 30000
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'categories:pwa': ['warn', { minScore: 0.7 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        
        // Accessibility specific
        'color-contrast': 'error',
        'heading-order': 'error',
        'aria-valid-attr': 'error',
        'button-name': 'error',
        'link-name': 'error',
        
        // Performance specific
        'unused-javascript': ['warn', { maxNumericValue: 100000 }],
        'render-blocking-resources': 'warn',
        'uses-optimized-images': 'warn',
        'modern-image-formats': 'warn'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    },
    server: {
      port: 9001,
      storage: '.lighthouseci'
    }
  }
}