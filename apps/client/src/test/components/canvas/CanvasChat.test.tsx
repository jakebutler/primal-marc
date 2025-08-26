import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CanvasChat } from '@/components/canvas/CanvasChat'
import socketService from '@/services/socket'

// Mock the socket service
vi.mock('@/services/socket', () => ({
  default: {
    connect: vi.fn(),
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

describe('CanvasChat', () => {
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders chat interface correctly', () => {
    render(<CanvasChat {...mockProps} />)
    
    expect(screen.getByText('Test Chat')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument() // Send button
  })

  it('connects to socket on mount', async () => {
    render(<CanvasChat {...mockProps} />)
    
    await waitFor(() => {
      expect(socketService.connect).toHaveBeenCalledWith('mock-token')
      expect(socketService.joinConversation).toHaveBeenCalledWith(
        mockProps.conversationId,
        mockProps.projectId
      )
    })
  })

  it('sends message when form is submitted', async () => {
    const user = userEvent.setup()
    render(<CanvasChat {...mockProps} />)
    
    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')
    
    await user.type(input, 'Hello, world!')
    await user.click(sendButton)
    
    expect(socketService.sendMessage).toHaveBeenCalledWith(
      mockProps.conversationId,
      expect.objectContaining({
        role: 'user',
        content: 'Hello, world!'
      })
    )
  })

  it('sends message on Enter key press', async () => {
    const user = userEvent.setup()
    render(<CanvasChat {...mockProps} />)
    
    const input = screen.getByPlaceholderText('Type your message...')
    
    await user.type(input, 'Hello, world!')
    await user.keyboard('{Enter}')
    
    expect(socketService.sendMessage).toHaveBeenCalledWith(
      mockProps.conversationId,
      expect.objectContaining({
        role: 'user',
        content: 'Hello, world!'
      })
    )
  })

  it('does not send empty messages', async () => {
    const user = userEvent.setup()
    render(<CanvasChat {...mockProps} />)
    
    const sendButton = screen.getByRole('button')
    
    await user.click(sendButton)
    
    expect(socketService.sendMessage).not.toHaveBeenCalled()
  })

  it('handles typing indicators', async () => {
    const user = userEvent.setup()
    render(<CanvasChat {...mockProps} />)
    
    const input = screen.getByPlaceholderText('Type your message...')
    
    await user.type(input, 'Hello')
    
    // Should send typing indicator
    await waitFor(() => {
      expect(socketService.sendTypingIndicator).toHaveBeenCalledWith(
        mockProps.conversationId,
        true
      )
    })
  })

  it('requests agent response when agent type is specified', async () => {
    const user = userEvent.setup()
    render(<CanvasChat {...mockProps} />)
    
    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')
    
    await user.type(input, 'Help me with ideation')
    await user.click(sendButton)
    
    expect(socketService.requestAgentResponse).toHaveBeenCalledWith(
      mockProps.conversationId,
      mockProps.agentType,
      expect.objectContaining({
        projectId: mockProps.projectId
      })
    )
  })

  it('displays connection status', () => {
    render(<CanvasChat {...mockProps} />)
    
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('can be minimized and maximized', async () => {
    const user = userEvent.setup()
    render(<CanvasChat {...mockProps} />)
    
    // Find minimize button
    const minimizeButton = screen.getByRole('button', { name: /minimize/i })
    await user.click(minimizeButton)
    
    // Should show minimized state
    expect(screen.queryByPlaceholderText('Type your message...')).not.toBeInTheDocument()
    
    // Find maximize button
    const maximizeButton = screen.getByRole('button', { name: /maximize/i })
    await user.click(maximizeButton)
    
    // Should show full interface again
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('displays messages correctly', () => {
    const mockOnMessage = vi.fn()
    
    render(<CanvasChat {...mockProps} onMessageSent={mockOnMessage} />)
    
    // Simulate receiving a message through socket events
    const mockMessage = {
      id: 'msg-1',
      role: 'agent' as const,
      content: 'Hello from agent',
      timestamp: new Date(),
      agentType: 'ideation'
    }
    
    // Get the message handler that was registered
    const messageHandler = (socketService.on as any).mock.calls.find(
      (call: any) => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      messageHandler(mockMessage)
    }
    
    // Message should appear in the chat
    expect(screen.getByText('Hello from agent')).toBeInTheDocument()
  })

  it('shows typing indicator for agents', () => {
    render(<CanvasChat {...mockProps} />)
    
    // Simulate receiving typing indicator
    const mockTypingIndicator = {
      userId: 'agent',
      isTyping: true,
      agentType: 'ideation'
    }
    
    // Get the typing indicator handler
    const typingHandler = (socketService.on as any).mock.calls.find(
      (call: any) => call[0] === 'typingIndicator'
    )?.[1]
    
    if (typingHandler) {
      typingHandler(mockTypingIndicator)
    }
    
    // Should show typing indicator
    expect(screen.getByText(/typing.../)).toBeInTheDocument()
  })

  it('handles message streaming', () => {
    render(<CanvasChat {...mockProps} />)
    
    // Simulate streaming message
    const streamHandler = (socketService.on as any).mock.calls.find(
      (call: any) => call[0] === 'messageStream'
    )?.[1]
    
    if (streamHandler) {
      // Start streaming
      streamHandler({
        messageId: 'stream-1',
        chunk: 'Hello ',
        isComplete: false
      })
      
      // Continue streaming
      streamHandler({
        messageId: 'stream-1',
        chunk: 'world!',
        isComplete: false
      })
      
      // Complete streaming
      streamHandler({
        messageId: 'stream-1',
        chunk: '',
        isComplete: true
      })
    }
    
    // Should show the complete streamed message
    expect(screen.getByText('Hello world!')).toBeInTheDocument()
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<CanvasChat {...mockProps} />)
    
    unmount()
    
    expect(socketService.leaveConversation).toHaveBeenCalledWith(mockProps.conversationId)
    expect(socketService.off).toHaveBeenCalled()
  })
})