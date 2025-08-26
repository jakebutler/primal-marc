import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { CanvasChat } from '@/components/canvas/CanvasChat'
import { WorkflowNavigation } from '@/components/workflow/WorkflowNavigation'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'

// Mock Socket.io
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn()
}

vi.mock('socket.io-client', () => ({
  io: () => mockSocket
}))

// Mock API
const mockApi = {
  createProject: vi.fn(),
  updateProject: vi.fn(),
  getProject: vi.fn(),
  sendMessage: vi.fn()
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
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('Complete ideation workflow works correctly', async () => {
  const mockProject = {
    id: 'project-1',
    title: 'Test Project',
    content: '',
    currentPhase: 'ideation',
    phases: [
      { id: 'phase-1', type: 'ideation', status: 'active' }
    ]
  }

  mockApi.getProject.mockResolvedValue(mockProject)
  mockApi.sendMessage.mockResolvedValue({
    id: 'msg-1',
    content: 'Great idea! Let me help you develop that concept...',
    role: 'agent',
    agentType: 'ideation'
  })

  render(
    <TestWrapper>
      <div>
        <WorkflowNavigation 
          currentPhase="ideation" 
          projectId="project-1"
          onPhaseChange={vi.fn()}
        />
        <CanvasChat 
          projectId="project-1"
          agentType="ideation"
          onContentUpdate={vi.fn()}
        />
      </div>
    </TestWrapper>
  )

  // Check that ideation phase is active
  expect(screen.getByText('Ideation')).toHaveClass('active')

  // Send a message to the ideation agent
  const messageInput = screen.getByPlaceholderText(/type your message/i)
  fireEvent.change(messageInput, {
    target: { value: 'I want to write about sustainable technology' }
  })

  fireEvent.click(screen.getByRole('button', { name: /send/i }))

  await waitFor(() => {
    expect(mockApi.sendMessage).toHaveBeenCalledWith({
      projectId: 'project-1',
      content: 'I want to write about sustainable technology',
      agentType: 'ideation'
    })
  })

  // Check that agent response is displayed
  await waitFor(() => {
    expect(screen.getByText(/Great idea! Let me help you develop/)).toBeInTheDocument()
  })
})

test('Phase transition from ideation to refinement works', async () => {
  const mockOnPhaseChange = vi.fn()

  render(
    <TestWrapper>
      <WorkflowNavigation 
        currentPhase="ideation" 
        projectId="project-1"
        onPhaseChange={mockOnPhaseChange}
      />
    </TestWrapper>
  )

  // Click on refinement phase
  fireEvent.click(screen.getByText('Refinement'))

  expect(mockOnPhaseChange).toHaveBeenCalledWith('refinement')
})

test('Real-time collaboration works correctly', async () => {
  const mockOnContentUpdate = vi.fn()

  render(
    <TestWrapper>
      <CanvasChat 
        projectId="project-1"
        agentType="ideation"
        onContentUpdate={mockOnContentUpdate}
      />
    </TestWrapper>
  )

  // Simulate receiving a real-time message
  const messageHandler = mockSocket.on.mock.calls.find(
    call => call[0] === 'message'
  )?.[1]

  if (messageHandler) {
    messageHandler({
      id: 'msg-2',
      content: 'Here are some structured ideas for your topic...',
      role: 'agent',
      agentType: 'ideation'
    })
  }

  await waitFor(() => {
    expect(screen.getByText(/Here are some structured ideas/)).toBeInTheDocument()
  })
})

test('Content synchronization between editor and chat works', async () => {
  const mockContent = '# My Article\n\nThis is the beginning of my article about sustainable technology.'
  
  render(
    <TestWrapper>
      <div>
        <MarkdownEditor 
          content={mockContent}
          onChange={vi.fn()}
        />
        <CanvasChat 
          projectId="project-1"
          agentType="refiner"
          onContentUpdate={vi.fn()}
        />
      </div>
    </TestWrapper>
  )

  // Check that editor shows content
  expect(screen.getByDisplayValue(mockContent)).toBeInTheDocument()

  // Simulate agent suggesting content changes
  const messageHandler = mockSocket.on.mock.calls.find(
    call => call[0] === 'contentUpdate'
  )?.[1]

  if (messageHandler) {
    messageHandler({
      projectId: 'project-1',
      content: mockContent + '\n\nI suggest adding more details about renewable energy sources.',
      source: 'agent'
    })
  }

  await waitFor(() => {
    expect(screen.getByText(/I suggest adding more details/)).toBeInTheDocument()
  })
})

test('Error handling in workflow works correctly', async () => {
  mockApi.sendMessage.mockRejectedValue(new Error('Network error'))

  render(
    <TestWrapper>
      <CanvasChat 
        projectId="project-1"
        agentType="ideation"
        onContentUpdate={vi.fn()}
      />
    </TestWrapper>
  )

  const messageInput = screen.getByPlaceholderText(/type your message/i)
  fireEvent.change(messageInput, {
    target: { value: 'Test message' }
  })

  fireEvent.click(screen.getByRole('button', { name: /send/i }))

  await waitFor(() => {
    expect(screen.getByText(/failed to send message/i)).toBeInTheDocument()
  })

  // Check that retry button is available
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
})

test('Offline mode handling works correctly', async () => {
  // Simulate offline state
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  })

  render(
    <TestWrapper>
      <CanvasChat 
        projectId="project-1"
        agentType="ideation"
        onContentUpdate={vi.fn()}
      />
    </TestWrapper>
  )

  // Should show offline indicator
  expect(screen.getByText(/offline/i)).toBeInTheDocument()

  // Messages should be queued locally
  const messageInput = screen.getByPlaceholderText(/type your message/i)
  fireEvent.change(messageInput, {
    target: { value: 'Offline message' }
  })

  fireEvent.click(screen.getByRole('button', { name: /send/i }))

  expect(screen.getByText(/message queued/i)).toBeInTheDocument()
})