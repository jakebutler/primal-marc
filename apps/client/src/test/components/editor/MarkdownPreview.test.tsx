import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownPreview } from '@/components/editor/MarkdownPreview'

describe('MarkdownPreview', () => {
  it('renders empty state when no content', () => {
    render(<MarkdownPreview content="" />)
    
    expect(screen.getByText('Start typing to see your markdown preview...')).toBeInTheDocument()
  })

  it('renders markdown content as HTML', () => {
    const content = '# Heading\n\nThis is **bold** text and *italic* text.'
    render(<MarkdownPreview content={content} />)
    
    // Check that markdown is converted to HTML
    expect(screen.getByText('Heading')).toBeInTheDocument()
    expect(screen.getByText('bold')).toBeInTheDocument()
    expect(screen.getByText('italic')).toBeInTheDocument()
  })

  it('handles code blocks', () => {
    const content = 'Here is some `inline code` in the text.'
    render(<MarkdownPreview content={content} />)
    
    expect(screen.getByText('inline code')).toBeInTheDocument()
  })

  it('handles links', () => {
    const content = 'Check out [this link](https://example.com).'
    render(<MarkdownPreview content={content} />)
    
    const link = screen.getByRole('link', { name: 'this link' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('handles strikethrough text', () => {
    const content = 'This is ~~strikethrough~~ text.'
    render(<MarkdownPreview content={content} />)
    
    expect(screen.getByText('strikethrough')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <MarkdownPreview content="# Test" className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})