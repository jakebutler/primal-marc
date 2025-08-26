import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Mock API calls
const mockApi = {
  login: vi.fn(),
  register: vi.fn(),
  verifyToken: vi.fn()
}

vi.mock('@/services/api', () => ({
  api: mockApi
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

test('Complete login flow works correctly', async () => {
  mockApi.login.mockResolvedValue({
    user: { id: '1', email: 'test@example.com' },
    token: 'mock-token',
    refreshToken: 'mock-refresh-token'
  })

  render(
    <TestWrapper>
      <LoginForm />
    </TestWrapper>
  )

  // Fill in login form
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'test@example.com' }
  })
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' }
  })

  // Submit form
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

  await waitFor(() => {
    expect(mockApi.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    })
  })

  // Check that tokens are stored
  expect(localStorage.getItem('token')).toBe('mock-token')
  expect(localStorage.getItem('refreshToken')).toBe('mock-refresh-token')
})

test('Registration flow works correctly', async () => {
  mockApi.register.mockResolvedValue({
    user: { id: '1', email: 'newuser@example.com' },
    token: 'mock-token',
    refreshToken: 'mock-refresh-token'
  })

  render(
    <TestWrapper>
      <RegisterForm />
    </TestWrapper>
  )

  // Fill in registration form
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: 'John' }
  })
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: 'Doe' }
  })
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'newuser@example.com' }
  })
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' }
  })

  // Submit form
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))

  await waitFor(() => {
    expect(mockApi.register).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'newuser@example.com',
      password: 'password123'
    })
  })
})

test('Protected route redirects when not authenticated', () => {
  mockApi.verifyToken.mockRejectedValue(new Error('Invalid token'))

  render(
    <TestWrapper>
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    </TestWrapper>
  )

  // Should not show protected content
  expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
})

test('Protected route shows content when authenticated', async () => {
  mockApi.verifyToken.mockResolvedValue({
    user: { id: '1', email: 'test@example.com' }
  })

  // Set up authenticated state
  localStorage.setItem('token', 'valid-token')

  render(
    <TestWrapper>
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    </TestWrapper>
  )

  await waitFor(() => {
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})

test('Login error handling works correctly', async () => {
  mockApi.login.mockRejectedValue(new Error('Invalid credentials'))

  render(
    <TestWrapper>
      <LoginForm />
    </TestWrapper>
  )

  // Fill in form with invalid credentials
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'wrong@example.com' }
  })
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'wrongpassword' }
  })

  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

  await waitFor(() => {
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
  })
})

test('Token refresh works correctly', async () => {
  // Mock initial token verification failure
  mockApi.verifyToken.mockRejectedValueOnce(new Error('Token expired'))
  
  // Mock successful refresh
  mockApi.refreshToken = vi.fn().mockResolvedValue({
    token: 'new-token',
    refreshToken: 'new-refresh-token'
  })

  localStorage.setItem('refreshToken', 'valid-refresh-token')

  render(
    <TestWrapper>
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    </TestWrapper>
  )

  await waitFor(() => {
    expect(mockApi.refreshToken).toHaveBeenCalledWith('valid-refresh-token')
  })

  expect(localStorage.getItem('token')).toBe('new-token')
})