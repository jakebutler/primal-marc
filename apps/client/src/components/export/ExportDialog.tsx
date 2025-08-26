import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { useToast } from '../../hooks/use-toast'
import { Download, FileText, Globe, FileDown } from 'lucide-react'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectTitle: string
}

export function ExportDialog({ open, onOpenChange, projectId, projectTitle }: ExportDialogProps) {
  const [format, setFormat] = useState<'pdf' | 'html' | 'markdown'>('pdf')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeConversations, setIncludeConversations] = useState(false)
  const [customStyles, setCustomStyles] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const response = await fetch(`/api/export/projects/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          format,
          includeMetadata,
          includeConversations,
          customStyles: customStyles.trim() || undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        // Trigger download
        const downloadUrl = result.downloadUrl
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = result.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast({
          title: 'Export successful',
          description: `${projectTitle} has been exported as ${format.toUpperCase()}`
        })

        onOpenChange(false)
      } else {
        throw new Error(result.error || 'Export failed')
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An error occurred during export',
        variant: 'destructive'
      })
    } finally {
      setIsExporting(false)
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <FileDown className="h-4 w-4" />
      case 'html':
        return <Globe className="h-4 w-4" />
      case 'markdown':
        return <FileText className="h-4 w-4" />
      default:
        return <Download className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Project</DialogTitle>
          <DialogDescription>
            Export "{projectTitle}" in your preferred format with custom options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={(value: any) => setFormat(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    PDF Document
                  </div>
                </SelectItem>
                <SelectItem value="html">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    HTML Page
                  </div>
                </SelectItem>
                <SelectItem value="markdown">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Markdown File
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <Label>Export Options</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={includeMetadata}
                onCheckedChange={setIncludeMetadata}
              />
              <Label htmlFor="metadata" className="text-sm font-normal">
                Include project metadata (word count, tags, etc.)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="conversations"
                checked={includeConversations}
                onCheckedChange={setIncludeConversations}
              />
              <Label htmlFor="conversations" className="text-sm font-normal">
                Include AI conversations and chat history
              </Label>
            </div>
          </div>

          {/* Custom Styles (for HTML/PDF) */}
          {(format === 'html' || format === 'pdf') && (
            <div className="space-y-2">
              <Label htmlFor="styles">Custom CSS Styles (Optional)</Label>
              <Textarea
                id="styles"
                placeholder="Add custom CSS to style your export..."
                value={customStyles}
                onChange={(e) => setCustomStyles(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                {getFormatIcon(format)}
                <span className="ml-2">Export {format.toUpperCase()}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}