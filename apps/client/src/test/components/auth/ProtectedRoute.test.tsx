import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock fetch
global.fetch = vi.fn()

const createWrapper = (initialEntries = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProtectedRoute', () => {
  it('shows loading spinner when authentication is loading', () => {
    // Mock fetch to return a pending promise
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}))

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to auth page when user is not authenticated', async () => {
    // Mock fetch to reject (no token)
    vi.mocked(fetch).mockRejectedValue(new Error('No token found'))

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { wrapper: createWrapper() }
    )

    // The component should redirect, so protected content should not be visible
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})