import { useEffect, useRef, useCallback } from 'react'

interface GestureHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onPinchZoom?: (scale: number) => void
  onLongPress?: (event: TouchEvent) => void
  onDoubleTap?: (event: TouchEvent) => void
}

interface TouchPoint {
  x: number
  y: number
  timestamp: number
}

export const useMobileGestures = (
  elementRef: React.RefObject<HTMLElement>,
  handlers: GestureHandlers
) => {
  const touchStartRef = useRef<TouchPoint | null>(null)
  const touchEndRef = useRef<TouchPoint | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTapRef = useRef<TouchPoint | null>(null)
  const initialPinchDistanceRef = useRef<number | null>(null)

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // Handle touch start
  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0]
    const touchPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }

    touchStartRef.current = touchPoint

    // Handle pinch gesture (two fingers)
    if (event.touches.length === 2) {
      initialPinchDistanceRef.current = getTouchDistance(event.touches[0], event.touches[1])
      return
    }

    // Start long press timer
    if (handlers.onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        handlers.onLongPress!(event)
      }, 500) // 500ms for long press
    }

    // Handle double tap
    if (handlers.onDoubleTap && lastTapRef.current) {
      const timeDiff = touchPoint.timestamp - lastTapRef.current.timestamp
      const distance = Math.sqrt(
        Math.pow(touchPoint.x - lastTapRef.current.x, 2) +
        Math.pow(touchPoint.y - lastTapRef.current.y, 2)
      )

      if (timeDiff < 300 && distance < 50) { // 300ms and 50px threshold
        handlers.onDoubleTap(event)
        lastTapRef.current = null
        return
      }
    }

    lastTapRef.current = touchPoint
  }, [handlers, getTouchDistance])

  // Handle touch move
  const handleTouchMove = useCallback((event: TouchEvent) => {
    // Clear long press timer on move
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // Handle pinch zoom
    if (event.touches.length === 2 && handlers.onPinchZoom && initialPinchDistanceRef.current) {
      const currentDistance = getTouchDistance(event.touches[0], event.touches[1])
      const scale = currentDistance / initialPinchDistanceRef.current
      handlers.onPinchZoom(scale)
      return
    }

    const touch = event.touches[0]
    touchEndRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }
  }, [handlers, getTouchDistance])

  // Handle touch end
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // Reset pinch distance
    if (event.touches.length < 2) {
      initialPinchDistanceRef.current = null
    }

    if (!touchStartRef.current || !touchEndRef.current) return

    const deltaX = touchEndRef.current.x - touchStartRef.current.x
    const deltaY = touchEndRef.current.y - touchStartRef.current.y
    const deltaTime = touchEndRef.current.timestamp - touchStartRef.current.timestamp

    // Minimum distance and maximum time for swipe
    const minSwipeDistance = 50
    const maxSwipeTime = 300

    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      return // Not a swipe
    }

    if (deltaTime > maxSwipeTime) {
      return // Too slow to be a swipe
    }

    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (deltaX > 0 && handlers.onSwipeRight) {
        handlers.onSwipeRight()
      } else if (deltaX < 0 && handlers.onSwipeLeft) {
        handlers.onSwipeLeft()
      }
    } else {
      // Vertical swipe
      if (deltaY > 0 && handlers.onSwipeDown) {
        handlers.onSwipeDown()
      } else if (deltaY < 0 && handlers.onSwipeUp) {
        handlers.onSwipeUp()
      }
    }

    // Reset touch points
    touchStartRef.current = null
    touchEndRef.current = null
  }, [handlers])

  // Set up event listeners
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // Add passive listeners for better performance
    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  return {
    // Utility functions that components can use
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isLongPressing: longPressTimerRef.current !== null
  }
}