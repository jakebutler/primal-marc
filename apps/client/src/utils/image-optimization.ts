// Image optimization utilities for performance

export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  gravity?: 'center' | 'north' | 'south' | 'east' | 'west' | 'auto'
  blur?: number
  sharpen?: boolean
  grayscale?: boolean
}

export interface ResponsiveImageSizes {
  mobile: number
  tablet: number
  desktop: number
  xl: number
}

// Default responsive breakpoints
export const DEFAULT_BREAKPOINTS: ResponsiveImageSizes = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  xl: 1440
}

// CDN configuration
const CDN_CONFIG = {
  cloudinary: {
    cloudName: process.env.VITE_CLOUDINARY_CLOUD_NAME || '',
    baseUrl: 'https://res.cloudinary.com'
  },
  vercel: {
    baseUrl: '/_vercel/image'
  }
}

/**
 * Generate optimized image URL using Cloudinary
 */
export function generateCloudinaryUrl(
  publicId: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!CDN_CONFIG.cloudinary.cloudName) {
    console.warn('Cloudinary cloud name not configured')
    return publicId
  }

  const {
    width,
    height,
    quality = 80,
    format = 'auto',
    fit = 'cover',
    gravity = 'auto',
    blur,
    sharpen,
    grayscale
  } = options

  const transformations: string[] = []

  // Quality and format
  transformations.push(`q_${quality}`)
  if (format !== 'auto') {
    transformations.push(`f_${format}`)
  } else {
    transformations.push('f_auto')
  }

  // Dimensions and fit
  if (width || height) {
    const dimensions = []
    if (width) dimensions.push(`w_${width}`)
    if (height) dimensions.push(`h_${height}`)
    dimensions.push(`c_${fit}`)
    if (gravity !== 'auto') dimensions.push(`g_${gravity}`)
    transformations.push(dimensions.join(','))
  }

  // Effects
  if (blur) transformations.push(`e_blur:${blur}`)
  if (sharpen) transformations.push('e_sharpen')
  if (grayscale) transformations.push('e_grayscale')

  const transformationString = transformations.join('/')

  return `${CDN_CONFIG.cloudinary.baseUrl}/${CDN_CONFIG.cloudinary.cloudName}/image/upload/${transformationString}/${publicId}`
}

/**
 * Generate optimized image URL using Vercel Image Optimization
 */
export function generateVercelImageUrl(
  src: string,
  options: ImageOptimizationOptions = {}
): string {
  const { width, quality = 75 } = options
  
  const params = new URLSearchParams()
  params.set('url', src)
  if (width) params.set('w', width.toString())
  params.set('q', quality.toString())

  return `${CDN_CONFIG.vercel.baseUrl}?${params.toString()}`
}

/**
 * Generate responsive image srcset
 */
export function generateResponsiveSrcSet(
  publicId: string,
  breakpoints: Partial<ResponsiveImageSizes> = {},
  options: ImageOptimizationOptions = {}
): string {
  const sizes = { ...DEFAULT_BREAKPOINTS, ...breakpoints }
  
  const srcSetEntries = Object.entries(sizes).map(([_, width]) => {
    const url = generateCloudinaryUrl(publicId, { ...options, width })
    return `${url} ${width}w`
  })

  return srcSetEntries.join(', ')
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizesAttribute(
  breakpoints: Partial<ResponsiveImageSizes> = {}
): string {
  const sizes = { ...DEFAULT_BREAKPOINTS, ...breakpoints }
  
  return [
    `(max-width: ${sizes.mobile}px) ${sizes.mobile}px`,
    `(max-width: ${sizes.tablet}px) ${sizes.tablet}px`,
    `(max-width: ${sizes.desktop}px) ${sizes.desktop}px`,
    `${sizes.xl}px`
  ].join(', ')
}

/**
 * Detect optimal image format based on browser support
 */
export function detectOptimalFormat(): 'webp' | 'avif' | 'jpeg' {
  // Check for AVIF support
  const avifCanvas = document.createElement('canvas')
  avifCanvas.width = 1
  avifCanvas.height = 1
  const avifSupported = avifCanvas.toDataURL('image/avif').indexOf('data:image/avif') === 0

  if (avifSupported) return 'avif'

  // Check for WebP support
  const webpCanvas = document.createElement('canvas')
  webpCanvas.width = 1
  webpCanvas.height = 1
  const webpSupported = webpCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0

  if (webpSupported) return 'webp'

  return 'jpeg'
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, options: { as?: string; crossorigin?: string } = {}): void {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = options.as || 'image'
  link.href = src
  if (options.crossorigin) {
    link.crossOrigin = options.crossorigin
  }
  document.head.appendChild(link)
}

/**
 * Lazy load image with intersection observer
 */
export function createLazyImageObserver(
  callback: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    rootMargin: '50px 0px',
    threshold: 0.01,
    ...options
  }

  return new IntersectionObserver((entries) => {
    entries.forEach(callback)
  }, defaultOptions)
}

/**
 * Calculate image dimensions while maintaining aspect ratio
 */
export function calculateAspectRatioDimensions(
  originalWidth: number,
  originalHeight: number,
  targetWidth?: number,
  targetHeight?: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight

  if (targetWidth && targetHeight) {
    return { width: targetWidth, height: targetHeight }
  }

  if (targetWidth) {
    return {
      width: targetWidth,
      height: Math.round(targetWidth / aspectRatio)
    }
  }

  if (targetHeight) {
    return {
      width: Math.round(targetHeight * aspectRatio),
      height: targetHeight
    }
  }

  return { width: originalWidth, height: originalHeight }
}

/**
 * Generate placeholder image (base64 encoded blur)
 */
export function generatePlaceholderImage(
  width: number = 400,
  height: number = 300,
  color: string = '#f3f4f6'
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  
  return canvas.toDataURL('image/jpeg', 0.1)
}

/**
 * Image performance monitoring
 */
export class ImagePerformanceMonitor {
  private static instance: ImagePerformanceMonitor
  private loadTimes: Map<string, number> = new Map()
  private errors: Map<string, string> = new Map()

  static getInstance(): ImagePerformanceMonitor {
    if (!ImagePerformanceMonitor.instance) {
      ImagePerformanceMonitor.instance = new ImagePerformanceMonitor()
    }
    return ImagePerformanceMonitor.instance
  }

  trackImageLoad(src: string, startTime: number): void {
    const loadTime = performance.now() - startTime
    this.loadTimes.set(src, loadTime)

    // Log slow loading images in development
    if (process.env.NODE_ENV === 'development' && loadTime > 2000) {
      console.warn(`Slow image load detected: ${src} took ${loadTime.toFixed(2)}ms`)
    }
  }

  trackImageError(src: string, error: string): void {
    this.errors.set(src, error)
    console.error(`Image load error: ${src} - ${error}`)
  }

  getStats(): {
    averageLoadTime: number
    slowImages: Array<{ src: string; loadTime: number }>
    errorCount: number
  } {
    const loadTimes = Array.from(this.loadTimes.values())
    const averageLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length 
      : 0

    const slowImages = Array.from(this.loadTimes.entries())
      .filter(([_, time]) => time > 2000)
      .map(([src, loadTime]) => ({ src, loadTime }))
      .sort((a, b) => b.loadTime - a.loadTime)

    return {
      averageLoadTime,
      slowImages,
      errorCount: this.errors.size
    }
  }

  reset(): void {
    this.loadTimes.clear()
    this.errors.clear()
  }
}

// Export singleton instance
export const imagePerformanceMonitor = ImagePerformanceMonitor.getInstance()

/**
 * Hook for optimized image loading
 */
export function useOptimizedImage(
  src: string,
  options: ImageOptimizationOptions & {
    responsive?: boolean
    breakpoints?: Partial<ResponsiveImageSizes>
    placeholder?: boolean
  } = {}
) {
  const { responsive = false, breakpoints, placeholder = true, ...optimizationOptions } = options

  // Generate optimized URLs
  const optimizedSrc = src.startsWith('http') 
    ? generateVercelImageUrl(src, optimizationOptions)
    : generateCloudinaryUrl(src, optimizationOptions)

  const srcSet = responsive 
    ? generateResponsiveSrcSet(src, breakpoints, optimizationOptions)
    : undefined

  const sizes = responsive 
    ? generateSizesAttribute(breakpoints)
    : undefined

  const placeholderSrc = placeholder 
    ? generatePlaceholderImage(
        optimizationOptions.width || 400,
        optimizationOptions.height || 300
      )
    : undefined

  return {
    src: optimizedSrc,
    srcSet,
    sizes,
    placeholder: placeholderSrc
  }
}