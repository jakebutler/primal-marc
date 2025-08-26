import React from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, User } from 'lucide-react'

interface HeaderProps {
  children?: React.ReactNode
}

export const Header: React.FC<HeaderProps> = ({ children }) => {
  const { user, logout } = useAuth()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="container flex h-14 items-center px-4">
        {/* Mobile menu button (passed as children) */}
        {children}
        
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <span className="font-bold text-lg md:text-xl">Primal Marc</span>
          </a>
        </div>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Search or other header content can go here */}
          </div>
          <nav className="flex items-center space-x-2">
            {user && (
              <>
                <div className="hidden sm:flex items-center space-x-2 text-sm">
                  <User className="h-4 w-4" />
                  <span className="truncate max-w-32">{user.firstName} {user.lastName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}