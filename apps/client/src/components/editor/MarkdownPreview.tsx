import React, { useMemo } from 'react'
import { Card } from '@/components/ui/card'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
}) => {
  // Simple markdown parser for basic formatting
  const parseMarkdown = useMemo(() => {
    if (!content) return ''

    let html = content
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3 mt-6">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 mt-8">$1</h1>')
      
      // Bold and Italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold"><em class="italic">$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      
      // Strikethrough
      .replace(/~~(.*?)~~/g, '<del class="line-through">$1</del>')
      
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">$1</a>')
      
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br>')

    // Handle lists
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
    
    // Handle blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-muted pl-4 italic text-muted-foreground">$1</blockquote>')

    // Wrap in paragraphs if not already wrapped
    if (html && !html.startsWith('<')) {
      html = `<p class="mb-4">${html}</p>`
    }

    return html
  }, [content])

  if (!content.trim()) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-muted-foreground">
          <p>Start typing to see your markdown preview...</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div 
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: parseMarkdown }}
      />
    </Card>
  )
}