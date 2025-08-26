import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MobileTestSuiteProps {
  onNavigate?: (path: string) => void
}

export function MobileTestSuite({ onNavigate }: MobileTestSuiteProps) {
  const [swipeDetected, setSwipeDetected] = useState(false)
  const [orientation, setOrientation] = useState('portrait')
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleOrientationChange = () => {
      const angle = (screen as any).orientation?.angle || 0
      setOrientation(Math.abs(angle) === 90 ? 'landscape' : 'portrait')
    }

    const handleResize = () => {
      // Simple keyboard detection for mobile
      if (window.innerHeight < 500) {
        setKeyboardOpen(true)
      } else {
        setKeyboardOpen(false)
      }
    }

    window.addEventListener('orientationchange', handleOrientationChange)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const startX = touch.clientX
    
    const handleTouchEnd = (endEvent: TouchEvent) => {
      const endTouch = endEvent.changedTouches[0]
      const endX = endTouch.clientX
      
      if (Math.abs(endX - startX) > 50) {
        setSwipeDetected(true)
      }
      
      document.removeEventListener('touchend', handleTouchEnd)
    }
    
    document.addEventListener('touchend', handleTouchEnd)
  }

  const handleMenuToggle = () => {
    setMenuOpen(!menuOpen)
    if (onNavigate) {
      onNavigate('/menu')
    }
  }

  return (
    <div data-testid="responsive-container" className={`flex ${window.innerWidth < 768 ? 'flex-col' : 'flex-row'}`}>
      <Card>
        <CardHeader>
          <CardTitle>Mobile Test Suite</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <section>
              <h3 className="font-semibold">Touch Gestures</h3>
              <div
                data-testid="touch-area"
                className="w-full h-32 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center"
                onTouchStart={handleTouchStart}
              >
                {swipeDetected ? 'Swipe detected!' : 'Swipe here to test'}
              </div>
              <div data-testid="touch-feedback" className={swipeDetected ? 'visible' : 'invisible'}>
                Touch interaction successful
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Responsive Layout</h3>
              <div data-testid="desktop-canvas" className={`${window.innerWidth >= 768 ? 'block' : 'hidden'}`}>
                Desktop Canvas View
              </div>
              <div data-testid="mobile-canvas" className={`${window.innerWidth < 768 ? 'block' : 'hidden'}`}>
                Mobile Canvas View
              </div>
              <div data-testid="sidebar" className={`${window.innerWidth >= 768 ? 'block' : 'hidden'}`}>
                Sidebar Content
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Navigation</h3>
              <button
                role="button"
                aria-label="menu"
                onClick={handleMenuToggle}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Menu
              </button>
              {menuOpen && (
                <nav role="navigation" className="mt-2 p-4 bg-gray-50 rounded">
                  <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/about">About</a></li>
                  </ul>
                </nav>
              )}
              <div data-testid="mobile-menu" className={`${window.innerWidth < 768 ? 'block' : 'hidden'}`}>
                Mobile Menu
              </div>
              <div data-testid="desktop-nav" className={`${window.innerWidth >= 768 ? 'block' : 'hidden'}`}>
                Desktop Navigation
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Virtual Keyboard</h3>
              <input
                type="text"
                role="textbox"
                placeholder="Type here to test virtual keyboard"
                className="w-full p-2 border rounded"
              />
              <div 
                data-testid="keyboard-aware-container" 
                className={keyboardOpen ? 'keyboard-open' : ''}
              >
                Keyboard state: {keyboardOpen ? 'Open' : 'Closed'}
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Orientation</h3>
              <div data-testid="orientation-indicator">
                {orientation}
              </div>
            </section>

            <div data-testid="mobile-chat" className={`${window.innerWidth < 768 ? 'block' : 'hidden'}`}>
              Mobile Chat Interface
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}