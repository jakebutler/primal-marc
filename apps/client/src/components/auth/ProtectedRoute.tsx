import React, { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mock authentication check
    const token = localStorage.getItem('token')
    
    if (token) {
      // Mock token verification
      setTimeout(() => {
        setIsAuthenticated(true)
        setIsLoading(false)
      }, 100)
    } else {
      setIsAuthenticated(false)
      setIsLoading(false)
    }
  }, [])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <div>Please log in to access this content</div>
  }

  return <>{children}</>
}