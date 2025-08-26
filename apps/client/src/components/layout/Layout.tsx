import React, { useState, useEffect } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainCanvas } from './MainCanvas'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children?: React.ReactNode
  projectId?: string
  onPhaseChange?: (phase: string) => void
}

export const Layout: React.FC<LayoutProps> = ({ children, projectId, onPhaseChange }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // Auto-close sidebar on mobile when screen size changes
      if (window.innerWidth >= 768) {
        setIsMobileSidebarOpen(false)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && isMobileSidebarOpen) {
        const sidebar = document.getElementById('mobile-sidebar')
        const menuButton = document.getElementById('mobile-menu-button')
        
        if (sidebar && !sidebar.contains(event.target as Node) && 
            menuButton && !menuButton.contains(event.target as Node)) {
          setIsMobileSidebarOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobile, isMobileSidebarOpen])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && isMobileSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobile, isMobileSidebarOpen])

  return (
    <div className="min-h-screen bg-background">
      <Header>
        {/* Mobile menu button */}
        {isMobile && (
          <Button
            id="mobile-menu-button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          >
            {isMobileSidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        )}
      </Header>

      <div className="flex h-[calc(100vh-3.5rem)] relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar 
            projectId={projectId} 
            onPhaseChange={onPhaseChange}
          />
        </div>

        {/* Mobile Sidebar Overlay */}
        {isMobile && (
          <>
            {/* Backdrop */}
            <div 
              className={cn(
                "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden",
                isMobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            
            {/* Sidebar */}
            <div
              id="mobile-sidebar"
              className={cn(
                "fixed left-0 top-[3.5rem] h-[calc(100vh-3.5rem)] z-50 transition-transform duration-300 ease-in-out md:hidden",
                isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
              )}
            >
              <Sidebar 
                className="h-full shadow-lg"
                projectId={projectId} 
                onPhaseChange={(phase) => {
                  onPhaseChange?.(phase)
                  setIsMobileSidebarOpen(false) // Close sidebar after selection
                }}
              />
            </div>
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {children || <MainCanvas />}
        </div>
      </div>
    </div>
  )
}

export default Layout