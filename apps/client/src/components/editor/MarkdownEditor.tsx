import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const [localContent, setLocalContent] = useState(content)

  useEffect(() => {
    setLocalContent(content)
  }, [content])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setLocalContent(newContent)
    onChange(newContent)
  }

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full">
        <textarea
          value={localContent}
          onChange={handleChange}
          placeholder="Start writing your content here..."
          className="w-full h-full min-h-96 p-4 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </CardContent>
    </Card>
  )
}