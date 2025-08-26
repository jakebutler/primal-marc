// Performance monitoring and optimization utilities
import React from 'react'

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  fcp?: number // First Contentful Paint
  ttfb?: number // Time to First Byte
  
  // Custom metrics
  componentRenderTime?: number
  apiResponseTime?: number
  cacheHitRate?: number
  bundleSize?: number
  
  // Navigation timing
  domContentLoaded?: number
  loadComplete?: number
  
  // Memory usage
  usedJSHeapSize?: number
  totalJSHeapSize?: number
  jsHeapSizeLimit?: number
}

export interface PerformanceThresholds {
  lcp: { good: number; needsImprovement: number }
  fid: { good: number; needsImprovement: number }
  cls: { good: number; needsImprovement: number }
  fcp: { good: number; needsImprovement: number }
  ttfb: { good: number; needsImprovement: number }
}

// Google's recommended thresholds
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, needsImprovement: 4000 },
  fid: { good: 100, needsImprovement: 300 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  fcp: { good: 1800, needsImprovement: 3000 },
  ttfb: { good: 800, needsImprovement: 1800 }
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics = {}
  private observers: Map<string, PerformanceObserver> = new Map()
  private thresholds: PerformanceThresholds
  private isMonitoring = false

  constructor(thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  startMonitoring(): void {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    this.setupWebVitalsObservers()
    this.setupNavigationObserver()
    this.setupResourceObserver()
    this.monitorMemoryUsage()
    
    console.log('Performance monitoring started')
  }

  stopMonitoring(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
    this.isMonitoring = false
    
    console.log('Performance monitoring stopped')
  }

  private setupWebVitalsObservers(): void {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          this.metrics.lcp = lastEntry.startTime
          this.reportMetric('lcp', lastEntry.startTime)
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.set('lcp', lcpObserver)
      } catch (error) {
        console.warn('LCP observer not supported:', error)
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            this.metrics.fid = entry.processingStart - entry.startTime
            this.reportMetric('fid', this.metrics.fid)
          })
        })
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.set('fid', fidObserver)
      } catch (error) {
        console.warn('FID observer not supported:', error)
      }

      // Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          })
          this.metrics.cls = clsValue
          this.reportMetric('cls', clsValue)
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('cls', clsObserver)
      } catch (error) {
        console.warn('CLS observer not supported:', error)
      }

      // First Contentful Paint
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime
              this.reportMetric('fcp', entry.startTime)
            }
          })
        })
        fcpObserver.observe({ entryTypes: ['paint'] })
        this.observers.set('fcp', fcpObserver)
      } catch (error) {
        console.warn('FCP observer not supported:', error)
      }
    }
  }

  private setupNavigationObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            this.metrics.ttfb = entry.responseStart - entry.requestStart
            this.metrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.navigationStart
            this.metrics.loadComplete = entry.loadEventEnd - entry.navigationStart
            
            this.reportMetric('ttfb', this.metrics.ttfb)
            this.reportMetric('domContentLoaded', this.metrics.domContentLoaded)
            this.reportMetric('loadComplete', this.metrics.loadComplete)
          })
        })
        navObserver.observe({ entryTypes: ['navigation'] })
        this.observers.set('navigation', navObserver)
      } catch (error) {
        console.warn('Navigation observer not supported:', error)
      }
    }
  }

  private setupResourceObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            // Track slow resources
            const duration = entry.responseEnd - entry.startTime
            if (duration > 1000) { // Resources taking more than 1 second
              console.warn(`Slow resource detected: ${entry.name} took ${duration.toFixed(2)}ms`)
            }
          })
        })
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.set('resource', resourceObserver)
      } catch (error) {
        console.warn('Resource observer not supported:', error)
      }
    }
  }

  private monitorMemoryUsage(): void {
    if ('memory' in performance) {
      const updateMemoryMetrics = () => {
        const memory = (performance as any).memory
        this.metrics.usedJSHeapSize = memory.usedJSHeapSize
        this.metrics.totalJSHeapSize = memory.totalJSHeapSize
        this.metrics.jsHeapSizeLimit = memory.jsHeapSizeLimit
      }

      updateMemoryMetrics()
      setInterval(updateMemoryMetrics, 30000) // Update every 30 seconds
    }
  }

  private reportMetric(name: string, value: number): void {
    const threshold = this.thresholds[name as keyof PerformanceThresholds]
    if (!threshold) return

    let status: 'good' | 'needs-improvement' | 'poor'
    if (value <= threshold.good) {
      status = 'good'
    } else if (value <= threshold.needsImprovement) {
      status = 'needs-improvement'
    } else {
      status = 'poor'
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${name.toUpperCase()}: ${value.toFixed(2)}ms (${status})`)
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production' && window.gtag) {
      window.gtag('event', 'web_vitals', {
        metric_name: name,
        metric_value: Math.round(value),
        metric_status: status
      })
    }
  }

  // Manual metric tracking
  trackComponentRender(componentName: string, renderTime: number): void {
    this.metrics.componentRenderTime = renderTime
    
    if (renderTime > 100) {
      console.warn(`Slow component render: ${componentName} took ${renderTime.toFixed(2)}ms`)
    }

    if (process.env.NODE_ENV === 'production' && window.gtag) {
      window.gtag('event', 'component_performance', {
        component_name: componentName,
        render_time: Math.round(renderTime)
      })
    }
  }

  trackApiCall(endpoint: string, responseTime: number): void {
    this.metrics.apiResponseTime = responseTime
    
    if (responseTime > 2000) {
      console.warn(`Slow API call: ${endpoint} took ${responseTime.toFixed(2)}ms`)
    }

    if (process.env.NODE_ENV === 'production' && window.gtag) {
      window.gtag('event', 'api_performance', {
        endpoint,
        response_time: Math.round(responseTime)
      })
    }
  }

  trackCacheHit(hitRate: number): void {
    this.metrics.cacheHitRate = hitRate
    
    if (hitRate < 0.5) {
      console.warn(`Low cache hit rate: ${(hitRate * 100).toFixed(1)}%`)
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getPerformanceScore(): {
    overall: number
    breakdown: Record<string, { score: number; status: string }>
  } {
    const scores: Record<string, { score: number; status: string }> = {}
    let totalScore = 0
    let metricCount = 0

    // Calculate scores for each metric
    Object.entries(this.thresholds).forEach(([metric, threshold]) => {
      const value = this.metrics[metric as keyof PerformanceMetrics]
      if (value !== undefined) {
        let score: number
        let status: string

        if (value <= threshold.good) {
          score = 100
          status = 'good'
        } else if (value <= threshold.needsImprovement) {
          score = 75
          status = 'needs-improvement'
        } else {
          score = 50
          status = 'poor'
        }

        scores[metric] = { score, status }
        totalScore += score
        metricCount++
      }
    })

    const overall = metricCount > 0 ? Math.round(totalScore / metricCount) : 0

    return { overall, breakdown: scores }
  }

  generateReport(): string {
    const metrics = this.getMetrics()
    const score = this.getPerformanceScore()
    
    let report = `Performance Report (Score: ${score.overall}/100)\n`
    report += '='.repeat(50) + '\n\n'
    
    report += 'Core Web Vitals:\n'
    if (metrics.lcp) report += `  LCP: ${metrics.lcp.toFixed(2)}ms (${score.breakdown.lcp?.status || 'unknown'})\n`
    if (metrics.fid) report += `  FID: ${metrics.fid.toFixed(2)}ms (${score.breakdown.fid?.status || 'unknown'})\n`
    if (metrics.cls) report += `  CLS: ${metrics.cls.toFixed(3)} (${score.breakdown.cls?.status || 'unknown'})\n`
    if (metrics.fcp) report += `  FCP: ${metrics.fcp.toFixed(2)}ms (${score.breakdown.fcp?.status || 'unknown'})\n`
    if (metrics.ttfb) report += `  TTFB: ${metrics.ttfb.toFixed(2)}ms (${score.breakdown.ttfb?.status || 'unknown'})\n`
    
    report += '\nOther Metrics:\n'
    if (metrics.domContentLoaded) report += `  DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms\n`
    if (metrics.loadComplete) report += `  Load Complete: ${metrics.loadComplete.toFixed(2)}ms\n`
    if (metrics.cacheHitRate) report += `  Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%\n`
    
    if (metrics.usedJSHeapSize) {
      report += '\nMemory Usage:\n'
      report += `  Used JS Heap: ${(metrics.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`
      report += `  Total JS Heap: ${((metrics.totalJSHeapSize || 0) / 1024 / 1024).toFixed(2)} MB\n`
      report += `  JS Heap Limit: ${((metrics.jsHeapSizeLimit || 0) / 1024 / 1024).toFixed(2)} MB\n`
    }
    
    return report
  }
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const monitor = PerformanceMonitor.getInstance()
  
  React.useEffect(() => {
    monitor.startMonitoring()
    
    return () => {
      monitor.stopMonitoring()
    }
  }, [monitor])
  
  return {
    trackComponentRender: monitor.trackComponentRender.bind(monitor),
    trackApiCall: monitor.trackApiCall.bind(monitor),
    trackCacheHit: monitor.trackCacheHit.bind(monitor),
    getMetrics: monitor.getMetrics.bind(monitor),
    getPerformanceScore: monitor.getPerformanceScore.bind(monitor),
    generateReport: monitor.generateReport.bind(monitor)
  }
}

// HOC for component performance tracking
export function withPerformanceTracking<T extends React.ComponentType<any>>(
  Component: T,
  componentName: string
): React.ComponentType<React.ComponentProps<T>> {
  const WrappedComponent = React.forwardRef<any, React.ComponentProps<T>>((props, ref) => {
    const monitor = PerformanceMonitor.getInstance()
    
    React.useEffect(() => {
      const startTime = performance.now()
      
      return () => {
        const endTime = performance.now()
        const renderTime = endTime - startTime
        monitor.trackComponentRender(componentName, renderTime)
      }
    })

    return React.createElement(Component, { ...props, ref })
  })
  
  WrappedComponent.displayName = `withPerformanceTracking(${componentName})`
  
  return WrappedComponent
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetId: string,
      config?: Record<string, any>
    ) => void
  }
}

// Global performance monitoring setup
if (typeof window !== 'undefined') {
  // Start monitoring when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      performanceMonitor.startMonitoring()
    })
  } else {
    performanceMonitor.startMonitoring()
  }
  
  // Generate report on page unload (for debugging)
  if (process.env.NODE_ENV === 'development') {
    window.addEventListener('beforeunload', () => {
      console.log(performanceMonitor.generateReport())
    })
  }
}