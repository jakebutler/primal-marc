import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CanvasChat } from '@/components/canvas/CanvasChat'

// Mock the socket service
vi.mock('@/services/socket', () => ({
  default: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    sendMessage: vi.fn(),
    sendTypingIndicator: vi.fn(),
    requestAgentResponse: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    isConnected: true,
    status: { connected: true, reconnecting: false }
  }
}))

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
})

describe('CanvasChat Integration', () => {
  const mockProps = {
    conversationId: 'test-conversation',
    projectId: 'test-project',
    agentType: 'ideation',
    title: 'Test Chat'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-token'),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    })
  })

  it('renders the canvas chat interface', () => {
    render(<CanvasChat {...mockProps} />)
    
    // Check that the main components are rendered
    expect(screen.getByText('Test Chat')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2) // minimize and send buttons
  })

  it('shows the correct title', () => {
    render(<CanvasChat {...mockProps} />)
    expect(screen.getByText('Test Chat')).toBeInTheDocument()
  })

  it('has a message input area', () => {
    render(<CanvasChat {...mockProps} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
  })

  it('has send and minimize buttons', () => {
    render(<CanvasChat {...mockProps} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2) // minimize and send buttons
  })

  it('displays connection status indicator', () => {
    render(<CanvasChat {...mockProps} />)
    // The connection status should be visible (either Connected or Disconnected)
    const statusElements = screen.getAllByText(/connected|disconnected/i)
    expect(statusElements.length).toBeGreaterThan(0)
  })

  it('renders with custom agent type', () => {
    render(<CanvasChat {...mockProps} agentType="refiner" />)
    expect(screen.getByText('Test Chat')).toBeInTheDocument()
  })

  it('renders without agent type', () => {
    const propsWithoutAgent = { ...mockProps }
    delete (propsWithoutAgent as any).agentType
    
    render(<CanvasChat {...propsWithoutAgent} />)
    expect(screen.getByText('Test Chat')).toBeInTheDocument()
  })
})