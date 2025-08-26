import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { 
  useOptimizedImage, 
  imagePerformanceMonitor,
  ImageOptimizationOptions,
  ResponsiveImageSizes
} from '@/utils/image-optimization'
import { useIntersectionObserver } from '@/utils/lazy-loading'

export interface OptimizedImageProps extends 
  Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes'> {
  src: string
  alt: string
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  gravity?: 'center' | 'north' | 'south' | 'east' | 'west' | 'auto'
  responsive?: boolean
  breakpoints?: Partial<ResponsiveImageSizes>
  lazy?: boolean
  placeholder?: boolean
  blur?: number
  sharpen?: boolean
  grayscale?: boolean
  fallbackSrc?: string
  onLoadStart?: () => void
  onLoadComplete?: () => void
  onError?: (error: string) => void
}

export const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({
    src,
    alt,
    width,
    height,
    quality,
    format,
    fit,
    gravity,
    responsive = false,
    breakpoints,
    lazy = true,
    placeholder = true,
    blur,
    sharpen,
    grayscale,
    fallbackSrc,
    className,
    onLoadStart,
    onLoadComplete,
    onError,
    onLoad,
    ...props
  }, ref) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [currentSrc, setCurrentSrc] = useState<string>('')
    
    const imgRef = useRef<HTMLImageElement>(null)
    const startTimeRef = useRef<number>(0)
    
    // Combine refs
    const combinedRef = (node: HTMLImageElement) => {
      imgRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    }

    // Intersection observer for lazy loading
    const { hasIntersected } = useIntersectionObserver(imgRef, {
      threshold: 0.1,
      rootMargin: '50px'
    })

    // Generate optimized image URLs
    const optimizationOptions: ImageOptimizationOptions = {
      width,
      height,
      quality,
      format,
      fit,
      gravity,
      blur,
      sharpen,
      grayscale
    }

    const { 
      src: optimizedSrc, 
      srcSet, 
      sizes, 
      placeholder: placeholderSrc 
    } = useOptimizedImage(src, {
      ...optimizationOptions,
      responsive,
      breakpoints,
      placeholder
    })

    // Handle image loading
    const handleLoadStart = () => {
      setIsLoading(true)
      setHasError(false)
      startTimeRef.current = performance.now()
      onLoadStart?.()
    }

    const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
      setIsLoaded(true)
      setIsLoading(false)
      
      // Track performance
      if (startTimeRef.current > 0) {
        imagePerformanceMonitor.trackImageLoad(currentSrc, startTimeRef.current)
      }
      
      onLoadComplete?.()
      onLoad?.(event)
    }

    const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
      setHasError(true)
      setIsLoading(false)
      
      const errorMessage = `Failed to load image: ${currentSrc}`
      imagePerformanceMonitor.trackImageError(currentSrc, errorMessage)
      
      // Try fallback image if available
      if (fallbackSrc && currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc)
        setHasError(false)
        return
      }
      
      onError?.(errorMessage)
    }

    // Update current src when intersection occurs or lazy loading is disabled
    useEffect(() => {
      if (!lazy || hasIntersected) {
        setCurrentSrc(optimizedSrc)
        handleLoadStart()
      }
    }, [lazy, hasIntersected, optimizedSrc])

    // Show placeholder while loading or if lazy loading hasn't triggered
    const shouldShowPlaceholder = lazy && !hasIntersected
    const shouldShowImage = !lazy || hasIntersected

    return (
      <div className={cn('relative overflow-hidden', className)} {...props}>
        {/* Placeholder */}
        {shouldShowPlaceholder && placeholder && placeholderSrc && (
          <img
            src={placeholderSrc}
            alt=""
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
              'blur-sm scale-110' // Slight blur and scale for placeholder effect
            )}
            aria-hidden="true"
          />
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Main image */}
        {shouldShowImage && currentSrc && !hasError && (
          <img
            ref={combinedRef}
            src={currentSrc}
            srcSet={responsive ? srcSet : undefined}
            sizes={responsive ? sizes : undefined}
            alt={alt}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={handleLoad}
            onError={handleError}
            loading={lazy ? 'lazy' : 'eager'}
            decoding="async"
          />
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <svg 
                className="w-12 h-12 mx-auto mb-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
              <p className="text-sm">Failed to load image</p>
            </div>
          </div>
        )}

        {/* Overlay for additional effects */}
        {(blur || grayscale) && isLoaded && (
          <div 
            className={cn(
              'absolute inset-0 pointer-events-none',
              blur && `backdrop-blur-[${blur}px]`,
              grayscale && 'grayscale'
            )}
          />
        )}
      </div>
    )
  }
)

OptimizedImage.displayName = 'OptimizedImage'

// Avatar component with optimization
export const OptimizedAvatar: React.FC<{
  src?: string
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallback?: string
  className?: string
}> = ({ src, alt, size = 'md', fallback, className }) => {
  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80
  }

  const dimension = sizeMap[size]

  if (!src) {
    return (
      <div 
        className={cn(
          'rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium',
          size === 'sm' && 'w-8 h-8 text-xs',
          size === 'md' && 'w-10 h-10 text-sm',
          size === 'lg' && 'w-14 h-14 text-base',
          size === 'xl' && 'w-20 h-20 text-lg',
          className
        )}
      >
        {fallback || alt.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={dimension}
      height={dimension}
      fit="cover"
      gravity="center"
      quality={85}
      className={cn(
        'rounded-full',
        size === 'sm' && 'w-8 h-8',
        size === 'md' && 'w-10 h-10',
        size === 'lg' && 'w-14 h-14',
        size === 'xl' && 'w-20 h-20',
        className
      )}
      fallbackSrc={fallback}
    />
  )
}

// Hero image component with responsive optimization
export const OptimizedHeroImage: React.FC<{
  src: string
  alt: string
  className?: string
  priority?: boolean
}> = ({ src, alt, className, priority = false }) => {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      responsive
      breakpoints={{
        mobile: 480,
        tablet: 768,
        desktop: 1200,
        xl: 1600
      }}
      quality={90}
      format="auto"
      fit="cover"
      gravity="center"
      lazy={!priority}
      className={cn('w-full h-full', className)}
    />
  )
}