import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { WorkflowNavigation } from '@/components/workflow/WorkflowNavigation'
import * as workflowHooks from '@/hooks/use-workflow'

// Mock the workflow hooks
vi.mock('@/hooks/use-workflow')
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

const mockWorkflowState = {
  projectId: 'project123',
  currentPhase: {
    id: 'phase-ideation',
    type: 'IDEATION',
    status: 'ACTIVE',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    completedAt: null,
    outputs: null
  },
  allPhases: [
    {
      id: 'phase-ideation',
      type: 'IDEATION',
      status: 'ACTIVE',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      completedAt: null,
      outputs: null
    },
    {
      id: 'phase-refinement',
      type: 'REFINEMENT',
      status: 'PENDING',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      completedAt: null,
      outputs: null
    }
  ],
  availableTransitions: ['REFINEMENT', 'MEDIA', 'FACTCHECK'],
  canSkipPhases: true,
  completedPhases: [],
  pendingPhases: ['REFINEMENT', 'MEDIA', 'FACTCHECK']
}

const mockProgress = {
  totalPhases: 4,
  completedPhases: 0,
  currentPhaseIndex: 0,
  progressPercentage: 0
}

describe('WorkflowNavigation', () => {
  let queryClient: QueryClient
  const mockOnPhaseChange = vi.fn()

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()

    // Mock successful queries by default
    vi.mocked(workflowHooks.useWorkflowState).mockReturnValue({
      data: mockWorkflowState,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    vi.mocked(workflowHooks.usePhaseProgress).mockReturnValue({
      data: mockProgress,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    // Mock mutations
    vi.mocked(workflowHooks.useMoveToNextPhase).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null
    } as any)

    vi.mocked(workflowHooks.useMoveToPreviousPhase).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null
    } as any)

    vi.mocked(workflowHooks.useSkipToPhase).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null
    } as any)

    vi.mocked(workflowHooks.useCompleteCurrentPhase).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null
    } as any)
  })

  it('should render workflow navigation with current phase', () => {
    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    expect(screen.getByText('Writing Workflow')).toBeInTheDocument()
    expect(screen.getByText('Current Phase: Ideation')).toBeInTheDocument()
    expect(screen.getByText('0/4 Complete')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    vi.mocked(workflowHooks.useWorkflowState).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    expect(screen.getByRole('generic')).toHaveClass('animate-spin')
  })

  it('should show error state when workflow state fails to load', () => {
    vi.mocked(workflowHooks.useWorkflowState).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
      refetch: vi.fn()
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    expect(screen.getByText('Unable to load workflow state')).toBeInTheDocument()
  })

  it('should handle next phase button click', async () => {
    const mockMutate = vi.fn()
    vi.mocked(workflowHooks.useMoveToNextPhase).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    // Switch to Quick Actions tab
    fireEvent.click(screen.getByText('Quick Actions'))
    
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should handle previous phase button click', async () => {
    const mockMutate = vi.fn()
    vi.mocked(workflowHooks.useMoveToPreviousPhase).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null
    } as any)

    // Mock state where previous phase is available
    const stateWithPrevious = {
      ...mockWorkflowState,
      currentPhase: {
        ...mockWorkflowState.currentPhase,
        type: 'REFINEMENT'
      },
      availableTransitions: ['IDEATION', 'MEDIA', 'FACTCHECK']
    }

    vi.mocked(workflowHooks.useWorkflowState).mockReturnValue({
      data: stateWithPrevious,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    // Switch to Quick Actions tab
    fireEvent.click(screen.getByText('Quick Actions'))
    
    const previousButton = screen.getByText('Previous')
    fireEvent.click(previousButton)

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should handle complete phase button click', async () => {
    const mockMutate = vi.fn()
    vi.mocked(workflowHooks.useCompleteCurrentPhase).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    // Switch to Quick Actions tab
    fireEvent.click(screen.getByText('Quick Actions'))
    
    const completeButton = screen.getByText('Complete Phase')
    fireEvent.click(completeButton)

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should disable buttons when mutations are pending', () => {
    vi.mocked(workflowHooks.useMoveToNextPhase).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      error: null
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    // Switch to Quick Actions tab
    fireEvent.click(screen.getByText('Quick Actions'))
    
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('should show available phase transitions', () => {
    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    // Switch to Quick Actions tab
    fireEvent.click(screen.getByText('Quick Actions'))
    
    expect(screen.getByText('Available Phases')).toBeInTheDocument()
    expect(screen.getByText('Draft Refinement')).toBeInTheDocument()
    expect(screen.getByText('Media Creation')).toBeInTheDocument()
    expect(screen.getByText('Fact-checking & SEO')).toBeInTheDocument()
  })

  it('should handle phase click in stepper', async () => {
    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    // The stepper should be visible by default (Phase Overview tab)
    const refinementPhase = screen.getByText('Draft Refinement')
    fireEvent.click(refinementPhase)

    // Should open the transition dialog
    await waitFor(() => {
      expect(screen.getByText('Skip to Phase')).toBeInTheDocument()
    })
  })

  it('should show progress bar with correct percentage', () => {
    const progressWith50Percent = {
      ...mockProgress,
      completedPhases: 2,
      progressPercentage: 50
    }

    vi.mocked(workflowHooks.usePhaseProgress).mockReturnValue({
      data: progressWith50Percent,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    expect(screen.getByText('2/4 Complete')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('should call onPhaseChange when phase changes', async () => {
    const mockMutate = vi.fn((_, options) => {
      // Simulate successful mutation
      options?.onSuccess?.({ currentPhase: { type: 'REFINEMENT' } })
    })

    vi.mocked(workflowHooks.useMoveToNextPhase).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null
    } as any)

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={mockOnPhaseChange}
      />
    )

    // Switch to Quick Actions tab
    fireEvent.click(screen.getByText('Quick Actions'))
    
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(mockOnPhaseChange).toHaveBeenCalledWith('REFINEMENT')
    })
  })
})