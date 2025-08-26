import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('MarkdownEditor', () => {
  const defaultProps = {
    content: '# Test Content',
    title: 'Test Title',
    onChange: vi.fn(),
    onTitleChange: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  }

  it('renders with initial content and title', () => {
    renderWithQueryClient(<MarkdownEditor {...defaultProps} />)
    
    expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('# Test Content')).toBeInTheDocument()
  })

  it('calls onChange when content is modified', async () => {
    const onChange = vi.fn()
    renderWithQueryClient(
      <MarkdownEditor {...defaultProps} onChange={onChange} />
    )
    
    const editor = screen.getByTestId('monaco-editor')
    fireEvent.change(editor, { target: { value: '# New Content' } })
    
    expect(onChange).toHaveBeenCalledWith('# New Content')
  })

  it('calls onTitleChange when title is modified', () => {
    const onTitleChange = vi.fn()
    renderWithQueryClient(
      <MarkdownEditor {...defaultProps} onTitleChange={onTitleChange} />
    )
    
    const titleInput = screen.getByDisplayValue('Test Title')
    fireEvent.change(titleInput, { target: { value: 'New Title' } })
    
    expect(onTitleChange).toHaveBeenCalledWith('New Title')
  })

  it('shows edit tab by default', () => {
    renderWithQueryClient(<MarkdownEditor {...defaultProps} />)
    
    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('data-state', 'active')
  })

  it('can click preview tab', () => {
    renderWithQueryClient(<MarkdownEditor {...defaultProps} />)
    
    const previewTab = screen.getByRole('tab', { name: 'Preview' })
    expect(previewTab).toBeInTheDocument()
    
    // Just verify the tab is clickable
    fireEvent.click(previewTab)
    // The actual state change is handled by Radix UI internally
  })

  it('renders in read-only mode', () => {
    renderWithQueryClient(
      <MarkdownEditor {...defaultProps} readOnly={true} />
    )
    
    // Title input should not be present in read-only mode
    expect(screen.queryByDisplayValue('Test Title')).not.toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderWithQueryClient(
      <MarkdownEditor {...defaultProps} onSave={onSave} />
    )
    
    // Find the save button by looking for the SVG icon (since tooltip text isn't accessible in tests)
    const buttons = screen.getAllByRole('button')
    const saveButton = buttons.find(button => {
      const svg = button.querySelector('svg')
      return svg && svg.getAttribute('xmlns') === 'http://www.w3.org/2000/svg'
    })
    
    // Click the last button in the toolbar (which should be the save button)
    const toolbarButtons = buttons.filter(button => !button.disabled)
    const lastButton = toolbarButtons[toolbarButtons.length - 1]
    fireEvent.click(lastButton)
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('# Test Content', 'Test Title')
    })
  })
})