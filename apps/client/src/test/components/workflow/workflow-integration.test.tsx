import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { WorkflowNavigation } from '@/components/workflow/WorkflowNavigation'
import { WorkflowService } from '@/services/workflow'

// Mock the workflow service
vi.mock('@/services/workflow')
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('Workflow Integration Tests', () => {
  let queryClient: QueryClient

  const mockProject = {
    id: 'project123',
    title: 'Test Project',
    content: 'Test content'
  }

  const createMockWorkflowState = (currentPhaseType: string, completedPhases: string[] = []) => ({
    projectId: 'project123',
    currentPhase: {
      id: `phase-${currentPhaseType.toLowerCase()}`,
      type: currentPhaseType,
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
        status: completedPhases.includes('IDEATION') ? 'COMPLETED' : 
               currentPhaseType === 'IDEATION' ? 'ACTIVE' : 'PENDING',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        completedAt: completedPhases.includes('IDEATION') ? '2023-01-02T00:00:00.000Z' : null,
        outputs: null
      },
      {
        id: 'phase-refinement',
        type: 'REFINEMENT',
        status: completedPhases.includes('REFINEMENT') ? 'COMPLETED' : 
               currentPhaseType === 'REFINEMENT' ? 'ACTIVE' : 'PENDING',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        completedAt: completedPhases.includes('REFINEMENT') ? '2023-01-03T00:00:00.000Z' : null,
        outputs: null
      },
      {
        id: 'phase-media',
        type: 'MEDIA',
        status: completedPhases.includes('MEDIA') ? 'COMPLETED' : 
               currentPhaseType === 'MEDIA' ? 'ACTIVE' : 'PENDING',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        completedAt: completedPhases.includes('MEDIA') ? '2023-01-04T00:00:00.000Z' : null,
        outputs: null
      },
      {
        id: 'phase-factcheck',
        type: 'FACTCHECK',
        status: completedPhases.includes('FACTCHECK') ? 'COMPLETED' : 
               currentPhaseType === 'FACTCHECK' ? 'ACTIVE' : 'PENDING',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        completedAt: completedPhases.includes('FACTCHECK') ? '2023-01-05T00:00:00.000Z' : null,
        outputs: null
      }
    ],
    availableTransitions: ['REFINEMENT', 'MEDIA', 'FACTCHECK'],
    canSkipPhases: true,
    completedPhases,
    pendingPhases: ['REFINEMENT', 'MEDIA', 'FACTCHECK'].filter(p => !completedPhases.includes(p))
  })

  const createMockProgress = (completedCount: number) => ({
    totalPhases: 4,
    completedPhases: completedCount,
    currentPhaseIndex: completedCount,
    progressPercentage: Math.round((completedCount / 4) * 100)
  })

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
  })

  it('should complete full workflow from ideation to factcheck', async () => {
    const phaseChangeHandler = vi.fn()
    let currentPhase = 'IDEATION'
    let completedPhases: string[] = []

    // Mock service responses that change based on current state
    vi.mocked(WorkflowService.getWorkflowState).mockImplementation(async () => ({
      success: true,
      data: createMockWorkflowState(currentPhase, completedPhases)
    }))

    vi.mocked(WorkflowService.getPhaseProgress).mockImplementation(async () => ({
      success: true,
      data: createMockProgress(completedPhases.length)
    }))

    vi.mocked(WorkflowService.moveToNextPhase).mockImplementation(async () => {
      const phases = ['IDEATION', 'REFINEMENT', 'MEDIA', 'FACTCHECK']
      const currentIndex = phases.indexOf(currentPhase)
      
      if (currentIndex < phases.length - 1) {
        completedPhases.push(currentPhase)
        currentPhase = phases[currentIndex + 1]
        
        return {
          success: true,
          data: {
            currentPhase: { type: currentPhase },
            availableTransitions: []
          }
        }
      }
      
      return {
        success: false,
        error: 'Already at final phase'
      }
    })

    const { rerender } = renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={phaseChangeHandler}
      />
    )

    // Initial state - should be in ideation phase
    await waitFor(() => {
      expect(screen.getByText('Current Phase: Ideation')).toBeInTheDocument()
      expect(screen.getByText('0/4 Complete')).toBeInTheDocument()
    })

    // Move through each phase
    const phases = [
      { from: 'Ideation', to: 'Draft Refinement' },
      { from: 'Draft Refinement', to: 'Media Creation' },
      { from: 'Media Creation', to: 'Fact-checking & SEO' }
    ]

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]
      
      // Click Quick Actions tab and then Next button
      fireEvent.click(screen.getByText('Quick Actions'))
      
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      // Wait for the phase to change
      await waitFor(() => {
        // Re-render with updated state
        rerender(
          <WorkflowNavigation 
            projectId="project123" 
            onPhaseChange={phaseChangeHandler}
          />
        )
      })

      // Verify the new phase is active
      await waitFor(() => {
        expect(screen.getByText(`Current Phase: ${phase.to}`)).toBeInTheDocument()
        expect(screen.getByText(`${i + 1}/4 Complete`)).toBeInTheDocument()
      })
    }

    // Verify all phases were completed
    expect(phaseChangeHandler).toHaveBeenCalledTimes(3)
    expect(phaseChangeHandler).toHaveBeenNthCalledWith(1, 'REFINEMENT')
    expect(phaseChangeHandler).toHaveBeenNthCalledWith(2, 'MEDIA')
    expect(phaseChangeHandler).toHaveBeenNthCalledWith(3, 'FACTCHECK')
  })

  it('should allow skipping phases and returning to previous phases', async () => {
    const phaseChangeHandler = vi.fn()
    
    // Start in ideation phase
    vi.mocked(WorkflowService.getWorkflowState).mockResolvedValue({
      success: true,
      data: createMockWorkflowState('IDEATION', [])
    })

    vi.mocked(WorkflowService.getPhaseProgress).mockResolvedValue({
      success: true,
      data: createMockProgress(0)
    })

    vi.mocked(WorkflowService.skipToPhase).mockResolvedValue({
      success: true,
      data: {
        currentPhase: { type: 'MEDIA' },
        availableTransitions: ['IDEATION', 'REFINEMENT', 'FACTCHECK']
      }
    })

    vi.mocked(WorkflowService.moveToPreviousPhase).mockResolvedValue({
      success: true,
      data: {
        currentPhase: { type: 'IDEATION' },
        availableTransitions: ['REFINEMENT', 'MEDIA', 'FACTCHECK']
      }
    })

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={phaseChangeHandler}
      />
    )

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Current Phase: Ideation')).toBeInTheDocument()
    })

    // Skip to media phase by clicking on it in the stepper
    const mediaPhaseButton = screen.getByText('Media Creation')
    fireEvent.click(mediaPhaseButton)

    // Confirm the skip in the dialog
    await waitFor(() => {
      expect(screen.getByText('Skip to Phase')).toBeInTheDocument()
    })

    const confirmButton = screen.getByText('Skip to Phase')
    fireEvent.click(confirmButton)

    // Verify skip was called
    expect(WorkflowService.skipToPhase).toHaveBeenCalledWith('project123', 'MEDIA')

    // Now test going back to previous phase
    // Switch to Quick Actions tab
    fireEvent.click(screen.getByText('Quick Actions'))
    
    const previousButton = screen.getByText('Previous')
    fireEvent.click(previousButton)

    expect(WorkflowService.moveToPreviousPhase).toHaveBeenCalledWith('project123')
  })

  it('should handle phase completion', async () => {
    const phaseChangeHandler = vi.fn()
    
    vi.mocked(WorkflowService.getWorkflowState).mockResolvedValue({
      success: true,
      data: createMockWorkflowState('IDEATION', [])
    })

    vi.mocked(WorkflowService.getPhaseProgress).mockResolvedValue({
      success: true,
      data: createMockProgress(0)
    })

    vi.mocked(WorkflowService.completeCurrentPhase).mockResolvedValue({
      success: true,
      data: {
        currentPhase: { type: 'REFINEMENT' },
        availableTransitions: ['IDEATION', 'MEDIA', 'FACTCHECK']
      }
    })

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={phaseChangeHandler}
      />
    )

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Current Phase: Ideation')).toBeInTheDocument()
    })

    // Switch to Quick Actions tab and complete phase
    fireEvent.click(screen.getByText('Quick Actions'))
    
    const completeButton = screen.getByText('Complete Phase')
    fireEvent.click(completeButton)

    expect(WorkflowService.completeCurrentPhase).toHaveBeenCalledWith('project123')
  })

  it('should show correct progress throughout workflow', async () => {
    const testCases = [
      { phase: 'IDEATION', completed: [], expectedProgress: 0 },
      { phase: 'REFINEMENT', completed: ['IDEATION'], expectedProgress: 25 },
      { phase: 'MEDIA', completed: ['IDEATION', 'REFINEMENT'], expectedProgress: 50 },
      { phase: 'FACTCHECK', completed: ['IDEATION', 'REFINEMENT', 'MEDIA'], expectedProgress: 75 }
    ]

    for (const testCase of testCases) {
      vi.mocked(WorkflowService.getWorkflowState).mockResolvedValue({
        success: true,
        data: createMockWorkflowState(testCase.phase, testCase.completed)
      })

      vi.mocked(WorkflowService.getPhaseProgress).mockResolvedValue({
        success: true,
        data: createMockProgress(testCase.completed.length)
      })

      const { unmount } = renderWithQueryClient(
        <WorkflowNavigation 
          projectId="project123" 
          onPhaseChange={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(`${testCase.completed.length}/4 Complete`)).toBeInTheDocument()
        expect(screen.getByText(`${testCase.expectedProgress}%`)).toBeInTheDocument()
      })

      unmount()
    }
  })

  it('should handle workflow errors gracefully', async () => {
    vi.mocked(WorkflowService.getWorkflowState).mockResolvedValue({
      success: false,
      error: 'Project not found'
    })

    vi.mocked(WorkflowService.getPhaseProgress).mockResolvedValue({
      success: false,
      error: 'Project not found'
    })

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="nonexistent" 
        onPhaseChange={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Unable to load workflow state')).toBeInTheDocument()
    })
  })

  it('should prevent invalid transitions', async () => {
    vi.mocked(WorkflowService.getWorkflowState).mockResolvedValue({
      success: true,
      data: createMockWorkflowState('IDEATION', [])
    })

    vi.mocked(WorkflowService.getPhaseProgress).mockResolvedValue({
      success: true,
      data: createMockProgress(0)
    })

    vi.mocked(WorkflowService.transitionToPhase).mockResolvedValue({
      success: false,
      error: 'Cannot transition from IDEATION to FACTCHECK without completing intermediate phases'
    })

    renderWithQueryClient(
      <WorkflowNavigation 
        projectId="project123" 
        onPhaseChange={vi.fn()}
      />
    )

    // Try to skip to factcheck phase
    const factcheckButton = screen.getByText('Fact-checking & SEO')
    fireEvent.click(factcheckButton)

    // Confirm the transition
    await waitFor(() => {
      expect(screen.getByText('Skip to Phase')).toBeInTheDocument()
    })

    const confirmButton = screen.getByText('Skip to Phase')
    fireEvent.click(confirmButton)

    // The service should be called but return an error
    expect(WorkflowService.skipToPhase).toHaveBeenCalledWith('project123', 'FACTCHECK')
  })
})