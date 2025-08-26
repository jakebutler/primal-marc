import React, { Suspense, ComponentType } from 'react'
import { Spinner } from '@/components/ui/spinner'

// Loading fallback component
export const LoadingFallback: React.FC<{ message?: string }> = ({ 
  message = 'Loading...' 
}) => (
  <div className="flex items-center justify-center min-h-[200px] w-full">
    <div className="flex flex-col items-center space-y-4">
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
)

// Error boundary for lazy loaded components
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class LazyLoadErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ComponentType<{ error: Error }> }>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ComponentType<{ error: Error }> }>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return <FallbackComponent error={this.state.error!} />
    }

    return this.props.children
  }
}

const DefaultErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex items-center justify-center min-h-[200px] w-full">
    <div className="text-center space-y-4">
      <div className="text-red-500">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Failed to load component</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  </div>
)

// Lazy loading wrapper with enhanced error handling and loading states
export function withLazyLoading<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    fallback?: React.ComponentType
    errorFallback?: React.ComponentType<{ error: Error }>
    loadingMessage?: string
  } = {}
): React.ComponentType<React.ComponentProps<T>> {
  const LazyComponent = React.lazy(importFn)
  
  return React.forwardRef<any, React.ComponentProps<T>>((props, ref) => (
    <LazyLoadErrorBoundary fallback={options.errorFallback}>
      <Suspense 
        fallback={
          options.fallback ? 
            <options.fallback /> : 
            <LoadingFallback message={options.loadingMessage} />
        }
      >
        <LazyComponent {...props} ref={ref} />
      </Suspense>
    </LazyLoadErrorBoundary>
  ))
}

// Preload utility for critical routes
export function preloadComponent(importFn: () => Promise<{ default: ComponentType<any> }>) {
  // Start loading the component but don't wait for it
  importFn().catch(error => {
    console.warn('Failed to preload component:', error)
  })
}

// Hook for intersection observer based lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false)
  const [hasIntersected, setHasIntersected] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [ref, hasIntersected, options])

  return { isIntersecting, hasIntersected }
}

// Component for lazy loading images
export const LazyImage: React.FC<{
  src: string
  alt: string
  className?: string
  placeholder?: string
  onLoad?: () => void
  onError?: () => void
}> = ({ src, alt, className, placeholder, onLoad, onError }) => {
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const { hasIntersected } = useIntersectionObserver(imgRef)

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {hasIntersected && !hasError && (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {(!hasIntersected || !isLoaded) && !hasError && (
        <div className={`bg-muted animate-pulse ${className}`}>
          {placeholder && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {placeholder}
            </div>
          )}
        </div>
      )}
      
      {hasError && (
        <div className={`bg-muted flex items-center justify-center ${className}`}>
          <div className="text-muted-foreground text-sm">Failed to load image</div>
        </div>
      )}
    </div>
  )
}

// Performance monitoring for lazy loaded components
export function withPerformanceMonitoring<T extends ComponentType<any>>(
  Component: T,
  componentName: string
): T {
  return React.forwardRef<any, React.ComponentProps<T>>((props, ref) => {
    React.useEffect(() => {
      const startTime = performance.now()
      
      return () => {
        const endTime = performance.now()
        const renderTime = endTime - startTime
        
        // Log slow renders in development
        if (process.env.NODE_ENV === 'development' && renderTime > 100) {
          console.warn(`Slow render detected for ${componentName}: ${renderTime.toFixed(2)}ms`)
        }
        
        // Send to analytics in production (if available)
        if (process.env.NODE_ENV === 'production' && window.gtag) {
          window.gtag('event', 'component_render_time', {
            component_name: componentName,
            render_time: Math.round(renderTime)
          })
        }
      }
    })

    return <Component {...props} ref={ref} />
  }) as T
}