import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { performanceMonitor, PerformanceMonitor } from '@/utils/performance-monitor'
import { withPerformanceTracking } from '@/utils/performance-monitor'
import React from 'react'

// Mock component for testing
const TestComponent: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  React.useEffect(() => {
    if (delay > 0) {
      // Simulate slow rendering
      const start = Date.now()
      while (Date.now() - start < delay) {
        // Busy wait
      }
    }
  }, [delay])

  return <div data-testid="test-component">Test Component</div>
}

const TrackedTestComponent = withPerformanceTracking(TestComponent, 'TestComponent')

describe('Performance Monitoring', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance()
    monitor.stopMonitoring() // Reset state
    
    // Mock performance API
    Object.defineProperty(window, 'performance', {
      value: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn(),
        getEntriesByType: vi.fn(() => []),
        memory: {
          usedJSHeapSize: 1024 * 1024 * 10, // 10MB
          totalJSHeapSize: 1024 * 1024 * 50, // 50MB
          jsHeapSizeLimit: 1024 * 1024 * 100 // 100MB
        }
      },
      writable: true
    })

    // Mock PerformanceObserver
    global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }))
  })

  afterEach(() => {
    monitor.stopMonitoring()
    vi.restoreAllMocks()
  })

  it('should track component render performance', async () => {
    const trackSpy = vi.spyOn(monitor, 'trackComponentRender')
    
    render(<TrackedTestComponent />)
    
    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument()
    })

    // Component tracking happens on unmount
    screen.getByTestId('test-component').remove()
    
    // Give time for cleanup
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(trackSpy).toHaveBeenCalledWith('TestComponent', expect.any(Number))
  })

  it('should track API call performance', () => {
    const endpoint = '/api/test'
    const responseTime = 150
    
    monitor.trackApiCall(endpoint, responseTime)
    
    const metrics = monitor.getMetrics()
    expect(metrics.apiResponseTime).toBe(responseTime)
  })

  it('should track cache hit rate', () => {
    const hitRate = 0.85 // 85%
    
    monitor.trackCacheHit(hitRate)
    
    const metrics = monitor.getMetrics()
    expect(metrics.cacheHitRate).toBe(hitRate)
  })

  it('should calculate performance scores correctly', () => {
    // Set some mock metrics
    monitor.trackApiCall('/api/test', 100) // Good response time
    monitor.trackCacheHit(0.9) // Good cache hit rate
    
    const score = monitor.getPerformanceScore()
    
    expect(score.overall).toBeGreaterThan(0)
    expect(score.overall).toBeLessThanOrEqual(100)
    expect(score.breakdown).toBeDefined()
  })

  it('should generate performance report', () => {
    monitor.trackApiCall('/api/test', 200)
    monitor.trackCacheHit(0.8)
    
    const report = monitor.generateReport()
    
    expect(report).toContain('Performance Report')
    expect(report).toContain('Cache Hit Rate')
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(50)
  })

  it('should start and stop monitoring', () => {
    expect(monitor.startMonitoring).toBeDefined()
    expect(monitor.stopMonitoring).toBeDefined()
    
    // Should not throw errors
    monitor.startMonitoring()
    monitor.stopMonitoring()
  })

  it('should handle memory metrics', () => {
    monitor.startMonitoring()
    
    const metrics = monitor.getMetrics()
    
    // Memory metrics should be available if performance.memory exists
    if ('memory' in performance) {
      expect(metrics.usedJSHeapSize).toBeDefined()
      expect(metrics.totalJSHeapSize).toBeDefined()
      expect(metrics.jsHeapSizeLimit).toBeDefined()
    }
  })

  it('should warn about slow components in development', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    monitor.trackComponentRender('SlowComponent', 150) // Slow render
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slow component render: SlowComponent')
    )
    
    process.env.NODE_ENV = originalEnv
    consoleSpy.mockRestore()
  })

  it('should warn about slow API calls', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    monitor.trackApiCall('/api/slow-endpoint', 3000) // Very slow API call
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slow API call: /api/slow-endpoint')
    )
    
    consoleSpy.mockRestore()
  })

  it('should warn about low cache hit rates', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    monitor.trackCacheHit(0.3) // Low cache hit rate
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Low cache hit rate: 30.0%')
    )
    
    consoleSpy.mockRestore()
  })
})

describe('Performance Thresholds', () => {
  it('should classify metrics correctly', () => {
    const monitor = PerformanceMonitor.getInstance()
    
    // Mock some metrics that would be set by observers
    const metrics = {
      lcp: 2000, // Good
      fid: 150,  // Needs improvement
      cls: 0.3,  // Poor
      fcp: 1500, // Good
      ttfb: 1000 // Needs improvement
    }
    
    // Manually set metrics for testing
    Object.assign(monitor['metrics'], metrics)
    
    const score = monitor.getPerformanceScore()
    
    expect(score.breakdown.lcp?.status).toBe('good')
    expect(score.breakdown.fid?.status).toBe('needs-improvement')
    expect(score.breakdown.cls?.status).toBe('poor')
    expect(score.breakdown.fcp?.status).toBe('good')
    expect(score.breakdown.ttfb?.status).toBe('needs-improvement')
  })
})

describe('Performance Utilities', () => {
  it('should create performance tracking HOC', () => {
    const WrappedComponent = withPerformanceTracking(TestComponent, 'TestComponent')
    
    expect(WrappedComponent).toBeDefined()
    expect(typeof WrappedComponent).toBe('object') // React component
    
    // Should render without errors
    const { unmount } = render(<WrappedComponent />)
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
    
    unmount()
  })

  it('should handle singleton pattern correctly', () => {
    const instance1 = PerformanceMonitor.getInstance()
    const instance2 = PerformanceMonitor.getInstance()
    
    expect(instance1).toBe(instance2) // Should be the same instance
  })
})