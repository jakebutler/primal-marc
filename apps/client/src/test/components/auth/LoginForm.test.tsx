import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock the useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock fetch
global.fetch = vi.fn()

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('LoginForm', () => {
  it('renders login form with email and password fields', () => {
    const mockSwitchToRegister = vi.fn()
    
    render(
      <LoginForm onSwitchToRegister={mockSwitchToRegister} />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation errors for invalid inputs', async () => {
    const mockSwitchToRegister = vi.fn()
    
    render(
      <LoginForm onSwitchToRegister={mockSwitchToRegister} />,
      { wrapper: createWrapper() }
    )

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
    })
  })

  it('calls onSwitchToRegister when sign up link is clicked', () => {
    const mockSwitchToRegister = vi.fn()
    
    render(
      <LoginForm onSwitchToRegister={mockSwitchToRegister} />,
      { wrapper: createWrapper() }
    )

    const signUpLink = screen.getByText('Sign up')
    fireEvent.click(signUpLink)

    expect(mockSwitchToRegister).toHaveBeenCalled()
  })
})